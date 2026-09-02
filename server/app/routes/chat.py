"""
Nutrition Mentor Chat API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import UserInDB
from app.schemas.chat import ChatMessageItem, ChatRequest, ChatResponse, NutriFeedbackRequest, NutriFeedbackResponse
from app.services.auth_service import get_current_user
from app.services.nutrition_chat_service import (
    clear_chat_history,
    get_chat_history,
    send_chat_message,
    get_nutri_companion_feedback,
)

router = APIRouter(prefix="/chat", tags=["Nutrition Mentor Chat"])


@router.post(
    "/message",
    response_model=ChatResponse,
    summary="Send a message to the AI Nutrition Mentor with full authenticated user context",
)
async def post_message(
    payload: ChatRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Process conversational questions regarding today's meal plan, food substitutions, macro goals, and progress.
    """
    try:
        reply = await send_chat_message(current_user.id, payload.message)
        return reply
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/nutri-companion",
    response_model=NutriFeedbackResponse,
    summary="Get proactive Nutri companion feedback or affordable alternatives",
)
async def nutri_companion(
    payload: NutriFeedbackRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Generate instant friendly feedback or meal alternative suggestions for the dashboard widget.
    """
    try:
        feedback = await get_nutri_companion_feedback(current_user.id, payload)
        return feedback
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.get(
    "/history",
    response_model=list[ChatMessageItem],
    summary="Get recent chat history for the authenticated user",
)
async def get_history(
    limit: int = Query(default=50, ge=1, le=100),
    current_user: UserInDB = Depends(get_current_user),
):
    """Retrieve chat history."""
    try:
        history = await get_chat_history(current_user.id, limit=limit)
        return history
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.delete(
    "/history",
    summary="Clear chat history for authenticated user",
)
async def clear_history(current_user: UserInDB = Depends(get_current_user)):
    """Clear conversation history."""
    await clear_chat_history(current_user.id)
    return {"message": "Chat history cleared"}
