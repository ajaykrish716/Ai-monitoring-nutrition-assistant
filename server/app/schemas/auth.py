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
    """Registration payload — minimal account info only."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)


class UserLogin(BaseModel):
    """Login payload."""

    email: EmailStr
    password: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

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
    onboarding_complete: bool = False
    profile: dict = {}


class MessageResponse(BaseModel):
    """Generic success message."""

    message: str
