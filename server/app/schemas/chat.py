"""
Pydantic schemas for the contextual AI Nutrition Mentor Chat and Nutri Companion.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class ChatMessageItem(BaseModel):
    """A message in the chat conversation."""

    id: str = ""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    """User prompt to the nutrition mentor."""

    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    """Assistant reply with message metadata."""

    id: str
    role: str = "assistant"
    content: str
    timestamp: datetime


class NutriFeedbackRequest(BaseModel):
    """Request for Nutri proactive feedback or affordable alternative recommendation."""

    action: str = Field(default="status", description="status, meal_logged, ask_alternative, affordable_substitute")
    context_item: str | None = Field(default=None, description="e.g. food name, user comment, constraint")
    meal_type: str | None = None


class NutriFeedbackResponse(BaseModel):
    """Nutri companion feedback."""

    message: str
    suggested_alternatives: list[str] = Field(default_factory=list)
    action: str = "feedback"
