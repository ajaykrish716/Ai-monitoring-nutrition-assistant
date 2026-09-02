"""
Pydantic schemas for the AI-driven onboarding flow.

These schemas define the API contract — they do NOT define what
questions exist or what fields are collected. The AI determines that.
"""

from pydantic import BaseModel, Field


class OnboardingAnswer(BaseModel):
    """Client submits an answer to the current onboarding question."""

    answer: str = Field(..., min_length=1, max_length=2000)


class OnboardingQuestionDetail(BaseModel):
    """
    A single AI-generated question to render on the client.

    Supported types:
        - text          → single-line text input
        - textarea      → multi-line text input
        - number        → numeric input
        - single_select → single choice from AI-provided options
        - multi_select  → multiple choices from AI-provided options
        - boolean       → yes/no toggle or radio
    """

    id: str = ""
    text: str
    type: str
    options: list[str] | None = None
    field: str = ""


class OnboardingQuestion(BaseModel):
    """Backwards-compatible question schema."""

    id: str = ""
    type: str
    text: str
    field: str = ""
    options: list[str] | None = None
    is_complete: bool = False
    summary: dict | None = None


class OnboardingStateResponse(BaseModel):
    """Full onboarding state returned to the client."""

    status: str = "question"  # "question" | "complete"
    is_complete: bool
    questions_answered: int
    current_question: OnboardingQuestionDetail | None = None
    profile: dict = {}
    need: str | None = None
