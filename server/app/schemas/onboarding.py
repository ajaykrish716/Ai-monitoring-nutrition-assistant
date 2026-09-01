"""
Pydantic schemas for the AI-driven onboarding flow.

These schemas define the API contract — they do NOT define what
questions exist or what fields are collected. The AI determines that.
"""

from pydantic import BaseModel, Field


class OnboardingAnswer(BaseModel):
    """Client submits an answer to the current onboarding question."""

    answer: str = Field(..., min_length=1, max_length=2000)


class OnboardingQuestion(BaseModel):
    """
    A single AI-generated question to render on the client.

    The ``type`` field tells the client which UI control to render.
    Supported types (extensible by the AI):
        - text       → single-line text input
        - number     → numeric input
        - textarea   → multi-line text input
        - single_select → radio buttons / dropdown (options required)
        - multi_select  → checkboxes (options required)
    """

    type: str
    text: str
    field: str = ""
    options: list[str] | None = None
    is_complete: bool = False
    summary: dict | None = None


class OnboardingStateResponse(BaseModel):
    """Full onboarding state returned to the client."""

    is_complete: bool
    questions_answered: int
    current_question: OnboardingQuestion | None = None
    profile: dict = {}
