"""
Dedicated Nutri AI Companion Service.

Nutri is the user's ongoing nutrition partner:
- Automatically reviews every logged meal with constructive, friendly feedback.
- Explains nutritional progress and provides practical tips.
- Dynamically modifies today's daily meal plan when requested (budget, dietary preference, ingredient availability).
- Strictly respects allergies, medical context, and user targets without forcing recipe conformity.
"""

import json
import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.schemas.daily_plan import DailyPlanResponse, MealItem, MacroNutrition
from app.schemas.nutri import (
    NutriInteractResponse,
    PlanModificationDetail,
)
from app.services.ai_service import chat_completion
from app.services.daily_plan_service import generate_or_get_daily_plan
from app.services.tracking_service import get_tracking_today

logger = logging.getLogger(__name__)

NUTRI_SYSTEM_PROMPT = """\
You are "Nutri", the user's dedicated, friendly AI Nutrition Companion & Personal Wellness Partner on NutriTrack.

CORE PHILOSOPHY:
1. UNDERSTAND AND REASON ACROSS MULTIPLE ACTIVE GOALS:
   - The user may have MULTIPLE simultaneous active goals (e.g., "Build muscle", "Keep meals affordable", "Support hair health", "Improve daily energy").
   - You MUST understand how all their active goals connect. When discussing meals, adjustments, or nutrient focus, balance all their active priorities warmly and constructively.
   - If the user asks to add, change, or prioritize a goal in conversation (e.g. "I want to add a muscle-building goal" or "Make budget my top priority"), acknowledge it encouragingly and explain how future meal plans and guidance will factor it in.

2. NUTRITIONAL SUCCESS OVER RECIPE OBEDIENCE:
   - The user does NOT need to eat the exact meals generated in their plan.
   - Any wholesome, affordable, culturally familiar, or preferred food that meets their nutritional needs is a valid success.
   - Never shame the user or say they "failed".

3. DYNAMIC PLAN MODIFICATION:
   - If the user asks to change a meal (e.g. "I can't afford chicken", "Change today's lunch", "I want a vegetarian dinner", "I don't have ingredients"), you MUST determine what to modify and generate a structured replacement meal that maintains their nutritional target across their active goals.
   - For affordable requests, suggest practical low-cost protein/macro sources (e.g. eggs, lentils/dal, tofu, canned fish, beans, seasonal local produce).

4. SAFETY & ALLERGIES:
   - NEVER suggest foods containing the user's recorded allergies or explicit dietary restrictions.
   - You are a nutrition mentor, NOT a doctor. Do not prescribe medicines or clinical diagnoses.

5. TONE & FORMAT:
   - Warm, encouraging, concise, supportive, and natural with friendly emojis (🌱, 💪, 🥗, ✨, 🍳).

RESPONSE FORMAT (JSON ONLY):
{
  "message": "Friendly conversational message to user",
  "action": "none" | "modify_plan" | "review_meal" | "guidance" | "goal_update",
  "plan_modification": {
    "meal_type": "Lunch",
    "original_meal_name": "Grilled Salmon Quinoa Bowl",
    "replacement_meal": {
      "meal_type": "Lunch",
      "name": "Affordable Lentil Dal & Brown Rice Power Bowl",
      "foods": ["Cooked lentils (dal)", "Brown rice", "Spinach", "Spices"],
      "portion_information": "1.5 cups dal, 1 cup rice, sautéed greens",
      "nutrition": {
        "calories": 520.0,
        "protein": 28.0,
        "carbohydrates": 75.0,
        "fat": 10.0
      },
      "notes": "Budget-friendly, high-fiber, rich in plant protein."
    },
    "reason": "Replaced salmon with protein-rich lentils and brown rice to match budget and keep macros balanced."
  }
}
* Note: If no plan modification is needed, set "action": "none" and "plan_modification": null.
"""


def _get_today_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def get_nutri_context(user_id: str, target_date: str) -> dict:
    """Assemble compact, structured context for Nutri including multiple active goals."""
    db = get_database()

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    static_profile = {
        "name": user.get("name", "User"),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "height_cm": user.get("height"),
        "current_weight_kg": user.get("current_weight"),
    }
    
    # Extract multiple active goals
    raw_goals = user.get("goals", [])
    active_goals = [
        {"id": g.get("id"), "description": g.get("description"), "priority": g.get("priority")}
        for g in raw_goals
        if isinstance(g, dict) and g.get("status", "active") == "active"
    ]
    if not active_goals:
        legacy_need = user.get("need") or user.get("profile", {}).get("need") or "Overall health and nutrition"
        active_goals = [{"id": "initial_need", "description": legacy_need, "priority": 1}]

    stated_need = " | ".join(g["description"] for g in active_goals)
    known_facts = {**(user.get("known_facts") or {}), **(user.get("profile") or {})}

    # Plan context
    try:
        plan = await generate_or_get_daily_plan(user_id, target_date)
        plan_data = {
            "date": plan.date,
            "daily_targets": plan.daily_targets.model_dump(),
            "meals": [m.model_dump() for m in plan.meals],
        }
    except Exception as exc:
        logger.warning("Could not load daily plan for Nutri: %s", exc)
        plan_data = {}

    # Tracking context
    try:
        tracking = await get_tracking_today(user_id, target_date)
        tracking_data = {
            "consumed": tracking.consumed.model_dump(),
            "remaining": tracking.remaining.model_dump(),
            "nutrition_score": tracking.nutrition_score,
            "plan_adherence": tracking.plan_adherence,
            "logs_today": [
                {
                    "meal_type": l.meal_type,
                    "food_description": l.food_description,
                    "nutrition": l.nutrition.model_dump(),
                }
                for l in tracking.logs
            ],
            "goal_status": tracking.goal_status.model_dump(),
            "streak": tracking.streak.current_streak,
        }
    except Exception as exc:
        logger.warning("Could not load tracking for Nutri: %s", exc)
        tracking_data = {}

    return {
        "user_profile": static_profile,
        "active_goals": active_goals,
        "primary_focus_summary": stated_need,
        "collected_facts_and_restrictions": known_facts,
        "today_date": target_date,
        "today_plan": plan_data,
        "today_tracking": tracking_data,
    }


