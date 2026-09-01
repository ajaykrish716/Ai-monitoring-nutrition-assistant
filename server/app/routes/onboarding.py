"""
Onboarding API routes — AI-driven conversational onboarding.

All endpoints require JWT authentication. The AI determines
what questions to ask and when onboarding is complete.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import UserInDB
from app.schemas.onboarding import (
    OnboardingAnswer,
    OnboardingStateResponse,
)
from app.services.ai_service import AIServiceError
from app.services.auth_service import get_current_user
from app.services.onboarding_service import (
    get_onboarding_state,
    process_answer,
    start_onboarding,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.post(
    "/start",
    summary="Start or resume the onboarding conversation",
)
async def start(current_user: UserInDB = Depends(get_current_user)):
    """
    Begin the AI-driven onboarding flow. Returns the first question.

    If onboarding was already started, returns the current state
    (idempotent).
    """
    try:
        result = await start_onboarding(current_user.id)
        return result
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.post(
    "/answer",
    summary="Submit an answer and receive the next question",
)
async def answer(
    payload: OnboardingAnswer,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Submit the user's answer to the current onboarding question.
    The AI processes it and returns the next question, or signals
    that onboarding is complete with a profile summary.
    """
    try:
        result = await process_answer(current_user.id, payload.answer)
        return result
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.get(
    "/state",
    response_model=OnboardingStateResponse,
    summary="Get current onboarding state",
)
async def state(current_user: UserInDB = Depends(get_current_user)):
    """Return the current onboarding state for the authenticated user."""
    result = await get_onboarding_state(current_user.id)
    return result
