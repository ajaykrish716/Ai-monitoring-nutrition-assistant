"""
Meal Schedule Service — manages user meal timing settings and computes
timing states and scores.

All timing evaluations use the user's stored timezone and schedule.
Nothing is hardcoded outside the DEFAULT_MEAL_SCHEDULE initializer.
"""

import logging
from datetime import datetime, timezone, timedelta, time

from bson import ObjectId

from app.db.mongodb import get_database
from app.schemas.meal_schedule import (
    DEFAULT_MEAL_SCHEDULE,
    DEFAULT_TIMEZONE,
    MealScheduleResponse,
    MealScheduleSettings,
    MealTimingConfig,
    MealTimingState,
    MealTimingStatus,
    DailyMealTimingResponse,
    _parse_time_minutes,
)

logger = logging.getLogger(__name__)


from app.core.timezone_utils import get_timezone_obj, validate_timezone_name, get_user_now

# ---------------------------------------------------------------------------
# Timezone helpers
# ---------------------------------------------------------------------------

def _get_user_now(tz_name: str) -> datetime:
    """Return the current datetime in the user's timezone."""
    return get_user_now(tz_name)


def _get_user_today_str(tz_name: str) -> str:
    """Return today's date string in the user's timezone."""
    return _get_user_now(tz_name).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Default schedule initializer
# ---------------------------------------------------------------------------

def get_default_meal_schedule() -> dict:
    """
    Return a fresh copy of the default meal schedule.
    Used ONLY when creating a new user account.
    """
    return {
        "breakfast": {**DEFAULT_MEAL_SCHEDULE["breakfast"]},
        "lunch": {**DEFAULT_MEAL_SCHEDULE["lunch"]},
        "dinner": {**DEFAULT_MEAL_SCHEDULE["dinner"]},
    }


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------

async def get_user_meal_schedule(user_id: str) -> MealScheduleResponse:
    """Retrieve the user's meal schedule from MongoDB."""
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    schedule = user.get("meal_schedule", get_default_meal_schedule())
    user_tz = user.get("timezone", DEFAULT_TIMEZONE)

    return MealScheduleResponse(
        breakfast=MealTimingConfig(**schedule.get("breakfast", DEFAULT_MEAL_SCHEDULE["breakfast"])),
        lunch=MealTimingConfig(**schedule.get("lunch", DEFAULT_MEAL_SCHEDULE["lunch"])),
        dinner=MealTimingConfig(**schedule.get("dinner", DEFAULT_MEAL_SCHEDULE["dinner"])),
        timezone=user_tz,
    )


async def update_meal_timing(user_id: str, meal_key: str, config: dict) -> MealScheduleResponse:
    """
    Update a single meal's timing configuration.
    Validates the configuration and persists to MongoDB.
    """
    db = get_database()
    meal_key_lower = meal_key.lower()

    if meal_key_lower not in ("breakfast", "lunch", "dinner"):
        raise ValueError(f"Invalid meal type: {meal_key}. Must be breakfast, lunch, or dinner.")

    window_start = config.get("window_start") or config.get("scheduled_time")
    window_end = config.get("window_end")

    if not window_start or not window_end:
        raise ValueError("Both window_start and window_end are required.")

    # Validate using Pydantic
    validated = MealTimingConfig(
        meal_type=meal_key_lower.capitalize(),
        window_start=window_start,
        window_end=window_end,
        enabled=config.get("enabled", True),
    )

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {f"meal_schedule.{meal_key_lower}": validated.model_dump()}},
    )

    return await get_user_meal_schedule(user_id)


async def update_user_timezone(user_id: str, tz: str) -> str:
    """Update the user's timezone setting."""
    if not validate_timezone_name(tz):
        raise ValueError(f"Invalid timezone: {tz}")

    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"timezone": tz}},
    )
    return tz


# ---------------------------------------------------------------------------
# Timing state computation
# ---------------------------------------------------------------------------

def compute_meal_state(
    config: MealTimingConfig,
    current_time: int | time,
    is_logged: bool,
) -> MealTimingState:
    """
    Determine the deterministic state of a meal:
    - COMPLETED: The meal has already been logged today.
    - UPCOMING: Current user-local time is before window_start.
    - AVAILABLE: Current user-local time is inside the meal window [start, end).
    - WINDOW_CLOSED: Current time is after window_end and not logged.
    """
    if is_logged:
        return MealTimingState.COMPLETED

    if isinstance(current_time, time):
        current_time_minutes = current_time.hour * 60 + current_time.minute
    else:
        current_time_minutes = int(current_time)

    start = _parse_time_minutes(config.window_start)
    end = _parse_time_minutes(config.window_end)

    if current_time_minutes < start:
        return MealTimingState.UPCOMING
    elif current_time_minutes < end:
        return MealTimingState.AVAILABLE
    else:
        return MealTimingState.WINDOW_CLOSED


