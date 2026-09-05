"""
Tracking & Analytics API routes — food logging, progress analytics, streaks, rewards.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import UserInDB
from app.schemas.tracking import (
    ActivityHistoryResponse,
    FoodLogEntry,
    LogFoodRequest,
    LogWaterRequest,
    TrackingTodayResponse,
)
from app.services.auth_service import get_current_user
from app.services.tracking_service import (
    delete_food_log,
    get_tracking_today,
    log_food_item,
    log_water,
)

router = APIRouter(prefix="/tracking", tags=["Tracking & Analytics"])


@router.get(
    "/today",
    response_model=TrackingTodayResponse,
    summary="Get today's nutrition analytics, food logs, goal status, and streak",
)
async def get_today_tracking(
    date: str | None = Query(default=None, description="Optional target date YYYY-MM-DD"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Get full deterministic nutrition analytics, remaining macros, logs, streak, and badges.
    """
    try:
        summary = await get_tracking_today(current_user.id, date_str=date)
        return summary
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post(
    "/log-food",
    response_model=FoodLogEntry,
    status_code=status.HTTP_201_CREATED,
    summary="Log a meal or food item using free-text or structured description",
)
@router.post(
    "/meal-logs",
    response_model=FoodLogEntry,
    status_code=status.HTTP_201_CREATED,
    summary="Log a meal or food item (alias)",
)
async def log_food(
    payload: LogFoodRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Submit a consumed food item. Estimates macros with AI and stores record deterministically.
    """
    try:
        entry = await log_food_item(current_user.id, payload)
        return entry
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.delete(
    "/log/{log_id}",
    summary="Delete a food log entry",
)
async def remove_log(
    log_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Delete a logged item by ID."""
    deleted = await delete_food_log(current_user.id, log_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log entry not found",
        )
    return {"message": "Log deleted successfully"}


@router.post(
    "/log-water",
    summary="Log water intake in ml",
)
async def add_water(
    payload: LogWaterRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """Log hydration in ml for the date."""
    try:
        total = await log_water(current_user.id, payload.amount_ml, payload.date)
        return {"total_water_ml": total}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.get(
    "/activity-calendar",
    response_model=ActivityHistoryResponse,
    summary="Get 365-day activity calendar data for heatmap",
)
async def get_activity_calendar(
    year: int | None = Query(default=None, description="Year, defaults to current"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Returns full yearly activity records with log counts, scores, and streak info for heatmap.
    """
    try:
        from app.services.tracking_service import get_yearly_activity
        data = await get_yearly_activity(current_user.id, year=year)
        return data
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
