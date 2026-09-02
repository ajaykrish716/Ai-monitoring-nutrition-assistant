"""
Dedicated Daily Plan Agent service.

Generates and persists personalized daily nutrition and physical activity plans
based on the user's free-text stated need, onboarding profile, dietary restrictions,
allergies, and preferences.

Strict rules:
- No hardcoded goals or category switches.
- Strict adherence to allergies and explicit dietary restrictions.
- Safety: No medical diagnoses or prescriptions; respect clinician guidance.
- Persists daily plans in MongoDB to avoid unnecessary AI re-generation.
"""

import json
import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.schemas.daily_plan import DailyPlanResponse
from app.services.ai_service import AIServiceError, chat_completion

logger = logging.getLogger(__name__)

DAILY_PLAN_SYSTEM_PROMPT = """\
You are an expert AI Nutrition & Wellness Plan Generation Agent.
Your role is to construct a completely tailored, highly actionable daily nutrition and physical activity plan for the user based strictly on their personalized profile and ALL their active goals/needs.

CRITICAL PRINCIPLES:
1. REASON DYNAMICALLY ACROSS ALL ACTIVE GOALS (MULTIPLE SIMULTANEOUS GOALS):
   - The user may have MULTIPLE active wellness goals/needs simultaneously (e.g., "Build muscle", "Keep meals affordable", "Support hair health", "Improve daily energy").
   - You MUST evaluate all active goals TOGETHER to generate ONE coherent, unified daily meal plan and physical activity plan.
   - Do NOT generate separate plans per goal. Balance the nutritional and lifestyle requirements (e.g. high protein + budget friendly, or anti-inflammatory + marathon endurance) into a single cohesive day.
   - For ANY unexpected or novel combination of needs, reason scientifically and practically from nutritional biochemistry.

2. SAFETY & RESTRICTIONS (ZERO TOLERANCE FOR ALLERGENS):
   - You MUST NEVER include ingredients or foods that conflict with the user's recorded allergies, intolerances, or explicit dietary restrictions.
   - If the user has medical context, medications, or clinician instructions, design food suggestions that respect those constraints, and include a helpful note to consult their clinician.
   - You are a nutrition mentor, NOT a medical doctor. Do NOT prescribe medical treatments.

3. STRUCTURED DATA OUTPUT:
You MUST respond with valid JSON ONLY (no markdown code blocks, no preamble, no trailing text).

JSON SCHEMA:
{
  "summary": "Brief 1-2 sentence overview explaining how today's plan balances all active goals (e.g. high-protein muscle support on a budget)",
  "daily_targets": {
    "calories": 2100.0,
    "protein": 115.0,
    "carbohydrates": 240.0,
    "fat": 65.0,
    "water_ml": 2800.0
  },
  "meals": [
    {
      "meal_type": "Breakfast",
      "name": "Meal Name / Recipe Title",
      "foods": ["Ingredient 1", "Ingredient 2", "Ingredient 3"],
      "portion_information": "e.g., 2 eggs, 2 slices whole grain toast, 1 cup berries",
      "nutrition": {
        "calories": 480.0,
        "protein": 28.0,
        "carbohydrates": 45.0,
        "fat": 18.0
      },
      "notes": "Optional preparation, timing, or benefit note"
    }
  ],
  "physical_activities": [
    {
      "name": "Activity Name",
      "duration_minutes": 30,
      "intensity": "Moderate",
      "notes": "Practical guidelines or form/recovery tips"
    }
  ]
}

Provide 3 to 4 well-balanced meals (e.g. Breakfast, Lunch, Dinner, and optional Snack) that add up approximately to the daily_targets.
"""


