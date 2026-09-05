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
from app.services.meal_schedule_service import get_daily_meal_timing

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

5. MEAL TIMING & EMPATHY (NEVER FORCE FOOD):
   - You understand meal schedules (Breakfast, Lunch, Dinner) and timing windows.
   - If user logs on time, celebrate their consistency.
   - If user logs late, warmly reassure them (e.g. "You're a little late today, but that's okay 😊 You got your meal in and we can keep the rest of the day on track!").
   - If a meal window has ended or the user says "I'm not hungry", "I skipped breakfast", "I don't want this meal", or "I'll eat later": NEVER shame, guilt, or force food.
   - Warmly reassure the user ("No worries — let's focus on making the rest of today's nutrition count. 💚") and help them adapt remaining meals to comfortably hit their targets.

6. TONE & FORMAT:
   - Warm, encouraging, concise, supportive, and natural with friendly emojis (🌱, 💪, 🥗, ✨, 🍳).

7. CONVERSATIONAL MEMORY & PAST CHAT RECALL:
   - You have full conversational memory of the user's ongoing and past interactions.
   - When the user asks questions referring to past conversations, previous questions ("What did I ask before?", "What did you suggest yesterday?", "Do you remember my budget limit?"), or past recommendations, seamlessly consult the provided past conversation memory and notes to answer accurately and personally.

8. DIVERSE & VARIED DIET PLANS (NEVER REPETITIVE):
   - When the user asks for a diet plan, meal ideas, or explicitly says "give diet plan not the same diet plan" / "give me something different":
   - NEVER repeat the exact same dishes or stereotypical meals.
   - Offer exciting, varied, flavorful dishes (e.g., Mediterranean bowls, Asian stir-fries, savory frittatas, lentil dal, cottage cheese/paneer bowls, whole-grain wraps, nourishing soups).
   - If the user wants to update today's plan with a new varied meal, set action="modify_plan" and specify the replacement meal, or describe the full varied 3-meal plan clearly.

9. CLEAN TEXT & POLISHED OUTPUT (GEMINI QUALITY):
   - Your response "message" should be crisp, fluid, well-spaced, and clean.
   - Use clean markdown (clear bolding, bullet points, headers).
   - Never output raw unescaped JSON strings, double backslashes, or markdown syntax artifacts inside the message.

