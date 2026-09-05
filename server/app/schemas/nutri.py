"""
Pydantic schemas for the Nutri AI Companion — meal reviews, plan modifications, and conversational mentoring.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.daily_plan import MealItem, DailyPlanResponse, MacroNutrition


class NutriConversationItem(BaseModel):
    """Metadata for a distinct chat conversation."""

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class NutriInteractRequest(BaseModel):
    """User prompt or action to Nutri."""

    message: str = Field(..., min_length=1, max_length=2000, description="User prompt or need")
    date: str | None = Field(default=None, description="Target date YYYY-MM-DD, defaults to today")
    conversation_id: str | None = Field(default=None, description="Conversation ID to append message to")


class PlanModificationDetail(BaseModel):
    """Structured detail of a meal modification made by Nutri."""

    meal_type: str = Field(..., description="e.g. Breakfast, Lunch, Dinner")
    original_meal_name: str = ""
    replacement_meal: MealItem
    reason: str = Field(default="", description="Why this substitution satisfies the user's needs and budget/taste constraints")


class NutriInteractResponse(BaseModel):
    """Structured response from Nutri."""

    message: str
    action: str = Field(default="none", description="'none' | 'review_meal' | 'modify_plan' | 'guidance'")
    plan_modified: bool = False
    plan_modification: PlanModificationDetail | None = None
    updated_plan: DailyPlanResponse | None = None
    conversation_id: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class NutriMealReviewRequest(BaseModel):
    """Internal/Direct request to review a logged food."""

    food_description: str
    meal_type: str
    nutrition: MacroNutrition
    date: str | None = None
