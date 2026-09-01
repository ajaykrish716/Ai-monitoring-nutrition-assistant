"""
Authentication business logic and FastAPI dependency for JWT-protected routes.
"""

from datetime import datetime, timezone

import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.mongodb import get_database
from app.models.user import UserInDB
from app.schemas.auth import UserRegister

# ---------------------------------------------------------------------------
# Bearer token extractor
# ---------------------------------------------------------------------------
_bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def create_user(payload: UserRegister) -> tuple[str, str]:
    """
    Create a new user in MongoDB and return (user_id, access_token).

    Only stores minimal fields — profile data is collected later
    during AI-driven onboarding.

    Raises
    ------
    HTTPException 409
        If the email already exists.
    """
    db = get_database()

    # Check for existing email
    existing = await db.users.find_one({"email": payload.email})
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_doc = {
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "onboarding_complete": False,
        "profile": {},
        "conversation_history": [],
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Auto-login: generate token immediately
    token = create_access_token(data={"sub": user_id})
    return user_id, token


async def authenticate_user(email: str, password: str) -> UserInDB:
    """
    Verify credentials and return the user.

    Raises
    ------
    HTTPException 401
        If the email is not found or the password does not match.
    """
    db = get_database()
    doc = await db.users.find_one({"email": email})

    if doc is None or not verify_password(password, doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserInDB(doc)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> UserInDB:
    """
    FastAPI dependency — extracts and validates the JWT from the
    ``Authorization: Bearer <token>`` header, then fetches the user
    from MongoDB.

    The user's identity comes *only* from the verified JWT subject claim.
    """
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_database()

    try:
        doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserInDB(doc)
