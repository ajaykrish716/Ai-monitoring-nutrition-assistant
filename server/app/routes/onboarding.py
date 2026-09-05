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
from app.services.ai_service import (
    AIServiceError,
    AICreditLimitError,
    AIRateLimitError,
    AIAuthenticationError,
)
from app.services.auth_service import get_current_user
from app.services.onboarding_service import (
    get_onboarding_state,
    process_answer,
    start_onboarding,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


def _handle_ai_error(exc: AIServiceError) -> HTTPException:
    """Map AI service exceptions to appropriate HTTP status codes and safe messages."""
    if isinstance(exc, AICreditLimitError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable because the configured AI credit limit has been reached. Please try again later.",
        )
    elif isinstance(exc, AIRateLimitError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI service rate limit reached. Please wait a moment and try again.",
        )
    elif isinstance(exc, AIAuthenticationError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service authentication failed. Please verify provider credentials.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(exc) or "AI service is temporarily unavailable. Please try again.",
    )


@router.post(
    "/start",
    response_model=OnboardingStateResponse,
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
        raise _handle_ai_error(exc)


@router.post(
    "/answer",
    response_model=OnboardingStateResponse,
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
        raise _handle_ai_error(exc)


@router.get(
    "/state",
    response_model=OnboardingStateResponse,
    summary="Get current onboarding state",
)
async def state(current_user: UserInDB = Depends(get_current_user)):
    """Return the current onboarding state for the authenticated user."""
    result = await get_onboarding_state(current_user.id)
    return result
