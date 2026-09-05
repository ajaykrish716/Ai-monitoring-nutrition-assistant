"""
Dynamic AI-driven onboarding service.

The AI dynamically generates questions based on the user's free-text stated need
and known facts (including static profile facts collected at registration).

Strict no-hardcoding rule:
- No hardcoded goals
- No hardcoded question banks
- No hardcoded question order
- No hardcoded number of questions
- No if/else or switch logic on user goals
- Options are generated dynamically by the AI for select questions
- Completely new/unexpected user needs adapt automatically
"""

import json
import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.services.ai_service import AIServiceError, chat_completion

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — guides AI decision process for dynamic onboarding
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an expert AI nutrition and wellness onboarding engine.
Your task is to conduct an adaptive, dynamic onboarding interview tailored specifically to the user's stated free-text need.

CORE PRINCIPLES & RULES:
1. THE USER'S STATED NEED IS THE PRIMARY DRIVER:
   - Carefully analyze the user's free-text need.
   - Determine what additional information is genuinely necessary to personalize nutrition guidance for this specific need.
   - Every question you generate must directly relate to understanding their context for that need.

2. NEVER ASK FOR INFORMATION ALREADY KNOWN:
   - Static profile information from registration (name, age, gender, height, current weight) is ALREADY KNOWN.
   - NEVER ask for age, gender, height, or current weight again.
   - NEVER ask for information that was already asked or provided in previous answers.

3. ASK ONE SINGLE RELEVANT QUESTION AT A TIME:
   - Keep questions concise, friendly, clear, and focused.
   - Avoid generic or unnecessary questions. Only ask what materially improves future nutrition personalization.
   - Dynamically choose the best question type:
     * "text": short free text
     * "textarea": detailed free text
     * "number": numeric values (e.g. daily water intake in glasses, frequency)
     * "single_select": pick one from AI-generated options (MUST provide relevant options list)
     * "multi_select": pick multiple from AI-generated options (MUST provide relevant options list)
     * "boolean": yes/no question (options: ["Yes", "No"])
   - When sufficient relevant information has been collected (typically 3 to 6 targeted questions), conclude onboarding.

4. SAFETY & CLINICAL SCOPE:
   - This is a nutrition mentoring platform, NOT a medical diagnosis or treatment system.
   - If the user mentions surgery, medical conditions, medications, or serious symptoms, account for clinician-provided instructions, prioritize safety, and recommend consulting healthcare professionals where appropriate.
   - DO NOT generate a meal plan or diet plan at this stage. Only gather necessary context.

5. CONCISENESS & TOKEN BUDGET:
   - Always return concise, high-impact JSON within a strict 768-token budget.
   - Keep question text clear, engaging, and under 30 words.
   - Keep options concise (1 to 6 words each).
   - Keep extracted_facts concise and to the point.
   - Do not include conversational filler or pleasantries outside the JSON structure.

OUTPUT JSON SCHEMA:
You MUST respond with valid JSON ONLY (no markdown code blocks, no text before or after).

When a new question is needed:
{
  "status": "question",
  "extracted_facts": {
    "<short_snake_case_key>": "<fact extracted from latest answer if any>"
  },
  "missing_information": [
    "<brief description of missing context topic 1>",
    "<brief description of missing context topic 2>"
  ],
  "question": {
    "id": "<short_unique_snake_case_id>",
    "text": "<The question to ask the user>",
    "type": "text | textarea | number | single_select | multi_select | boolean",
    "options": ["Option A", "Option B", "Option C"] or null
  }
}

