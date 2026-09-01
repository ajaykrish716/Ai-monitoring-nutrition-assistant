"""
Authentication routes: register, login, and current-user profile.
"""

from fastapi import APIRouter, Depends, status

from app.models.user import UserInDB
from app.schemas.auth import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_user,
    get_current_user,
)
from app.core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account and receive a JWT",
)
async def register(payload: UserRegister):
    """
    Register a new user with minimal info (email, password, name).

    Returns a JWT immediately — the user is auto-logged-in after
    registration and can proceed to AI-driven onboarding.
    """
    _user_id, token = await create_user(payload)
    return TokenResponse(access_token=token)


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in and receive a JWT",
)
async def login(payload: UserLogin):
    """
    Authenticate with email and password.

    Returns a signed JWT access token on success.
    """
    user = await authenticate_user(payload.email, payload.password)
    token = create_access_token(data={"sub": user.id})
    return TokenResponse(access_token=token)


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the current user's profile",
)
async def me(current_user: UserInDB = Depends(get_current_user)):
    """
    Return the authenticated user's profile.

    Identity is determined **solely** from the verified JWT — no user_id
    parameter is accepted from the client.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        onboarding_complete=current_user.onboarding_complete,
        profile=current_user.profile,
    )