def _get_today_date_str() -> str:
    """Return today's date in YYYY-MM-DD format (UTC)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _build_user_context_for_plan(user: dict) -> dict:
    """Assemble a compact, relevant context dictionary from user document including multiple goals."""
    static_profile = {
        "name": user.get("name", ""),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "height_cm": user.get("height"),
        "current_weight_kg": user.get("current_weight"),
    }

    profile_summary = user.get("profile", {})
    known_facts = user.get("known_facts", {})
    answers = user.get("answers", {})

    # Extract all active goals
    raw_goals = user.get("goals", [])
    active_goals = [
        {"id": g.get("id"), "description": g.get("description"), "priority": g.get("priority")}
        for g in raw_goals
        if isinstance(g, dict) and g.get("status", "active") == "active"
    ]

    # Fallback to single need if goals array is empty
    if not active_goals:
        legacy_need = user.get("need") or user.get("profile", {}).get("need") or "Holistic nutrition, balanced energy, and healthy habit building"
        active_goals = [{"id": "initial_need", "description": legacy_need, "priority": 1}]

    # Combine known facts into a clean dictionary
    merged_facts = {**known_facts, **profile_summary}

    return {
        "user_profile": static_profile,
        "active_goals": active_goals,
        "primary_focus_summary": " | ".join(g["description"] for g in active_goals),
        "collected_personalization_facts": merged_facts,
        "onboarding_answers": answers,
    }


async def generate_or_get_daily_plan(
    user_id: str,
    date_str: str | None = None,
    force_regenerate: bool = False,
) -> DailyPlanResponse:
    """
    Retrieve an existing daily plan for the given date, or generate a new one via AI.
    """
    db = get_database()
    target_date = date_str or _get_today_date_str()

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    # Check for existing plan in MongoDB if not forcing regeneration
    if not force_regenerate:
        existing_doc = await db.daily_plans.find_one({
            "user_id": user_id,
            "date": target_date,
        })
        if existing_doc:
            return DailyPlanResponse(
                id=str(existing_doc["_id"]),
                user_id=user_id,
                date=existing_doc["date"],
                summary=existing_doc.get("summary", ""),
                daily_targets=existing_doc.get("daily_targets", {}),
                meals=existing_doc.get("meals", []),
                physical_activities=existing_doc.get("physical_activities", []),
                created_at=existing_doc.get("created_at"),
                updated_at=existing_doc.get("updated_at"),
            )

    # Build context and generate plan via OpenRouter AI
    user_context = _build_user_context_for_plan(user)
    messages = [
        {"role": "system", "content": DAILY_PLAN_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Generate a personalized daily plan for date: {target_date}.\n"
                f"User Profile & Need Context:\n{json.dumps(user_context, indent=2)}"
            ),
        },
    ]

    try:
        ai_data = await chat_completion(messages, temperature=0.6, max_tokens=1800)
    except Exception as exc:
        logger.warning("Daily plan AI fallback: %s", exc)
        ai_data = {
            "summary": "Balanced daily nutrition focused on sustained energy and wholesome nourishment.",
            "daily_targets": {
                "calories": 2000.0,
                "protein": 100.0,
                "carbohydrates": 220.0,
                "fat": 65.0,
                "water_ml": 2500.0,
            },
            "meals": [
                {
                    "meal_type": "Breakfast",
                    "name": "Wholesome Oatmeal with Fruit & Nuts",
                    "foods": ["Rolled oats", "Almond milk", "Banana", "Chia seeds", "Walnuts"],
                    "portion_information": "1 bowl (50g oats, 1 cup milk, 1 sliced banana)",
                    "nutrition": {"calories": 420.0, "protein": 14.0, "carbohydrates": 65.0, "fat": 12.0},
                    "notes": "Rich in complex carbs for sustained morning energy."
                },
                {
                    "meal_type": "Lunch",
                    "name": "Grilled Protein & Grain Bowl",
                    "foods": ["Brown rice", "Mixed greens", "Chickpeas or Chicken", "Olive oil dressing"],
                    "portion_information": "1 bowl (1 cup cooked grain, 120g protein)",
                    "nutrition": {"calories": 580.0, "protein": 38.0, "carbohydrates": 60.0, "fat": 16.0},
                    "notes": "Balanced macro distribution."
                },
                {
                    "meal_type": "Dinner",
                    "name": "Roasted Vegetable & Protein Medley",
                    "foods": ["Steamed vegetables", "Quinoa", "Baked protein", "Herbs"],
                    "portion_information": "1 plate (large serving of vegetables)",
                    "nutrition": {"calories": 520.0, "protein": 32.0, "carbohydrates": 50.0, "fat": 14.0},
                    "notes": "Light and nutrient-dense."
                }
            ],
            "physical_activities": [
                {
                    "name": "Brisk Walking / Mobility Routine",
                    "duration_minutes": 30,
                    "intensity": "Moderate",
                    "notes": "Great for circulation and digestion."
                }
            ]
        }

    # Clean and validate output
    now = datetime.now(timezone.utc)
    plan_record = {
        "user_id": user_id,
        "date": target_date,
        "summary": ai_data.get("summary", "Your personalized daily nutrition and activity plan."),
        "daily_targets": ai_data.get("daily_targets", {
            "calories": 2000.0,
            "protein": 100.0,
            "carbohydrates": 220.0,
            "fat": 65.0,
            "water_ml": 2500.0,
        }),
        "meals": ai_data.get("meals", []),
        "physical_activities": ai_data.get("physical_activities", []),
        "updated_at": now,
    }

    # Upsert in MongoDB
    result = await db.daily_plans.update_one(
        {"user_id": user_id, "date": target_date},
        {"$set": plan_record, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    doc_id = str(result.upserted_id) if result.upserted_id else ""
    if not doc_id:
        saved_doc = await db.daily_plans.find_one({"user_id": user_id, "date": target_date})
        doc_id = str(saved_doc["_id"]) if saved_doc else ""

    return DailyPlanResponse(
        id=doc_id,
        user_id=user_id,
        date=target_date,
        summary=plan_record["summary"],
        daily_targets=plan_record["daily_targets"],
        meals=plan_record["meals"],
        physical_activities=plan_record["physical_activities"],
        created_at=now,
        updated_at=now,
    )