When onboarding is complete:
{
  "status": "complete",
  "extracted_facts": {
    "<short_snake_case_key>": "<fact extracted from latest answer if any>"
  },
  "summary": {
    "name": "<name>",
    "age": <age>,
    "gender": "<gender>",
    "height_cm": <height>,
    "current_weight_kg": <weight>,
    "need": "<user's stated need>",
    ...all collected profile facts and preferences as a flat dictionary with snake_case keys...
  }
}
"""


def _build_compact_state_payload(user: dict) -> dict:
    """
    Construct compact structured state to send to the AI.
    Avoids replaying full unnecessary conversation history.
    """
    static_profile = {
        "name": user.get("name", ""),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "height_cm": user.get("height"),
        "current_weight_kg": user.get("current_weight"),
    }

    asked_questions = user.get("asked_questions", [])
    answers = user.get("answers", {})

    qa_history = []
    for q in asked_questions:
        qid = q.get("id") if isinstance(q, dict) else str(q)
        qtext = q.get("text") if isinstance(q, dict) else str(q)
        if qid in answers:
            qa_history.append({
                "question_id": qid,
                "question_text": qtext,
                "answer": answers[qid],
            })

    return {
        "static_registration_profile": static_profile,
        "user_stated_need": user.get("need", ""),
        "known_facts": user.get("known_facts", {}),
        "questions_already_asked_and_answered": qa_history,
        "previously_identified_missing_information": user.get("missing_information", []),
    }


def _normalize_question_dict(raw_q: dict) -> dict:
    """Normalize question dictionary to ensure all required fields exist."""
    q_id = raw_q.get("id") or raw_q.get("field") or "q_" + str(int(datetime.now(timezone.utc).timestamp()))
    q_type = str(raw_q.get("type", "text")).lower()
    q_text = raw_q.get("text", "")
    q_options = raw_q.get("options")

    if q_type == "boolean" and not q_options:
        q_options = ["Yes", "No"]

    return {
        "id": q_id,
        "field": q_id,
        "text": q_text,
        "type": q_type,
        "options": q_options if isinstance(q_options, list) else None,
    }


async def _generate_next_ai_step(user_id: str, user: dict) -> dict:
    """
    Call the AI with the compact state payload to decide the next step
    (next question or completion).
    """
    db = get_database()
    compact_state = _build_compact_state_payload(user)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Here is the current structured user state. Decide the next step:\n{json.dumps(compact_state, indent=2)}",
        },
    ]

    ai_response = await chat_completion(messages, temperature=0.7)

    # Check if AI signaled completion
    is_complete = (
        ai_response.get("status") == "complete"
        or ai_response.get("is_complete") is True
        or ai_response.get("type") == "complete"
    )

    known_facts = dict(user.get("known_facts", {}))
    extracted = ai_response.get("extracted_facts", {})
    if isinstance(extracted, dict):
        known_facts.update(extracted)

    if is_complete:
        summary = ai_response.get("summary", {})
        if not isinstance(summary, dict) or not summary:
            summary = dict(known_facts)

        # Ensure static profile is always included in summary
        summary.setdefault("name", user.get("name", ""))
        if user.get("age") is not None:
            summary.setdefault("age", user.get("age"))
        if user.get("gender") is not None:
            summary.setdefault("gender", user.get("gender"))
        if user.get("height") is not None:
            summary.setdefault("height_cm", user.get("height"))
        if user.get("current_weight") is not None:
            summary.setdefault("current_weight_kg", user.get("current_weight"))
        if user.get("need"):
            summary.setdefault("need", user.get("need"))

        update_doc = {
            "$set": {
                "onboarding_complete": True,
                "profile": summary,
                "known_facts": known_facts,
                "current_question": None,
                "missing_information": [],
            }
        }
        await db.users.update_one({"_id": ObjectId(user_id)}, update_doc)

        answers = user.get("answers", {})
        return {
            "status": "complete",
            "is_complete": True,
            "questions_answered": len(answers),
            "current_question": None,
            "profile": summary,
            "need": user.get("need", ""),
        }

    # Otherwise, it's a new question
    raw_question = ai_response.get("question") or ai_response
    question = _normalize_question_dict(raw_question)

    missing_info = ai_response.get("missing_information", [])
    if not isinstance(missing_info, list):
        missing_info = []

    asked_questions = list(user.get("asked_questions", []))
    # Avoid duplicate append if already present
    if not any(isinstance(q, dict) and q.get("id") == question["id"] for q in asked_questions):
        asked_questions.append(question)

    update_doc = {
        "$set": {
            "known_facts": known_facts,
            "missing_information": missing_info,
            "current_question": question,
            "asked_questions": asked_questions,
        }
    }
    await db.users.update_one({"_id": ObjectId(user_id)}, update_doc)

    answers = user.get("answers", {})
    return {
        "status": "question",
        "is_complete": False,
        "questions_answered": len(answers),
        "current_question": question,
        "profile": user.get("profile", {}),
        "need": user.get("need", ""),
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

INITIAL_NEED_QUESTION = {
    "id": "need",
    "field": "need",
    "text": "What would you like help with regarding your nutrition and wellness?",
    "type": "textarea",
    "options": None,
}


async def start_onboarding(user_id: str) -> dict:
    """
    Begin or resume the onboarding conversation.

    Step 1 (after registration): Ask the user's free-text need.
    Subsequent steps: AI dynamically decides questions based on the need.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise ValueError("User not found")

    # If already complete, return that state
    if user.get("onboarding_complete", False):
        return {
            "status": "complete",
            "is_complete": True,
            "questions_answered": len(user.get("answers", {})),
            "current_question": None,
            "profile": user.get("profile", {}),
            "need": user.get("need", ""),
        }

    user_need = (user.get("need") or "").strip()

    # If need is not yet provided, the first step is asking the free-text need
    if not user_need:
        current_q = user.get("current_question") or INITIAL_NEED_QUESTION
        if not user.get("current_question"):
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"current_question": INITIAL_NEED_QUESTION}},
            )
        return {
            "status": "question",
            "is_complete": False,
            "questions_answered": 0,
            "current_question": current_q,
            "profile": user.get("profile", {}),
            "need": "",
        }

    # If need is already provided and there is a pending question, return it
    if user.get("current_question"):
        return {
            "status": "question",
            "is_complete": False,
            "questions_answered": len(user.get("answers", {})),
            "current_question": user["current_question"],
            "profile": user.get("profile", {}),
            "need": user_need,
        }

    # Need is set but no active question — generate next question dynamically
    return await _generate_next_ai_step(user_id, user)


