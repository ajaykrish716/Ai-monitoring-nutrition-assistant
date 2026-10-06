"""
Pydantic schemas for the Meal Evidence Upload feature.

Evidence is a record that a user photographed the meal they prepared.
It does NOT claim the image proves consumption; it is purely a personal
record / photo journal linked to the user's daily plan.
"""

from datetime import datetime
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class MealEvidenceUploadRequest(BaseModel):
    """
    Metadata submitted alongside the multipart image upload.

    The image itself is received as a file upload in the route handler;
    this schema carries the descriptive fields.
    """

    date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Date the meal was prepared — YYYY-MM-DD",
    )
    meal_type: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Breakfast, Lunch, or Dinner",
    )
    planned_meal_name: str = Field(
        default="",
        max_length=200,
        description="Name of the planned meal from the daily plan",
    )
    notes: str = Field(
        default="",
        max_length=500,
        description="Optional personal note from the user",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class MealEvidenceItem(BaseModel):
    """Single evidence record returned to the client."""

    id: str
    user_id: str
    date: str
    meal_type: str
    planned_meal_name: str = ""
    notes: str = ""
    # Image stored as base64 data URI so the frontend can display it directly
    # without a separate image-serving endpoint.
    image_data_uri: str = Field(
        default="",
        description="Base64-encoded data URI of the uploaded image, e.g. 'data:image/jpeg;base64,...'",
    )
    image_filename: str = ""
    image_mime_type: str = ""
    image_size_bytes: int = 0
    uploaded_at: datetime


class MealEvidenceListResponse(BaseModel):
    """List of evidence records for a given date."""

    date: str
    evidence: list[MealEvidenceItem] = Field(default_factory=list)
    total: int = 0


class MealEvidenceSummary(BaseModel):
    """
    Progress/report summary for meal evidence — used in analytics.

    Counts are for the queried date only.
    """

    date: str
    total_suggested_meals: int = 3  # Always 3: Breakfast, Lunch, Dinner
    meals_with_evidence: int = 0
    evidence_completion_pct: float = 0.0  # 0.0 – 100.0
    meal_breakdown: dict = Field(
        default_factory=dict,
        description="e.g. {'Breakfast': True, 'Lunch': False, 'Dinner': False}",
    )