def compute_timing_score(
    config: MealTimingConfig,
    logged_time_minutes: int | None,
) -> float:
    """
    Calculate the timing score (0–100) for a meal:
    - Logged inside the window: 100.0
    - Not logged or logged outside: 0.0
    """
    if logged_time_minutes is None:
        return 0.0

    start = _parse_time_minutes(config.window_start)
    end = _parse_time_minutes(config.window_end)

    if start <= logged_time_minutes <= end:
        return 100.0
    return 0.0


def _generate_timing_message(state: MealTimingState, meal_type: str, window_start: str, window_end: str) -> str:
    """Generate user-friendly message based on meal state."""
    if state == MealTimingState.UPCOMING:
        return f"Available at {_format_time_display(window_start)}"
    elif state == MealTimingState.AVAILABLE:
        return f"Available now until {_format_time_display(window_end)}"
    elif state == MealTimingState.WINDOW_CLOSED:
        return f"{meal_type} window is closed"
    elif state == MealTimingState.COMPLETED:
        return f"✓ {meal_type} completed"
    return ""


def _format_time_display(time_str: str) -> str:
    """Convert 'HH:MM' 24h to '8:00 AM' format."""
    try:
        h, m = time_str.split(":")
        h = int(h)
        m_str = m.zfill(2)
        if h == 0:
            return f"12:{m_str} AM"
        elif h < 12:
            return f"{h}:{m_str} AM"
        elif h == 12:
            return f"12:{m_str} PM"
        else:
            return f"{h - 12}:{m_str} PM"
    except Exception:
        return time_str


# ---------------------------------------------------------------------------
# Daily meal timing status
# ---------------------------------------------------------------------------

async def get_daily_meal_timing(user_id: str, date_str: str | None = None) -> DailyMealTimingResponse:
    """
    Get the current timing status for all three meals on the given date.
    Uses the user's stored schedule and timezone.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    user_tz = user.get("timezone", DEFAULT_TIMEZONE)
    user_now = _get_user_now(user_tz)
    target_date = date_str or user_now.strftime("%Y-%m-%d")
    current_time_minutes = user_now.hour * 60 + user_now.minute

    # Only evaluate state based on current time if viewing today
    is_today = target_date == user_now.strftime("%Y-%m-%d")

    schedule = user.get("meal_schedule", get_default_meal_schedule())

    # Get food logs for the target date
    logs_cursor = db.food_logs.find({"user_id": user_id, "date": target_date})
    logs = await logs_cursor.to_list(length=100)

    # Group logged meal types
    logged_meal_types = set()
    logged_times = {}
    for log_entry in logs:
        mt = log_entry.get("meal_type", "").lower()
        logged_meal_types.add(mt)
        # Track the logged_at time
        log_dt = log_entry.get("logged_at")
        if log_dt and mt not in logged_times:
            if hasattr(log_dt, 'hour'):
                try:
                    user_tz_obj = get_timezone_obj(user_tz)
                    if log_dt.tzinfo is None:
                        log_dt = log_dt.replace(tzinfo=timezone.utc)
                    log_local = log_dt.astimezone(user_tz_obj)
                    logged_times[mt] = log_local.hour * 60 + log_local.minute
                except Exception:
                    logged_times[mt] = log_dt.hour * 60 + log_dt.minute

    meals_status = []
    for meal_key in ("breakfast", "lunch", "dinner"):
        cfg_data = schedule.get(meal_key, DEFAULT_MEAL_SCHEDULE[meal_key])
        config = MealTimingConfig(**cfg_data)

        is_logged = meal_key in logged_meal_types
        state = compute_meal_state(config, current_time_minutes if is_today else 1440, is_logged)

        # Compute timing score
        logged_time = logged_times.get(meal_key)
        timing_score = compute_timing_score(config, logged_time) if is_logged else 0.0

        logged_at_str = None
        if is_logged and logged_time is not None:
            logged_at_str = f"{logged_time // 60:02d}:{logged_time % 60:02d}"

        message = _generate_timing_message(state, config.meal_type, config.window_start, config.window_end)

        meals_status.append(MealTimingStatus(
            meal_type=config.meal_type,
            window_start=config.window_start,
            window_end=config.window_end,
            enabled=config.enabled,
            state=state,
            is_logged=is_logged,
            timing_score=timing_score,
            logged_at=logged_at_str,
            message=message,
        ))

    return DailyMealTimingResponse(
        date=target_date,
        timezone=user_tz,
        meals=meals_status,
    )


def compute_daily_timing_score(meal_statuses: list[MealTimingStatus]) -> float:
    """
    Compute the overall daily meal timing score (0–100).
    Average of individual meal timing scores, counting only enabled meals.
    """
    enabled_meals = [m for m in meal_statuses if m.enabled]
    if not enabled_meals:
        return 100.0

    total = sum(m.timing_score for m in enabled_meals)
    return round(total / len(enabled_meals), 1)
