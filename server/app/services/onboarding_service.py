"""
AI-driven onboarding service.

This module orchestrates the conversation between the user and the AI.
It maintains state in MongoDB and delegates question generation entirely
to the AI — no hard-coded questions, branching, or field assumptions.

The system prompt tells the AI *how to structure* its responses,
NOT *what to ask*. The AI decides what information is relevant based
on the user's stated need.
"""

import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.services.ai_service import AIServiceError, chat_completion

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — instructs the AI on output format, NOT on content
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a nutrition and wellness onboarding assistant. Your job is to
understand the user's needs and collect relevant information through a
conversational questionnaire — one question at a time.

RULES:
1. Ask ONE question at a time.
2. Decide dynamically what to ask based on the user's stated need and
   previous answers. Do NOT follow a fixed script.
3. Only collect information that is genuinely useful for the user's
   specific situation. Different needs require different information.
4. When you have gathered enough information to build a useful profile,
   signal completion.
5. Keep questions concise and friendly.

You MUST respond with valid JSON in this exact structure:

When asking a question:
{
  "type": "<control_type>",
  "text": "<question text>",
  "field": "<short_snake_case_field_name>",
  "options": ["option1", "option2", ...] or null,
  "is_complete": false,
  "summary": null
}

control_type must be one of:
- "text" (short free-text)
- "number" (numeric value)
- "textarea" (long free-text)
- "single_select" (pick one from options list — you MUST provide options)
- "multi_select" (pick multiple from options list — you MUST provide options)

When onboarding is complete:
{
  "type": "complete",
  "text": "<brief congratulatory message>",
  "field": "",
  "options": null,
  "is_complete": true,
  "summary": {
    <key>: <value>,
    ...all collected profile data as a flat dictionary...
  }
}

The summary must contain ALL information gathered during the conversation
as a flat key-value dictionary with snake_case keys.

IMPORTANT:
- Respond ONLY with the JSON object. No extra text.
- Do NOT wrap the JSON in markdown code fences.
- Adapt your questions to the user's specific situation.
- Do not ask for information the user has already provided.
- Typically 5-10 questions is sufficient, but use your judgment.
"""


def _build_conversation_messages(
    user_name: str,
    conversation_history: list[dict],
) -> list[dict]:
    """
    Build the OpenAI-compatible message list from stored conversation
    history plus the system prompt.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Initial user context
    messages.append({
        "role": "user",
        "content": (
            f"My name is {user_name}. I'd like help with my nutrition "
            f"and wellness. Please start the onboarding by asking your "
            f"first question."
        ),
    })

    # Replay conversation history
    for turn in conversation_history:
        if turn.get("role") == "assistant":
            messages.append({"role": "assistant", "content": turn["content"]})
        elif turn.get("role") == "user":
            messages.append({"role": "user", "content": turn["content"]})

    return messages


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def start_onboarding(user_id: str) -> dict:
    """
    Begin the onboarding conversation. Returns the first AI question.

    If onboarding was already started, returns the current state.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise ValueError("User not found")

    # If already complete, return that state
    if user.get("onboarding_complete", False):
        return {
            "is_complete": True,
            "questions_answered": len(user.get("conversation_history", [])) // 2,
            "current_question": None,
            "profile": user.get("profile", {}),
        }

    # If conversation already started, return current question
    history = user.get("conversation_history", [])
    if history and history[-1].get("role") == "assistant":
        import json
        try:
            last_question = json.loads(history[-1]["content"])
            return {
                "is_complete": False,
                "questions_answered": len([t for t in history if t["role"] == "user"]),
                "current_question": last_question,
                "profile": user.get("profile", {}),
            }
        except (json.JSONDecodeError, KeyError):
            pass

    # Fresh start — ask the AI for the first question
    messages = _build_conversation_messages(
        user_name=user.get("name", "there"),
        conversation_history=[],
    )

    ai_response = await chat_completion(messages, temperature=0.7)

    # Store the AI's response in conversation history
    import json
    assistant_turn = {"role": "assistant", "content": json.dumps(ai_response), "timestamp": datetime.now(timezone.utc).isoformat()}

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$push": {"conversation_history": assistant_turn}},
    )

    return {
        "is_complete": ai_response.get("is_complete", False),
        "questions_answered": 0,
        "current_question": ai_response,
        "profile": user.get("profile", {}),
    }


async def process_answer(user_id: str, answer: str) -> dict:
    """
    Process the user's answer and get the next question from the AI.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise ValueError("User not found")

    if user.get("onboarding_complete", False):
        return {
            "is_complete": True,
            "questions_answered": len(user.get("conversation_history", [])) // 2,
            "current_question": None,
            "profile": user.get("profile", {}),
        }

    history = user.get("conversation_history", [])

    # Store the user's answer
    user_turn = {"role": "user", "content": answer, "timestamp": datetime.now(timezone.utc).isoformat()}
    history.append(user_turn)

    # Build messages and call AI
    messages = _build_conversation_messages(
        user_name=user.get("name", "there"),
        conversation_history=history,
    )

    ai_response = await chat_completion(messages, temperature=0.7)

    # Store the AI's response
    import json
    assistant_turn = {"role": "assistant", "content": json.dumps(ai_response), "timestamp": datetime.now(timezone.utc).isoformat()}
    history.append(assistant_turn)

    # Count user answers
    questions_answered = len([t for t in history if t["role"] == "user"])

    # Prepare update
    update: dict = {"$set": {"conversation_history": history}}

    # If AI signals completion, store the profile summary
    if ai_response.get("is_complete", False):
        summary = ai_response.get("summary", {})
        update["$set"]["profile"] = summary
        update["$set"]["onboarding_complete"] = True

    await db.users.update_one({"_id": ObjectId(user_id)}, update)

    return {
        "is_complete": ai_response.get("is_complete", False),
        "questions_answered": questions_answered,
        "current_question": ai_response if not ai_response.get("is_complete", False) else None,
        "profile": ai_response.get("summary", user.get("profile", {})) if ai_response.get("is_complete", False) else user.get("profile", {}),
    }


async def get_onboarding_state(user_id: str) -> dict:
    """Return the current onboarding state for a user."""
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise ValueError("User not found")

    history = user.get("conversation_history", [])
    is_complete = user.get("onboarding_complete", False)
    questions_answered = len([t for t in history if t["role"] == "user"])

    current_question = None
    if not is_complete and history and history[-1].get("role") == "assistant":
        import json
        try:
            current_question = json.loads(history[-1]["content"])
        except (json.JSONDecodeError, KeyError):
            pass

    return {
        "is_complete": is_complete,
        "questions_answered": questions_answered,
        "current_question": current_question,
        "profile": user.get("profile", {}),
    }
