"""
Pydantic schemas for food logging, deterministic nutrition analytics, streaks, badges, and activity history.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.daily_plan import MacroNutrition, DailyTargets


class LogFoodRequest(BaseModel):
    """Natural language or structured food entry submission."""

    food_description: str = Field(..., min_length=1, max_length=1000, description="e.g. '2 idlis with sambar and coconut chutney'")
    meal_type: str = Field(default="Snack", description="Breakfast, Lunch, Dinner, Snack")
    date: str | None = Field(default=None, description="YYYY-MM-DD, defaults to today")


class FoodLogEntry(BaseModel):
    """Individual recorded food entry."""

    id: str
    user_id: str
    date: str
    food_description: str
    meal_type: str
    matched_items: list[str] = Field(default_factory=list)
    nutrition: MacroNutrition
    notes: str = ""
    nutri_review: str = ""
    logged_at: datetime


class ConsumedTotals(BaseModel):
    """Aggregated consumed nutrition."""

    calories: float = 0.0
    protein: float = 0.0
    carbohydrates: float = 0.0
    fat: float = 0.0
    water_ml: float = 0.0


class ProgressPercentages(BaseModel):
    """Percentage progress towards daily targets."""

    calories: float = 0.0
    protein: float = 0.0
    carbohydrates: float = 0.0
    fat: float = 0.0
    water_ml: float = 0.0


class RemainingTargets(BaseModel):
    """Remaining nutrition to reach daily targets."""

    calories: float = 0.0
    protein: float = 0.0
    carbohydrates: float = 0.0
    fat: float = 0.0
    water_ml: float = 0.0


class DailyGoalEvaluation(BaseModel):
    """Deterministic evaluation of daily goal achievement."""

    is_achieved: bool = False
    criteria_met: list[str] = Field(default_factory=list)
    message: str = ""


class StreakInfo(BaseModel):
    """Authoritative streak status."""

    current_streak: int = 0
    longest_streak: int = 0
    last_completed_date: str | None = None
    completed_dates: list[str] = Field(default_factory=list)


class RewardBadge(BaseModel):
    """Extensible badge and reward model."""

    id: str
    user_id: str
    type: str = Field(..., description="e.g. milestone, consistency, monthly")
    name: str
    description: str
    icon: str = "Award"
    period: str = "monthly"
    earned_at: datetime
    metadata: dict = Field(default_factory=dict)


class TrackingTodayResponse(BaseModel):
    """Comprehensive daily tracking summary."""

    date: str
    daily_targets: DailyTargets
    consumed: ConsumedTotals
    remaining: RemainingTargets
    progress_percentages: ProgressPercentages
    nutrition_score: float = 0.0  # 0 to 100 based on actual nutritional adequacy
    plan_adherence: float = 0.0   # 0 to 100 based on adherence to suggested foods
    logs: list[FoodLogEntry]
    goal_status: DailyGoalEvaluation
    streak: StreakInfo
    badges: list[RewardBadge]
    nutri_feedback: str = ""


class LogWaterRequest(BaseModel):
    """Log water consumption."""

    amount_ml: float = Field(..., gt=0, le=5000)
    date: str | None = None


class ActivityDayItem(BaseModel):
    """Day data item for yearly GitHub-style activity calendar."""

    date: str  # YYYY-MM-DD
    count: int = 0
    nutrition_score: float = 0.0
    plan_adherence: float = 0.0
    goal_achieved: bool = False
    level: int = 0  # 0, 1, 2, 3, 4


class ActivityHistoryResponse(BaseModel):
    """Yearly activity calendar response."""

    year: int
    days: list[ActivityDayItem]
    total_active_days: int
    longest_streak: int
    current_streak: int
