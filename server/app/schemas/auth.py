"""
Pydantic schemas for authentication: registration, login, and responses.

Registration is now minimal — only email, password, and name.
All other profile data is collected dynamically during AI onboarding.
"""

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    """Registration payload — static registration fields."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=1, le=120)
    gender: str = Field(..., min_length=1, max_length=50)
    height: float = Field(..., gt=0, le=300, description="Height in cm")
    current_weight: float = Field(..., gt=0, le=500, description="Current weight in kg")


class UserLogin(BaseModel):
    """Login payload."""

    email: EmailStr
    password: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class GoalItem(BaseModel):
    """Represents a single user wellness or nutrition goal."""

    id: str
    description: str
    status: str = "active"  # "active", "inactive", "archived"
    priority: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class GoalCreate(BaseModel):
    """Payload for creating a new goal."""

    description: str = Field(..., min_length=1, max_length=500)
    priority: int | None = Field(None, ge=1, le=10)


class GoalUpdate(BaseModel):
    """Payload for updating an existing goal."""

    description: str | None = Field(None, min_length=1, max_length=500)
    status: str | None = Field(None, pattern="^(active|inactive|archived)$")
    priority: int | None = Field(None, ge=1, le=10)


class TokenResponse(BaseModel):
    """Returned after successful login or registration."""

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """
    Public user profile — returned by ``GET /auth/me``.

    Never includes the password hash.
    Profile data is a dynamic dict populated by AI onboarding.
    """

    id: str
    email: str
    name: str
    age: int | None = None
    gender: str | None = None
    height: float | None = None
    current_weight: float | None = None
    need: str | None = None
    goals: list[GoalItem] = []
    onboarding_complete: bool = False
    profile: dict = {}
    meal_schedule: dict = {}
    timezone: str = "UTC"


class UserUpdateProfile(BaseModel):
    """Payload for updating user's basic profile metrics."""

    name: str | None = Field(None, min_length=1, max_length=100)
    age: int | None = Field(None, ge=1, le=120)
    gender: str | None = Field(None, min_length=1, max_length=50)
    height: float | None = Field(None, gt=0, le=300, description="Height in cm")
    current_weight: float | None = Field(None, gt=0, le=500, description="Current weight in kg")
    email: EmailStr | None = None
    timezone: str | None = Field(None, min_length=1, max_length=100)


class UserUpdateNeed(BaseModel):
    """Payload for updating user's primary stated need/goal."""

    need: str = Field(..., min_length=1, max_length=500)


class MessageResponse(BaseModel):
    """Generic success message."""

    message: str

