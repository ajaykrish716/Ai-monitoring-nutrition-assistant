"""
Daily Plan API routes — personalized nutrition and physical activity plans.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import UserInDB
from app.schemas.daily_plan import DailyPlanResponse
from app.services.ai_service import AIServiceError
from app.services.auth_service import get_current_user
from app.services.daily_plan_service import generate_or_get_daily_plan

router = APIRouter(prefix="/daily-plan", tags=["Daily Plan"])


@router.get(
    "/today",
    response_model=DailyPlanResponse,
    summary="Get today's personalized meal and activity plan",
)
async def get_today_plan(
    date: str | None = Query(default=None, description="Optional target date YYYY-MM-DD"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Retrieve or generate today's personalized daily plan for the authenticated user.
    """
    try:
        plan = await generate_or_get_daily_plan(current_user.id, date_str=date)
        return plan
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/regenerate",
    response_model=DailyPlanResponse,
    summary="Explicitly regenerate today's plan via AI",
)
async def regenerate_plan(
    date: str | None = Query(default=None, description="Optional target date YYYY-MM-DD"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Force regeneration of the daily plan for the specified date.
    """
    try:
        plan = await generate_or_get_daily_plan(current_user.id, date_str=date, force_regenerate=True)
        return plan
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