async def review_logged_meal(
    user_id: str,
    food_description: str,
    meal_type: str,
    nutrition: MacroNutrition,
    date_str: str | None = None,
) -> str:
    """
    Generate an immediate, constructive Nutri review when a user logs food.
    """
    target_date = date_str or _get_today_date_str()
    context = await get_nutri_context(user_id, target_date)

    prompt = (
        f"The user just logged a meal.\n"
        f"Meal Type: {meal_type}\n"
        f"Food Description: {food_description}\n"
        f"Estimated Nutrition: {nutrition.model_dump()}\n\n"
        f"User Context:\n{json.dumps(context, indent=2)}\n\n"
        f"Generate a friendly 1-2 sentence review celebrating their food choice, "
        f"explaining what it contributes to today's goals, and warmly suggesting any nutrient focus for upcoming meals."
    )

    messages = [
        {"role": "system", "content": NUTRI_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    try:
        data = await chat_completion(messages, temperature=0.6, max_tokens=400)
        return data.get("message", f"Nice! That {meal_type.lower()} gives you good fuel towards today's targets. 🌱")
    except Exception as exc:
        logger.warning("Nutri meal review fallback: %s", exc)
        return f"Logged! 👍 That {meal_type.lower()} adds valuable nutrition to your day. Keep going strong! 💪"


async def interact_with_nutri(
    user_id: str,
    user_message: str,
    date_str: str | None = None,
) -> NutriInteractResponse:
    """
    Process user requests to Nutri — including conversational queries and dynamic plan modifications.
    """
    db = get_database()
    target_date = date_str or _get_today_date_str()
    now = datetime.now(timezone.utc)

    context = await get_nutri_context(user_id, target_date)

    # Fetch recent conversation
    history_cursor = db.nutri_history.find({"user_id": user_id}).sort("timestamp", -1).limit(6)
    recent = await history_cursor.to_list(length=6)
    recent.reverse()

    messages = [
        {"role": "system", "content": NUTRI_SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"CURRENT USER FACTUAL CONTEXT:\n{json.dumps(context, indent=2)}",
        },
    ]

    for msg in recent:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    messages.append({"role": "user", "content": user_message})

    # Record user message in DB
    await db.nutri_history.insert_one({
        "user_id": user_id,
        "role": "user",
        "content": user_message,
        "timestamp": now,
    })

    try:
        ai_data = await chat_completion(messages, temperature=0.6, max_tokens=1000)
    except Exception as exc:
        logger.error("Nutri interaction error: %s", exc)
        ai_data = {
            "message": "I'm right here with you! 😊 What would you like to adjust or check for today's meals?",
            "action": "none",
            "plan_modification": None,
        }

    message_text = ai_data.get("message", "I'm here to help you adjust your plan and stay nourished!")
    action = ai_data.get("action", "none")
    raw_mod = ai_data.get("plan_modification")

    plan_modified = False
    mod_detail = None
    updated_plan_response = None

    # Handle Plan Modification
    if action == "modify_plan" and raw_mod and isinstance(raw_mod, dict):
        try:
            target_meal_type = raw_mod.get("meal_type", "").lower()
            replacement_raw = raw_mod.get("replacement_meal", {})
            replacement_meal = MealItem(**replacement_raw)

            # Fetch existing plan document
            plan_doc = await db.daily_plans.find_one({"user_id": user_id, "date": target_date})
            if plan_doc:
                current_meals = plan_doc.get("meals", [])
                updated_meals = []
                replaced = False

                for m in current_meals:
                    m_type = m.get("meal_type", "").lower()
                    if m_type == target_meal_type and not replaced:
                        updated_meals.append(replacement_meal.model_dump())
                        replaced = True
                    else:
                        updated_meals.append(m)

                if not replaced:
                    updated_meals.append(replacement_meal.model_dump())

                # Store history and update active meals
                history_entry = {
                    "modified_at": now,
                    "meal_type": raw_mod.get("meal_type"),
                    "replacement": replacement_meal.model_dump(),
                    "reason": raw_mod.get("reason", ""),
                }

                await db.daily_plans.update_one(
                    {"user_id": user_id, "date": target_date},
                    {
                        "$set": {"meals": updated_meals, "updated_at": now},
                        "$push": {"modification_history": history_entry},
                    },
                )

                plan_modified = True
                mod_detail = PlanModificationDetail(
                    meal_type=raw_mod.get("meal_type", "Meal"),
                    original_meal_name=raw_mod.get("original_meal_name", ""),
                    replacement_meal=replacement_meal,
                    reason=raw_mod.get("reason", ""),
                )

                # Assemble updated plan response
                updated_plan_response = await generate_or_get_daily_plan(user_id, target_date)
        except Exception as err:
            logger.error("Failed to execute plan modification: %s", err)

    # Save Nutri reply in DB
    await db.nutri_history.insert_one({
        "user_id": user_id,
        "role": "assistant",
        "content": message_text,
        "action": action,
        "plan_modified": plan_modified,
        "timestamp": datetime.now(timezone.utc),
    })

    return NutriInteractResponse(
        message=message_text,
        action=action,
        plan_modified=plan_modified,
        plan_modification=mod_detail,
        updated_plan=updated_plan_response,
        timestamp=now,
    )
