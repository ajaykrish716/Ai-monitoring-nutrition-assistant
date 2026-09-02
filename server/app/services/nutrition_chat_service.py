"""
Dedicated AI Nutrition Mentor Chat service.

Answers user questions with authentic, dynamic context regarding their
profile, stated need, today's meal plan, today's activities, and today's tracked nutrition.
Also powers the friendly Nutri Dashboard Companion for feedback and affordable meal alternatives.
"""

import json
import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.schemas.chat import ChatMessageItem, ChatResponse, NutriFeedbackRequest, NutriFeedbackResponse
from app.services.ai_service import chat_completion
from app.services.daily_plan_service import generate_or_get_daily_plan
from app.services.tracking_service import get_tracking_today

logger = logging.getLogger(__name__)

CHAT_SYSTEM_PROMPT = """\
You are "Nutri", the friendly AI Nutrition Mentor & Personal Wellness Coach on NutriTrack.
Your mission is to provide empathetic, evidence-informed, and practical nutrition and lifestyle mentoring tailored to the user's specific context.

AUTHENTIC CONTEXT YOU HAVE ACCESS TO:
You are provided with the user's actual profile, their stated primary need, today's generated meal and activity plan, and their real-time logged foods and progress.

CRITICAL RULES:
1. GROUND YOUR ANSWERS IN THEIR ACTUAL CONTEXT:
   - When the user asks about today's breakfast, lunch, or dinner, refer to the actual meals in their plan.
   - When they ask about macro progress, refer to their real logged intake and remaining targets.
   - If they ask for food substitutions or alternatives (e.g. affordability, cultural familiarity, preferences), suggest options that respect their stated dietary restrictions, allergies, and daily targets.
   - Never invent or fabricate meal plans or logs if they are not in the context.

2. NUTRITIONAL SUCCESS OVER PLAN OBEDIENCE:
   - Always encourage the user when they eat healthy alternatives.
   - If a user cannot afford an ingredient (like salmon or organic berries), happily recommend accessible alternatives (eggs, lentils, canned tuna, local seasonal produce) that meet the same macro/micro goals.
   - Never shame the user or say they "failed".

3. SAFETY & SCOPE:
   - You are a nutrition and wellness mentor, NOT a medical diagnostic system.
   - Do NOT prescribe medications, diagnose clinical diseases, or make unverified medical claims.
   - For serious health conditions, surgeries, or medications, prioritize safety, respect clinician instructions, and recommend consulting their healthcare provider.

4. CONVERSATIONAL TONE:
   - Be supportive, clear, actionable, and encouraging.
   - Use emojis naturally (🌱, 💪, 🥗, ✨, 🍳).
"""

NUTRI_COMPANION_PROMPT = """\
You are "Nutri", the supportive, friendly AI dashboard companion.
Your goal is to provide a warm, encouraging 1-2 sentence response to user actions or help them find affordable/flexible food alternatives.

Tone:
- Warm, cheerful, encouraging, non-judgmental.
- Use emojis naturally (😊, 🥗, 💪, 🥑, ✨).
- Focus on nutritional success and practical choices.

Respond with valid JSON:
{
  "message": "Friendly encouraging text here",
  "suggested_alternatives": ["Alternative 1", "Alternative 2", "Alternative 3"]
}
"""


def _get_today_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def get_user_chat_context(user_id: str) -> dict:
    """
    Assemble compact, structured context for the chat agent.
    """
    db = get_database()
    today_str = _get_today_date_str()

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    static_profile = {
        "name": user.get("name", ""),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "height_cm": user.get("height"),
        "current_weight_kg": user.get("current_weight"),
    }
    stated_need = user.get("need", "")
    known_facts = user.get("known_facts", {})
    profile_summary = user.get("profile", {})
    all_facts = {**known_facts, **profile_summary}

    try:
        plan = await generate_or_get_daily_plan(user_id, today_str)
        daily_plan_context = {
            "summary": plan.summary,
            "daily_targets": plan.daily_targets.model_dump(),
            "meals": [m.model_dump() for m in plan.meals],
            "physical_activities": [a.model_dump() for a in plan.physical_activities],
        }
    except Exception as e:
        logger.warning("Could not fetch daily plan for chat context: %s", e)
        daily_plan_context = {}

    try:
        tracking = await get_tracking_today(user_id, today_str)
        tracking_context = {
            "consumed": tracking.consumed.model_dump(),
            "remaining": tracking.remaining.model_dump(),
            "nutrition_score": tracking.nutrition_score,
            "plan_adherence": tracking.plan_adherence,
            "logged_meals": [
                {
                    "meal_type": l.meal_type,
                    "food_description": l.food_description,
                    "nutrition": l.nutrition.model_dump(),
                }
                for l in tracking.logs
            ],
            "goal_status": tracking.goal_status.model_dump(),
            "current_streak": tracking.streak.current_streak,
        }
    except Exception as e:
        logger.warning("Could not fetch tracking for chat context: %s", e)
        tracking_context = {}

    return {
        "user_profile": static_profile,
        "user_stated_need": stated_need,
        "collected_personalization_facts": all_facts,
        "today_date": today_str,
        "today_meal_and_activity_plan": daily_plan_context,
        "today_tracking_and_progress": tracking_context,
    }