async def process_answer(user_id: str, answer: str) -> dict:
    """
    Process the user's answer and get the next dynamic question from the AI.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise ValueError("User not found")

    if user.get("onboarding_complete", False):
        return {
            "status": "complete",
            "is_complete": True,
            "questions_answered": len(user.get("answers", {})),
            "current_question": None,
            "profile": user.get("profile", {}),
            "need": user.get("need", ""),
        }

    cleaned_answer = answer.strip()
    user_need = (user.get("need") or "").strip()
    current_q = user.get("current_question") or {}
    current_qid = current_q.get("id") or "need"

    answers = dict(user.get("answers", {}))
    known_facts = dict(user.get("known_facts", {}))
    asked_questions = list(user.get("asked_questions", []))

    # Case A: Answering the initial need question
    if not user_need or current_qid == "need":
        user_need = cleaned_answer
        known_facts["stated_need"] = user_need
        answers["need"] = user_need
        if not any(isinstance(q, dict) and q.get("id") == "need" for q in asked_questions):
            asked_questions.append(INITIAL_NEED_QUESTION)

        # Persist need and answer before calling AI, preserving current_question for safe retry
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "need": user_need,
                    "known_facts": known_facts,
                    "answers": answers,
                    "asked_questions": asked_questions,
                }
            },
        )
        user["need"] = user_need
        user["known_facts"] = known_facts
        user["answers"] = answers
        user["asked_questions"] = asked_questions

        return await _generate_next_ai_step(user_id, user)

    # Case B: Answering a subsequent dynamic question
    answers[current_qid] = cleaned_answer
    known_facts[current_qid] = cleaned_answer

    # Persist answer and known_facts before calling AI, preserving current_question for safe retry
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "answers": answers,
                "known_facts": known_facts,
            }
        },
    )
    user["answers"] = answers
    user["known_facts"] = known_facts

    return await _generate_next_ai_step(user_id, user)


async def get_onboarding_state(user_id: str) -> dict:
    """Return the current onboarding state for a user."""
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise ValueError("User not found")

    is_complete = user.get("onboarding_complete", False)
    answers = user.get("answers", {})
    user_need = (user.get("need") or "").strip()

    if is_complete:
        return {
            "status": "complete",
            "is_complete": True,
            "questions_answered": len(answers),
            "current_question": None,
            "profile": user.get("profile", {}),
            "need": user_need,
        }

    current_q = user.get("current_question")
    if not current_q and not user_need:
        current_q = INITIAL_NEED_QUESTION
    elif not current_q and user_need:
        # Self-healing: if current_question was lost due to a past network glitch, dynamically recover
        return await _generate_next_ai_step(user_id, user)

    return {
        "status": "question",
        "is_complete": False,
        "questions_answered": len(answers),
        "current_question": current_q,
        "profile": user.get("profile", {}),
        "need": user_need,
    }

