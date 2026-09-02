"""
Nutri AI Companion API routes — meal review, conversational mentoring, and dynamic plan modification.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import UserInDB
from app.schemas.nutri import NutriInteractRequest, NutriInteractResponse, NutriMealReviewRequest
from app.services.auth_service import get_current_user
from app.services.nutri_service import interact_with_nutri, review_logged_meal

router = APIRouter(prefix="/nutri", tags=["Nutri Companion"])


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
        response = await interact_with_nutri(current_user.id, payload.message, payload.date)
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
