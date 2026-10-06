"""
Pydantic schemas for Nutrition Plan Progress — duration, calendar days, and completion tracking.
"""

from pydantic import BaseModel, Field
from typing import Optional


class PlanDayBreakdown(BaseModel):
    """Per-meal completion breakdown for a plan day."""

    breakfast: bool = False
    lunch: bool = False
    dinner: bool = False


class PlanDayItem(BaseModel):
    """Individual day in the nutrition plan calendar."""

    date: str  # YYYY-MM-DD
    status: str = "pending"  # "completed" | "pending" | "future"
    completion_percentage: float = 0.0
    breakdown: PlanDayBreakdown = Field(default_factory=PlanDayBreakdown)


class PlanProgressResponse(BaseModel):
    """Full plan progress response — dynamically computed from real tracking data."""

    duration_days: int = 0
    start_date: str = ""
    end_date: str = ""
    current_day: int = 0          # 1-based day number within plan (0 = before plan starts)
    completed_days: int = 0
    remaining_days: int = 0
    completion_percentage: float = 0.0
    current_streak: int = 0
    longest_streak: int = 0
    is_plan_complete: bool = False
    has_active_plan: bool = False
    days: list[PlanDayItem] = Field(default_factory=list)


class SetPlanDurationRequest(BaseModel):
    """Request body to set/update the plan duration manually (used by onboarding completion)."""

    duration_days: int = Field(..., ge=1, le=365, description="Plan duration in days (1–365)")
