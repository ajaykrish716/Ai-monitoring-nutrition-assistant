"""
Dedicated Nutri AI Companion Service — v2 (context-aware, intent-driven).

Nutri is the user's ongoing nutrition partner:
- Handles greetings, casual conversation, and short messages naturally.
- Understands user intent from context, not just keywords.
- Provides contextual quick-action suggestions after each response.
- Dynamically modifies today's daily meal plan when requested.
- Strictly respects allergies, medical context, and user targets.
- Maintains conversation context so follow-ups like "yes", "change it", "something cheaper" work.
"""

import json
import logging
import re
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.schemas.daily_plan import DailyPlanResponse, MealItem, MacroNutrition
from app.schemas.nutri import (
    NutriInteractResponse,
    NutriSuggestion,
    PlanModificationDetail,
)
from app.services.ai_service import chat_completion
from app.services.daily_plan_service import generate_or_get_daily_plan
from app.services.tracking_service import get_tracking_today
from app.services.meal_schedule_service import get_daily_meal_timing

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System Prompt — Context-Aware AI Nutrition Companion
# ---------------------------------------------------------------------------

NUTRI_SYSTEM_PROMPT = """\
You are "Nutri", the user's dedicated, friendly AI Nutrition Companion & Personal Wellness Partner on NutriTrack.

═══════════════════════════════════════════════════════════
PERSONA & MISSION
═══════════════════════════════════════════════════════════
You are NOT a generic chatbot. You are the user's personal nutrition companion who:
- Knows their name, goals, current meal plan, and daily tracking data.
- Understands casual conversation, greetings, short messages, and follow-ups.
- Remembers the context of the current conversation to handle follow-ups naturally.
- Stays focused on nutrition, meals, health, and wellness (but handles off-topic messages gracefully).

═══════════════════════════════════════════════════════════
INTENT CLASSIFICATION (ALWAYS classify the user's message)
═══════════════════════════════════════════════════════════
Classify the user's message into exactly ONE intent from this list:
- greeting          (hi, hello, hey, good morning/evening/night, how are you)
- farewell          (bye, see you, goodbye, take care)
- thanks            (thanks, thank you, great, awesome, perfect)
- confirmation      (yes, yeah, sure, okay, ok, go ahead, do it, confirm, replace)
- rejection         (no, nope, cancel, never mind, don't, skip it)
- meal_query        (show breakfast/lunch/dinner, what's for X, today's meals, what should I eat)
- meal_change       (change X, replace X, I don't like X, give me something else, vegetarian, cheaper)
- meal_record       (I ate X, I had X, mark X, I finished X, record X, I completed X)
- plan_query        (show my plan, today's plan, what should I eat today, full plan)
- progress_query    (how am I doing, my progress, calories, protein, water, streak, how much have I eaten)
- nutrition_query   (protein info, calories in X, is X healthy, what can I eat for X, nutrition advice)
- water_query       (water, how much water, water progress, have I drunk enough water)
- streak_query      (streak, my streak, consecutive days, longest streak)
- goal_query        (my goals, what are my goals, goal progress, update goal)
- general_nutrition_chat (general nutrition/health questions related to food/diet/wellness)
- unrelated         (questions completely unrelated to food, nutrition, health, fitness)
- inappropriate     (rude, offensive, or harmful messages)
- unclear           (gibberish, random letters, meaningless text)
- unclear_followup  (very short message like "it", "that", "the second one" — requires conversation context)

═══════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════

1. USE THE USER'S REAL NAME — Always address the user by their actual name from the context.
   NEVER hardcode names. The name comes from user_profile.name in the context.

2. CONTEXT-AWARE FOLLOW-UPS — Always check recent conversation history.
   If user says "yes", "change it", "something cheaper", "the second one" — understand what they refer to.
   Use the last few messages to determine the subject.

3. USE REAL DATA — Never invent meal names, nutrition values, or progress numbers.
   Always use the actual data from the context provided.
   If data is unavailable, say so honestly.

4. SHORT MESSAGE UNDERSTANDING — Short messages like "breakfast", "water", "progress" are NOT unclear.
   Interpret them as meal_query, water_query, progress_query respectively.

5. NEVER SHAME — Never say the user failed, is behind, or is doing badly.
   Always encourage and support.

6. PLAN MODIFICATION REQUIRES CONFIRMATION — If the user wants to change a meal,
   suggest an alternative first and ask "Would you like me to replace your [meal]?"
   Only set action="modify_plan" when the user has CONFIRMED (intent=confirmation after a suggestion).
   Exception: if the user explicitly says "change NOW" or "replace immediately" — go ahead.

7. UNRELATED QUESTIONS — Politely redirect to nutrition topics.
   Do NOT answer general knowledge questions (geography, history, celebrities, etc.)

8. GIBBERISH / UNCLEAR — Respond warmly and show what Nutri can help with.

9. INAPPROPRIATE — Respond professionally and briefly. Do NOT engage with the content.

10. SUGGESTIONS — Always include 2–4 contextual quick-action suggestions.

═══════════════════════════════════════════════════════════
GREETING RESPONSES
═══════════════════════════════════════════════════════════
For greetings, use the user's actual name and time-appropriate greeting.
Examples:
- "Hi" / "Hello" / "Hey" → Warm welcome using their name, offer to help with meals/progress.
- "Good morning" → Morning energy, mention their breakfast plan if available.
- "Good afternoon" → Mention lunch status.
- "Good evening" / "Good night" → Mention dinner or today's progress summary.
- "How are you?" → Brief friendly response, pivot to how THEY are doing nutrition-wise.

═══════════════════════════════════════════════════════════
MEAL QUERY RESPONSES
═══════════════════════════════════════════════════════════
For breakfast/lunch/dinner queries, show:
- Meal name (from today's plan)
- Recommended time window
- Key nutrition (calories, protein)
- Status (logged or not)
Then offer action suggestions: View Details / Change Meal / Record Meal

═══════════════════════════════════════════════════════════
PROGRESS QUERY RESPONSES
═══════════════════════════════════════════════════════════
For progress queries, show:
- Calories consumed vs target
- Protein consumed vs target
- Water consumed vs target
- Meals completed (Breakfast ✓/○, Lunch ✓/○, Dinner ✓/○)
- Completion percentage
- Current streak
Use actual numbers. Never invent them.

═══════════════════════════════════════════════════════════
MEAL CHANGE FLOW (IMPORTANT)
═══════════════════════════════════════════════════════════
Step 1: User asks to change a meal → suggest an alternative meal with details, ask for confirmation.
Step 2: User confirms → set action="modify_plan" and provide the replacement_meal in plan_modification.
Step 3: If user wants another option → suggest a different alternative.

NEVER set action="modify_plan" without user confirmation UNLESS the user explicitly says something like:
"replace my lunch right now", "immediately change", "do it now".

═══════════════════════════════════════════════════════════
CORE PHILOSOPHY
═══════════════════════════════════════════════════════════
1. UNDERSTAND MULTIPLE ACTIVE GOALS — Balance all active goals warmly.
2. NUTRITIONAL SUCCESS OVER RECIPE OBEDIENCE — Any wholesome food that meets nutritional needs is a win.
3. DYNAMIC PLAN MODIFICATION — Generate structured replacement meals maintaining nutritional targets.
4. SAFETY & ALLERGIES — NEVER suggest foods with recorded allergies or restrictions.
5. MEAL TIMING & EMPATHY — If a meal was missed, reassure and help adapt remaining meals.
6. TONE — Warm, encouraging, concise, supportive, with friendly emojis (🌱, 💪, 🥗, ✨, 🍳).
7. DIVERSE DIET PLANS — When suggesting plans, offer varied, exciting meals (not the same ones repeatedly).
8. CONVERSATIONAL MEMORY — Use recent conversation history to understand follow-ups naturally.

═══════════════════════════════════════════════════════════
RESPONSE FORMAT (JSON ONLY — no markdown outside the "message" field)
═══════════════════════════════════════════════════════════
{
  "message": "Friendly conversational message (can use markdown: **bold**, *italic*, bullet lists)",
  "intent": "<one of the intent names listed above>",
  "action": "none" | "modify_plan" | "regenerate_plan" | "review_meal" | "guidance" | "goal_update",
  "plan_modification": {
    "meal_type": "Lunch",
    "original_meal_name": "Grilled Salmon Quinoa Bowl",
    "replacement_meal": {
      "meal_type": "Lunch",
      "name": "Affordable Lentil Dal & Brown Rice Power Bowl",
      "foods": ["Cooked lentils (dal)", "Brown rice", "Spinach", "Spices"],
      "portion_information": "1.5 cups dal, 1 cup rice, sautéed greens",
      "nutrition": {"calories": 520.0, "protein": 28.0, "carbohydrates": 75.0, "fat": 10.0},
      "notes": "Budget-friendly, high-fiber, rich in plant protein."
    },
    "reason": "Replaced salmon with protein-rich lentils and brown rice to match budget and keep macros balanced."
  },
  "suggestions": [
    {"label": "🍳 Breakfast", "text": "Show me today's breakfast"},
    {"label": "📊 Progress", "text": "How am I doing today?"},
    {"label": "🔄 Change Lunch", "text": "I want to change today's lunch"},
    {"label": "💧 Water", "text": "How much water have I had?"}
  ],
  "memory_update": {
    "category": "preferences" | "restrictions" | "important_context",
    "note": "Short key point to remember about user preferences/habits (or null)"
  }
}

RULES FOR SUGGESTIONS:
- Always include 2–4 suggestions.
- Make suggestions CONTEXTUAL to what just happened.
- After showing breakfast → suggest Change Breakfast, Record Breakfast, Show Lunch, Progress.
- After showing progress → suggest Show Plan, Breakfast, Lunch, Dinner.
- After a greeting → suggest Breakfast, Lunch, Dinner, Today's Progress.
- After a plan change → suggest Show Updated Plan, Progress, Regenerate Plan.
- After farewell/thanks → suggest Today's Progress, Show Plan, Water.

RULES FOR plan_modification:
- Only include plan_modification when action is "modify_plan".
- If action is "none", set plan_modification to null.

RULES FOR memory_update:
- Only include when you learn something NEW about the user's preferences/restrictions.
- Otherwise set to null.
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
            "longest_streak": tracking.streak.longest_streak if hasattr(tracking.streak, "longest_streak") else 0,
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
        f"\n\nRespond ONLY with JSON: {{\"message\": \"your review text here\"}}"
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


def _default_suggestions_for_intent(intent: str) -> list[dict]:
    """Return sensible default suggestions if the AI doesn't provide them."""
    base = [
        {"label": "🍳 Breakfast", "text": "Show me today's breakfast"},
        {"label": "🍛 Lunch", "text": "What's for lunch today?"},
        {"label": "🍽️ Dinner", "text": "What's for dinner tonight?"},
        {"label": "📊 Progress", "text": "How am I doing today?"},
    ]
    meal_change_suggestions = [
        {"label": "💰 Something cheaper", "text": "I need a more affordable option"},
        {"label": "🥗 Vegetarian", "text": "I want a vegetarian alternative"},
        {"label": "⚡ Quick to prepare", "text": "I need something quick to make"},
        {"label": "🔄 Another option", "text": "Show me another alternative"},
    ]
    progress_suggestions = [
        {"label": "🍳 Breakfast", "text": "Show me today's breakfast"},
        {"label": "🍛 Lunch", "text": "What's for lunch?"},
        {"label": "📋 Today's Plan", "text": "Show my full nutrition plan"},
        {"label": "💧 Water", "text": "How much water have I had?"},
    ]
    mapping = {
        "greeting": base,
        "farewell": [
            {"label": "📊 Today's Progress", "text": "How am I doing today?"},
            {"label": "📋 Show Plan", "text": "Show my nutrition plan"},
            {"label": "💧 Water", "text": "How much water have I had?"},
        ],
        "thanks": [
            {"label": "📊 Progress", "text": "How am I doing today?"},
            {"label": "🍽️ Dinner", "text": "What's for dinner tonight?"},
            {"label": "📋 Show Plan", "text": "Show my nutrition plan"},
        ],
        "meal_query": [
            {"label": "🔄 Change Meal", "text": "I want to change this meal"},
            {"label": "📸 Record Meal", "text": "I already ate this meal"},
            {"label": "📊 Today's Progress", "text": "How am I doing today?"},
        ],
        "meal_change": meal_change_suggestions,
        "confirmation": base,
        "rejection": meal_change_suggestions,
        "progress_query": progress_suggestions,
        "water_query": [
            {"label": "📊 Full Progress", "text": "Show my full progress today"},
            {"label": "🍽️ Dinner", "text": "What's for dinner tonight?"},
            {"label": "📋 Show Plan", "text": "Show my nutrition plan"},
        ],
        "streak_query": [
            {"label": "📊 Today's Progress", "text": "How am I doing today?"},
            {"label": "🍽️ Dinner", "text": "What's for dinner tonight?"},
        ],
        "plan_query": [
            {"label": "🍳 Change Breakfast", "text": "I want to change today's breakfast"},
            {"label": "🍛 Change Lunch", "text": "I want to change today's lunch"},
            {"label": "🍽️ Change Dinner", "text": "I want to change tonight's dinner"},
            {"label": "📊 Today's Progress", "text": "How am I doing today?"},
        ],
        "meal_record": [
            {"label": "📊 Updated Progress", "text": "How am I doing today?"},
            {"label": "🍽️ Dinner", "text": "What's for dinner tonight?"},
        ],
        "nutrition_query": [
            {"label": "📊 Today's Progress", "text": "How am I doing today?"},
            {"label": "🍳 Breakfast", "text": "Show me today's breakfast"},
            {"label": "🍛 Lunch", "text": "What's for lunch?"},
        ],
        "unrelated": base,
        "inappropriate": base,
        "unclear": base,
        "unclear_followup": base,
    }
    return mapping.get(intent, base)


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

    # Fetch recent conversation within this session (expanded to 20 for rich continuity)
    history_cursor = db.nutri_history.find(
        {"user_id": user_id, "conversation_id": conversation_id}
    ).sort("timestamp", -1).limit(20)
    recent = await history_cursor.to_list(length=20)
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
            "content": f"CURRENT USER FACTUAL CONTEXT (use this real data in all responses):\n{json.dumps(context, indent=2)}",
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
        ai_data = await chat_completion(messages, temperature=0.7, max_tokens=1400)
    except Exception as exc:
        logger.error("Nutri interaction error: %s", exc)
        # User-friendly fallback — never expose technical errors
        user_name = context.get("user_profile", {}).get("name", "")
        name_part = f", {user_name.split()[0]}" if user_name else ""
        ai_data = {
            "message": (
                f"Sorry{name_part}, I'm having a bit of trouble connecting right now. 😅\n\n"
                "You can still check today's meals and progress from your dashboard. "
                "Please try again in a moment!"
            ),
            "intent": "general_nutrition_chat",
            "action": "none",
            "plan_modification": None,
            "suggestions": [
                {"label": "🍳 Breakfast", "text": "Show me today's breakfast"},
                {"label": "🍛 Lunch", "text": "What's for lunch today?"},
                {"label": "📊 Progress", "text": "How am I doing today?"},
            ],
        }

    message_text = _clean_chat_text(ai_data.get("message", "I'm here to help you stay on track! 😊 What would you like to check?"))
    action = ai_data.get("action", "none")
    intent = ai_data.get("intent", "general_nutrition_chat")
    raw_mod = ai_data.get("plan_modification")

    # Parse suggestions from AI response (or fall back to context-aware defaults)
    raw_suggestions = ai_data.get("suggestions", [])
    suggestions = []
    if isinstance(raw_suggestions, list):
        for s in raw_suggestions[:4]:  # cap at 4
            if isinstance(s, dict) and s.get("label") and s.get("text"):
                suggestions.append(NutriSuggestion(label=str(s["label"]), text=str(s["text"])))
    if not suggestions:
        for s in _default_suggestions_for_intent(intent):
            suggestions.append(NutriSuggestion(label=s["label"], text=s["text"]))

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
        "intent": intent,
        "plan_modified": plan_modified,
        "timestamp": datetime.now(timezone.utc),
    })

    return NutriInteractResponse(
        message=message_text,
        action=action,
        intent=intent,
        plan_modified=plan_modified,
        plan_modification=mod_detail,
        updated_plan=updated_plan_response,
        conversation_id=conversation_id,
        timestamp=now,
        suggestions=suggestions,
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
            "intent": d.get("intent", "general_nutrition_chat"),
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
