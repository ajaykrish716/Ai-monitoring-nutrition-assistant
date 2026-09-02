"""
Pydantic schemas for AI-generated daily nutrition and physical activity plans.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class MacroNutrition(BaseModel):
    """Nutritional breakdown for a meal or target."""

    calories: float = Field(default=0.0, ge=0)
    protein: float = Field(default=0.0, ge=0, description="Protein in grams")
    carbohydrates: float = Field(default=0.0, ge=0, description="Carbohydrates in grams")
    fat: float = Field(default=0.0, ge=0, description="Fat in grams")


class DailyTargets(BaseModel):
    """Personalized daily macro and hydration targets."""

    calories: float = Field(default=2000.0, ge=0)
    protein: float = Field(default=100.0, ge=0)
    carbohydrates: float = Field(default=220.0, ge=0)
    fat: float = Field(default=65.0, ge=0)
    water_ml: float = Field(default=2500.0, ge=0, description="Target water intake in ml")


class MealItem(BaseModel):
    """Individual meal in the daily plan."""

    meal_type: str = Field(..., description="e.g. Breakfast, Lunch, Dinner, Snack")
    name: str = Field(..., description="Meal title / recipe name")
    foods: list[str] = Field(default_factory=list, description="Key food items")
    portion_information: str = Field(default="", description="Portion sizes and measurements")
    nutrition: MacroNutrition = Field(default_factory=MacroNutrition)
    notes: str = Field(default="", description="Preparation notes, timing, or personalized rationale")


class PhysicalActivityItem(BaseModel):
    """Recommended daily physical activity."""

    name: str = Field(..., description="Activity name")
    duration_minutes: int = Field(default=30, ge=0)
    intensity: str = Field(default="Moderate", description="Light, Moderate, High, Custom")
    notes: str = Field(default="", description="Form tips, timing, or rationale")


class DailyPlanResponse(BaseModel):
    """Full daily plan returned to client."""

    id: str = ""
    user_id: str
    date: str  # YYYY-MM-DD
    summary: str = Field(default="", description="Overview rationale of today's plan")
    daily_targets: DailyTargets = Field(default_factory=DailyTargets)
    meals: list[MealItem] = Field(default_factory=list)
    physical_activities: list[PhysicalActivityItem] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
