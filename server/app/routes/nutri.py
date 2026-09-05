"""
Nutri AI Companion API routes — meal review, conversational mentoring, and dynamic plan modification.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import UserInDB
from app.schemas.nutri import (
    NutriConversationItem,
    NutriInteractRequest,
    NutriInteractResponse,
    NutriMealReviewRequest,
)
from app.services.auth_service import get_current_user
from app.services.nutri_service import (
    create_user_conversation,
    delete_user_conversation,
    get_user_conversations,
    get_user_chat_history,
    interact_with_nutri,
    review_logged_meal,
)

router = APIRouter(prefix="/nutri", tags=["Nutri Companion"])


@router.get(
    "/conversations",
    summary="Get user's recent chat conversations list",
)
async def list_conversations(
    current_user: UserInDB = Depends(get_current_user),
):
    """Retrieve recent conversation threads for the user."""
    try:
        threads = await get_user_conversations(current_user.id)
        return {"conversations": threads}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/conversations",
    summary="Start a new chat conversation thread",
)
async def new_conversation(
    current_user: UserInDB = Depends(get_current_user),
):
    """Create a new chat conversation thread."""
    try:
        conv = await create_user_conversation(current_user.id, title="New Chat")
        return conv
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.delete(
    "/conversations/{conv_id}",
    summary="Delete a conversation thread and its messages",
)
async def remove_conversation(
    conv_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Delete a conversation thread."""
    try:
        deleted = await delete_user_conversation(current_user.id, conv_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return {"message": "Conversation deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.get(
    "/history",
    summary="Get persistent Nutri chat history for the authenticated user",
)
async def get_nutri_history(
    conversation_id: str | None = Query(default=None, description="Optional conversation ID"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Load persistent chat history from MongoDB for the authenticated user.
    Survives page refresh and dashboard reloads.
    """
    try:
        messages = await get_user_chat_history(current_user.id, conversation_id=conversation_id, limit=50)
        return {"messages": messages, "conversation_id": conversation_id}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/interact",
    response_model=NutriInteractResponse,
    summary="Interact with Nutri: asks questions, suggests budget swaps, or dynamically modifies today's plan",
)
async def post_nutri_interact(
    payload: NutriInteractRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Process natural conversational requests to Nutri.
    Can modify today's meals directly in MongoDB when requested.
    """
    try:
        response = await interact_with_nutri(
            current_user.id,
            payload.message,
            payload.date,
            conversation_id=payload.conversation_id,
        )
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/review-meal",
    summary="Get Nutri review for a logged meal",
)
async def post_review_meal(
    payload: NutriMealReviewRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Generate instant constructive Nutri feedback for a newly logged meal.
    """
    try:
        feedback = await review_logged_meal(
            current_user.id,
            payload.food_description,
            payload.meal_type,
            payload.nutrition,
            payload.date,
        )
        return {"feedback": feedback}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
