"""
Meal Schedule API routes — user-configurable meal timing settings.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import UserInDB
from app.schemas.meal_schedule import (
    MealScheduleResponse,
    MealScheduleUpdateRequest,
    DailyMealTimingResponse,
    TimezoneUpdateRequest,
)
from app.services.auth_service import get_current_user
from app.services.meal_schedule_service import (
    get_user_meal_schedule,
    update_meal_timing,
    update_user_timezone,
    get_daily_meal_timing,
)

router = APIRouter(prefix="/meal-schedule", tags=["Meal Schedule"])


# ---------------------------------------------------------------------------
# GET /meal-schedule — retrieve user's full meal schedule
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=MealScheduleResponse,
    summary="Get the user's meal schedule settings",
)
async def get_schedule(current_user: UserInDB = Depends(get_current_user)):
    """Return the authenticated user's meal schedule configuration."""
    try:
        return await get_user_meal_schedule(current_user.id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# PUT /meal-schedule/timing — update a single meal's timing
# ---------------------------------------------------------------------------

@router.put(
    "/timing",
    response_model=MealScheduleResponse,
    summary="Update timing for a specific meal (breakfast, lunch, or dinner)",
)
async def update_timing(
    payload: MealScheduleUpdateRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update timing configuration for a single meal.
    Validates time ordering: scheduled_time < reduction_start < window_end.
    """
    try:
        return await update_meal_timing(
            current_user.id,
            payload.meal_type,
            payload.model_dump(exclude={"meal_type"}),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# PUT /meal-schedule/timezone — update user timezone
# ---------------------------------------------------------------------------

@router.put(
    "/timezone",
    summary="Update the user's timezone",
)
async def update_tz(
    payload: TimezoneUpdateRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update the user's timezone for meal timing evaluation."""
    try:
        new_tz = await update_user_timezone(current_user.id, payload.timezone)
        return {"timezone": new_tz, "message": "Timezone updated successfully."}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /meal-schedule/today — get current timing states for dashboard
# ---------------------------------------------------------------------------

@router.get(
    "/today",
    response_model=DailyMealTimingResponse,
    summary="Get current meal timing states for the dashboard",
)
async def get_today_timing(
    date: str | None = Query(default=None, description="Optional target date YYYY-MM-DD"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Return the current timing state for all three meals.
    States: upcoming, available, late, window_closed, completed.
    """
    try:
        return await get_daily_meal_timing(current_user.id, date_str=date)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
