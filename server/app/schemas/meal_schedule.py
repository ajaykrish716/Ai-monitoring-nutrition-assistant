"""
Pydantic schemas for user-configurable meal schedule and timing system.

Each user has per-meal timing settings (scheduled_time, reduction_start, window_end)
stored in MongoDB. The backend uses these settings — not hardcoded values — to
determine meal state and calculate timing scores.
"""

from enum import Enum
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Default meal schedule constants — used ONLY to initialise new users
# ---------------------------------------------------------------------------

DEFAULT_MEAL_SCHEDULE = {
    "breakfast": {
        "meal_type": "Breakfast",
        "window_start": "08:00",
        "window_end": "10:00",
        "enabled": True,
    },
    "lunch": {
        "meal_type": "Lunch",
        "window_start": "12:30",
        "window_end": "14:30",
        "enabled": True,
    },
    "dinner": {
        "meal_type": "Dinner",
        "window_start": "19:00",
        "window_end": "21:00",
        "enabled": True,
    },
}

DEFAULT_TIMEZONE = "UTC"


# ---------------------------------------------------------------------------
# Meal state enum
# ---------------------------------------------------------------------------

class MealTimingState(str, Enum):
    """Dynamic state of a meal based on current time and logging status."""
    UPCOMING = "upcoming"
    AVAILABLE = "available"
    COMPLETED = "completed"
    WINDOW_CLOSED = "window_closed"


# ---------------------------------------------------------------------------
# Schema models
# ---------------------------------------------------------------------------

class MealTimingConfig(BaseModel):
    """Configuration for a single meal's logging window."""

    meal_type: str = Field(..., description="Breakfast, Lunch, or Dinner")
    window_start: str = Field(..., description="HH:MM in 24h format, e.g. '08:00'")
    window_end: str = Field(..., description="HH:MM when logging window closes, e.g. '10:00'")
    enabled: bool = Field(default=True, description="Whether this meal is enabled")

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_fields(cls, data):
        if isinstance(data, dict):
            if "window_start" not in data and "scheduled_time" in data:
                data["window_start"] = data["scheduled_time"]
            if "window_end" not in data:
                data["window_end"] = "10:00"
            # Upgrade lunch and dinner defaults if legacy values present
            mt = data.get("meal_type", "").lower()
            if mt == "lunch" and data.get("window_end") == "14:00":
                data["window_end"] = "14:30"
            elif mt == "dinner":
                if data.get("window_start") == "20:00":
                    data["window_start"] = "19:00"
                if data.get("window_end") == "22:00":
                    data["window_end"] = "21:00"
        return data

    @model_validator(mode="after")
    def validate_time_ordering(self):
        """Ensure window_start < window_end."""
        try:
            st = _parse_time_minutes(self.window_start)
            we = _parse_time_minutes(self.window_end)
        except ValueError as e:
            raise ValueError(f"Invalid time format: {e}")

        if st >= we:
            raise ValueError(
                f"Window start ({self.window_start}) must be before "
                f"window end ({self.window_end})"
            )
        return self


class MealScheduleSettings(BaseModel):
    """Complete meal schedule for a user (all three primary meals)."""

    breakfast: MealTimingConfig
    lunch: MealTimingConfig
    dinner: MealTimingConfig
    timezone: str = Field(default=DEFAULT_TIMEZONE, description="IANA timezone string")


class MealScheduleUpdateRequest(BaseModel):
    """Request to update a single meal's timing configuration."""

    meal_type: str = Field(..., description="breakfast, lunch, or dinner")
    window_start: str = Field(..., description="HH:MM 24h format")
    window_end: str = Field(..., description="HH:MM 24h format")
    enabled: bool = Field(default=True)

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_fields(cls, data):
        if isinstance(data, dict) and "window_start" not in data:
            data["window_start"] = data.get("scheduled_time", "08:00")
        return data

    @model_validator(mode="after")
    def validate_time_ordering(self):
        """Ensure time ordering is valid."""
        try:
            st = _parse_time_minutes(self.window_start)
            we = _parse_time_minutes(self.window_end)
        except ValueError as e:
            raise ValueError(f"Invalid time format: {e}")

        if st >= we:
            raise ValueError(
                f"Window start ({self.window_start}) must be before "
                f"window end ({self.window_end})"
            )
        return self


class TimezoneUpdateRequest(BaseModel):
    """Request to update the user's timezone."""
    timezone: str = Field(..., min_length=1, max_length=100)


class MealTimingStatus(BaseModel):
    """Runtime status of a single meal for the current time."""

    meal_type: str
    window_start: str
    window_end: str
    enabled: bool = True
    state: MealTimingState = MealTimingState.UPCOMING
    is_logged: bool = False
    timing_score: float = Field(default=100.0, ge=0, le=100)
    logged_at: str | None = None
    message: str = ""


class MealScheduleResponse(BaseModel):
    """Full meal schedule with current timing states."""

    breakfast: MealTimingConfig
    lunch: MealTimingConfig
    dinner: MealTimingConfig
    timezone: str = DEFAULT_TIMEZONE


class DailyMealTimingResponse(BaseModel):
    """All three meals' current states for the dashboard."""

    date: str
    timezone: str
    meals: list[MealTimingStatus]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _parse_time_minutes(time_str: str) -> int:
    """Parse 'HH:MM' to total minutes since midnight."""
    parts = time_str.strip().split(":")
    if len(parts) != 2:
        raise ValueError(f"Expected HH:MM format, got '{time_str}'")
    h, m = int(parts[0]), int(parts[1])
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError(f"Invalid time: {time_str}")
    return h * 60 + m