RESPONSE FORMAT (JSON ONLY):
{
  "message": "Friendly conversational message to user",
  "action": "none" | "modify_plan" | "regenerate_plan" | "review_meal" | "guidance" | "goal_update",
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
  },
  "memory_update": {
    "category": "preferences" | "restrictions" | "important_context",
    "note": "Short key point to remember about user preferences/habits (or null)"
  }
}
* Note: If no plan modification is needed, set "action": "none" and "plan_modification": null.
* Note: If no new persistent fact is learned, set "memory_update": null.
"""


def _get_today_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def append_nutri_memory(user_id: str, category: str, note: str) -> None:
    """Store a compact key memory note for Nutri (capped to 10 per category)."""
    valid_categories = ("preferences", "restrictions", "meaningful_decisions", "important_context")
    if category not in valid_categories or not note or not note.strip():
        return
    db = get_database()
    clean_note = note.strip()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {f"nutri_memory.{category}": clean_note}},
    )
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {f"nutri_memory.{category}": 1})
    if user:
        items = user.get("nutri_memory", {}).get(category, [])
        if len(items) > 10:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {f"nutri_memory.{category}": items[-10:]}},
            )


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

    # Meal timing context
    try:
        timing_resp = await get_daily_meal_timing(user_id, target_date)
        meal_timing_data = {
            "timezone": timing_resp.timezone,
            "meals": [
                {
                    "meal_type": m.meal_type,
                    "window_start": m.window_start,
                    "window_end": m.window_end,
                    "state": m.state,
                    "is_logged": m.is_logged,
                    "timing_score": m.timing_score,
                    "message": m.message,
                }
                for m in timing_resp.meals
            ],
        }
    except Exception as exc:
        logger.warning("Could not load meal timing for Nutri: %s", exc)
        meal_timing_data = {}

    nutri_mem = user.get("nutri_memory") or {
        "preferences": [],
        "restrictions": [],
        "meaningful_decisions": [],
        "important_context": [],
    }

    return {
        "user_profile": static_profile,
        "active_goals": active_goals,
        "primary_focus_summary": stated_need,
        "collected_facts_and_restrictions": known_facts,
        "compact_nutri_memory": nutri_mem,
        "today_date": target_date,
        "today_plan": plan_data,
        "today_tracking": tracking_data,
        "today_meal_timing": meal_timing_data,
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


async def get_user_conversations(user_id: str) -> list[dict]:
    """Retrieve list of distinct chat conversations for user, sorted by recency."""
    db = get_database()
    cursor = db.nutri_conversations.find({"user_id": user_id}).sort("updated_at", -1)
    convs = await cursor.to_list(length=50)

    # If no conversation records exist yet, check if there is existing history to group
    if not convs:
        oldest_msg = await db.nutri_history.find_one({"user_id": user_id}, sort=[("timestamp", 1)])
        if oldest_msg:
            first_user_msg = await db.nutri_history.find_one({"user_id": user_id, "role": "user"}, sort=[("timestamp", 1)])
            initial_title = (first_user_msg.get("content", "General Guidance")[:35] + "...") if first_user_msg else "Nutrition Chat"
            now = datetime.now(timezone.utc)
            new_conv = {
                "user_id": user_id,
                "title": initial_title,
                "created_at": oldest_msg.get("timestamp", now),
                "updated_at": now,
            }
            res = await db.nutri_conversations.insert_one(new_conv)
            cid = str(res.inserted_id)
            await db.nutri_history.update_many(
                {"user_id": user_id, "conversation_id": {"$exists": False}},
                {"$set": {"conversation_id": cid}},
            )
            new_conv["_id"] = res.inserted_id
            convs = [new_conv]

    return [
        {
            "id": str(c["_id"]),
            "title": c.get("title", "Nutrition Chat"),
            "created_at": c.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(c.get("created_at"), "isoformat") else str(c.get("created_at")),
            "updated_at": c.get("updated_at", datetime.now(timezone.utc)).isoformat() if hasattr(c.get("updated_at"), "isoformat") else str(c.get("updated_at")),
        }
        for c in convs
    ]


async def create_user_conversation(user_id: str, title: str = "New Chat") -> dict:
    """Create a new conversation session for user."""
    db = get_database()
    now = datetime.now(timezone.utc)
    conv_doc = {
        "user_id": user_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.nutri_conversations.insert_one(conv_doc)
    return {
        "id": str(res.inserted_id),
        "title": title,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }


async def delete_user_conversation(user_id: str, conv_id: str) -> bool:
    """Delete a conversation and all its associated messages."""
    db = get_database()
    try:
        oid = ObjectId(conv_id)
    except Exception:
        return False
    res = await db.nutri_conversations.delete_one({"_id": oid, "user_id": user_id})
    if res.deleted_count > 0:
        await db.nutri_history.delete_many({"user_id": user_id, "conversation_id": conv_id})
        return True
    return False


def _clean_chat_text(text: str) -> str:
    """Clean markdown and special character artifacts from assistant response."""
    if not text:
        return ""
    import re
    # Normalize escaped characters
    cleaned = text.replace("\\n", "\n").replace('\\"', '"').replace("\\'", "'")
    cleaned = cleaned.strip()
    # If text is wrapped in quotes, strip them
    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1].strip()
    # Strip markdown codeblock if the whole text was wrapped in ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:markdown|text|json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


async def interact_with_nutri(
    user_id: str,
    user_message: str,
    date_str: str | None = None,
    conversation_id: str | None = None,
) -> NutriInteractResponse:
    """
    Process user requests to Nutri — including conversational queries and dynamic plan modifications.
    """
    db = get_database()
    target_date = date_str or _get_today_date_str()
    now = datetime.now(timezone.utc)

    # Resolve or create conversation
    active_conv = None
    if conversation_id:
        try:
            active_conv = await db.nutri_conversations.find_one({"_id": ObjectId(conversation_id), "user_id": user_id})
        except Exception:
            active_conv = None

    if not active_conv:
        title_snippet = user_message[:35].strip() or "Nutrition Chat"
        created = await create_user_conversation(user_id, title=title_snippet)
        conversation_id = created["id"]
    else:
        conversation_id = str(active_conv["_id"])
        if active_conv.get("title") in ("New Chat", "Nutrition Chat"):
            title_snippet = user_message[:35].strip()
            await db.nutri_conversations.update_one(
                {"_id": active_conv["_id"]},
                {"$set": {"title": title_snippet, "updated_at": now}},
            )
        else:
            await db.nutri_conversations.update_one(
                {"_id": active_conv["_id"]},
                {"$set": {"updated_at": now}},
            )

    context = await get_nutri_context(user_id, target_date)

    # Fetch recent conversation within this session (expanded to 16 for rich continuity)
    history_cursor = db.nutri_history.find(
        {"user_id": user_id, "conversation_id": conversation_id}
    ).sort("timestamp", -1).limit(16)
    recent = await history_cursor.to_list(length=16)
    recent.reverse()

    # Fetch cross-session past messages from other conversations for historical memory recall
    past_memory_snippets = []
    try:
        past_cursor = db.nutri_history.find(
            {"user_id": user_id, "conversation_id": {"$ne": conversation_id}}
        ).sort("timestamp", -1).limit(12)
        past_docs = await past_cursor.to_list(length=12)
        past_docs.reverse()
        for p in past_docs:
            role = p.get("role", "user")
            content = (p.get("content") or "").strip()
            if content:
                snippet = content[:150] + ("..." if len(content) > 150 else "")
                past_memory_snippets.append(f"{role.capitalize()}: {snippet}")
    except Exception as exc:
        logger.warning("Could not fetch cross-session memory snippets: %s", exc)

    messages = [
        {"role": "system", "content": NUTRI_SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"CURRENT USER FACTUAL CONTEXT:\n{json.dumps(context, indent=2)}",
        },
    ]

    if past_memory_snippets:
        messages.append({
            "role": "system",
            "content": (
                "HISTORICAL CROSS-SESSION USER MEMORY (Prior conversations & queries):\n"
                + "\n".join(f"- {s}" for s in past_memory_snippets)
                + "\nNote: If the user asks about previous chats, questions, or past foods they discussed, reference this context accurately!"
            ),
        })

    for msg in recent:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    messages.append({"role": "user", "content": user_message})

    # Record user message in DB
    await db.nutri_history.insert_one({
        "user_id": user_id,
        "conversation_id": conversation_id,
        "role": "user",
        "content": user_message,
        "timestamp": now,
    })

    try:
        ai_data = await chat_completion(messages, temperature=0.7, max_tokens=1200)
    except Exception as exc:
        logger.error("Nutri interaction error: %s", exc)
        ai_data = {
            "message": "I'm right here with you! 😊 What would you like to adjust or check for today's meals?",
            "action": "none",
            "plan_modification": None,
        }

    message_text = _clean_chat_text(ai_data.get("message", "I'm here to help you adjust your plan and stay nourished!"))
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

                # Record decision in compact Nutri memory
                decision_note = f"On {target_date}, modified {mod_detail.meal_type} to '{mod_detail.replacement_meal.name}' ({mod_detail.reason})"
                await append_nutri_memory(user_id, "meaningful_decisions", decision_note)

                # Assemble updated plan response
                updated_plan_response = await generate_or_get_daily_plan(user_id, target_date)
        except Exception as err:
            logger.error("Failed to execute plan modification: %s", err)
    elif action == "regenerate_plan":
        try:
            updated_plan_response = await generate_or_get_daily_plan(user_id, target_date, force_regenerate=True)
            plan_modified = True
            mod_detail = PlanModificationDetail(
                meal_type="All Meals",
                original_meal_name="Previous Plan",
                replacement_meal=updated_plan_response.meals[0] if updated_plan_response.meals else None,
                reason="Regenerated full daily plan with fresh culinary variety",
            )
            decision_note = f"On {target_date}, regenerated full daily plan for variety"
            await append_nutri_memory(user_id, "meaningful_decisions", decision_note)
        except Exception as err:
            logger.error("Failed to regenerate plan: %s", err)

    # Save any new compact memory facts learned
    raw_mem = ai_data.get("memory_update")
    if isinstance(raw_mem, dict):
        mem_cat = str(raw_mem.get("category", "")).lower()
        mem_note = str(raw_mem.get("note", "")).strip()
        if mem_cat in ("preferences", "restrictions", "important_context") and mem_note:
            await append_nutri_memory(user_id, mem_cat, mem_note)

    # Save Nutri reply in DB
    await db.nutri_history.insert_one({
        "user_id": user_id,
        "conversation_id": conversation_id,
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
        conversation_id=conversation_id,
        timestamp=now,
    )


async def get_user_chat_history(user_id: str, conversation_id: str | None = None, limit: int = 50) -> list[dict]:
    """
    Retrieve persistent chat history for the user from MongoDB.
    Returned in chronological order.
    """
    db = get_database()
    query = {"user_id": user_id}
    if conversation_id:
        query["conversation_id"] = conversation_id
    else:
        # Find latest active conversation
        latest_conv = await db.nutri_conversations.find_one({"user_id": user_id}, sort=[("updated_at", -1)])
        if latest_conv:
            query["conversation_id"] = str(latest_conv["_id"])

    cursor = db.nutri_history.find(query).sort("timestamp", 1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [
        {
            "id": str(d["_id"]),
            "role": d.get("role", "assistant"),
            "content": d.get("content", ""),
            "action": d.get("action", "none"),
            "plan_modified": d.get("plan_modified", False),
            "conversation_id": d.get("conversation_id"),
            "timestamp": (
                d.get("timestamp").isoformat()
                if hasattr(d.get("timestamp"), "isoformat")
                else str(d.get("timestamp", ""))
            ),
        }
        for d in docs
    ]