async def send_chat_message(user_id: str, user_message: str) -> ChatResponse:
    """
    Process a user message with full authenticated context and return the assistant reply.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    context = await get_user_chat_context(user_id)

    history_cursor = db.chat_history.find({"user_id": user_id}).sort("timestamp", -1).limit(10)
    recent_history = await history_cursor.to_list(length=10)
    recent_history.reverse()

    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"CURRENT AUTHENTICATED USER CONTEXT (USE THIS FACTUAL DATA):\n{json.dumps(context, indent=2)}",
        },
    ]

    for msg in recent_history:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    messages.append({
        "role": "user",
        "content": user_message,
    })

    user_msg_doc = {
        "user_id": user_id,
        "role": "user",
        "content": user_message,
        "timestamp": now,
    }
    await db.chat_history.insert_one(user_msg_doc)

    try:
        from app.core.config import get_settings
        import httpx

        settings = get_settings()
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured.")

        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.openrouter_model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 1000,
        }
        url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()

        data = resp.json()
        reply_content = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.error("Chat completion error: %s", exc)
        reply_content = (
            "I'm here with you! 😊 I had a slight connection blip, but remember you're making steady progress today. "
            "Feel free to ask again about meal swaps or macro adjustments."
        )

    assistant_now = datetime.now(timezone.utc)
    assistant_msg_doc = {
        "user_id": user_id,
        "role": "assistant",
        "content": reply_content,
        "timestamp": assistant_now,
    }
    res = await db.chat_history.insert_one(assistant_msg_doc)

    return ChatResponse(
        id=str(res.inserted_id),
        role="assistant",
        content=reply_content,
        timestamp=assistant_now,
    )


async def get_nutri_companion_feedback(user_id: str, req: NutriFeedbackRequest) -> NutriFeedbackResponse:
    """
    Generate instant friendly feedback or meal alternative suggestions for the dashboard widget.
    """
    context = await get_user_chat_context(user_id)

    prompt_content = f"User Action: {req.action}\nDetails: {req.context_item or 'Checking in on dashboard'}\nUser Context:\n{json.dumps(context, indent=2)}"
    messages = [
        {"role": "system", "content": NUTRI_COMPANION_PROMPT},
        {"role": "user", "content": prompt_content},
    ]

    try:
        ai_data = await chat_completion(messages, temperature=0.7, max_tokens=400)
        msg = ai_data.get("message", "Looking great today! Keep nourishing your body with what fits your lifestyle. 🌱")
        alts = ai_data.get("suggested_alternatives", [])
    except Exception as exc:
        logger.warning("Nutri companion fallback: %s", exc)
        msg = "You're on track! 🌱 Remember, any wholesome alternative that fits your budget and lifestyle is a win."
        alts = ["Eggs or Tofu for affordable protein", "Lentils/Dal with rice", "Seasonal local veggies & fruits"]

    return NutriFeedbackResponse(
        message=msg,
        suggested_alternatives=alts,
        action=req.action,
    )


async def get_chat_history(user_id: str, limit: int = 50) -> list[ChatMessageItem]:
    """Retrieve chat history for the authenticated user."""
    db = get_database()
    cursor = db.chat_history.find({"user_id": user_id}).sort("timestamp", 1).limit(limit)
    messages = await cursor.to_list(length=limit)

    return [
        ChatMessageItem(
            id=str(m["_id"]),
            role=m.get("role", "user"),
            content=m.get("content", ""),
            timestamp=m.get("timestamp", datetime.now(timezone.utc)),
        )
        for m in messages
    ]


async def clear_chat_history(user_id: str) -> bool:
    """Clear all chat history for the authenticated user."""
    db = get_database()
    await db.chat_history.delete_many({"user_id": user_id})
    return True
