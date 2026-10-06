"""
Plan Progress API routes — nutrition plan duration, calendar, and progress tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import UserInDB
from app.schemas.plan_progress import PlanProgressResponse, SetPlanDurationRequest
from app.services.auth_service import get_current_user
from app.services.plan_progress_service import get_plan_progress, initialize_plan

router = APIRouter(prefix="/plan-progress", tags=["Plan Progress"])


@router.get(
    "",
    response_model=PlanProgressResponse,
    summary="Get the user's nutrition plan progress, calendar, and per-day breakdown",
)
async def get_progress(current_user: UserInDB = Depends(get_current_user)):
    """
    Returns the full plan progress, dynamically computed from real food_logs
    and meal_evidence data. No manual completion marking required.
    """
    try:
        return await get_plan_progress(current_user.id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/initialize",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize or reset the user's nutrition plan with a chosen duration",
)
async def initialize_user_plan(
    payload: SetPlanDurationRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Set the plan duration and initialize start/end dates.
    Called after onboarding completes or when the user resets their plan from profile.
    """
    try:
        meta = await initialize_plan(current_user.id, payload.duration_days)
        return {
            "message": f"Plan initialized successfully for {payload.duration_days} days.",
            "plan": meta,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
