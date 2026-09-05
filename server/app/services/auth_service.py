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
from app.services.meal_schedule_service import get_default_meal_schedule
from app.schemas.meal_schedule import DEFAULT_TIMEZONE

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

    initial_facts = {
        "name": payload.name,
        "age": payload.age,
        "gender": payload.gender,
        "height_cm": payload.height,
        "current_weight_kg": payload.current_weight,
    }

    user_doc = {
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "age": payload.age,
        "gender": payload.gender,
        "height": payload.height,
        "current_weight": payload.current_weight,
        "need": "",
        "known_facts": initial_facts,
        "asked_questions": [],
        "answers": {},
        "missing_information": [],
        "onboarding_complete": False,
        "profile": initial_facts,
        "conversation_history": [],
        "meal_schedule": get_default_meal_schedule(),
        "timezone": DEFAULT_TIMEZONE,
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


from fastapi import Request
from app.core.timezone_utils import validate_timezone_name

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> UserInDB:
    """
    FastAPI dependency — extracts and validates the JWT from the
    ``Authorization: Bearer <token>`` header, then fetches the user
    from MongoDB.
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
            detail="Your login session has expired. Please log in again.",
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

    # Auto-sync timezone if client provided X-Timezone and user is currently on default UTC
    client_tz = request.headers.get("x-timezone")
    if client_tz and validate_timezone_name(client_tz):
        if doc.get("timezone") in ("UTC", None, ""):
            doc["timezone"] = client_tz
            await db.users.update_one({"_id": doc["_id"]}, {"$set": {"timezone": client_tz}})

    if "meal_schedule" not in doc:
        doc["meal_schedule"] = get_default_meal_schedule()
    if "timezone" not in doc:
        doc["timezone"] = DEFAULT_TIMEZONE

    return UserInDB(doc)


async def update_user_profile(user_id: str, updates: dict) -> UserInDB:
    """
    Update basic user profile metrics in MongoDB and return the updated user.
    """
    db = get_database()

    # Filter out None values
    clean_updates = {k: v for k, v in updates.items() if v is not None}
    if not clean_updates:
        doc = await db.users.find_one({"_id": ObjectId(user_id)})
        return UserInDB(doc)

    # If email is updated, verify uniqueness
    if "email" in clean_updates:
        existing = await db.users.find_one({
            "email": clean_updates["email"],
            "_id": {"$ne": ObjectId(user_id)},
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

    # Sync known_facts and profile sub-dict
    sync_profile = {}
    if "name" in clean_updates:
        sync_profile["known_facts.name"] = clean_updates["name"]
        sync_profile["profile.name"] = clean_updates["name"]
    if "age" in clean_updates:
        sync_profile["known_facts.age"] = clean_updates["age"]
        sync_profile["profile.age"] = clean_updates["age"]
    if "gender" in clean_updates:
        sync_profile["known_facts.gender"] = clean_updates["gender"]
        sync_profile["profile.gender"] = clean_updates["gender"]
    if "height" in clean_updates:
        sync_profile["known_facts.height_cm"] = clean_updates["height"]
        sync_profile["profile.height_cm"] = clean_updates["height"]
    if "current_weight" in clean_updates:
        sync_profile["known_facts.current_weight_kg"] = clean_updates["current_weight"]
        sync_profile["profile.current_weight_kg"] = clean_updates["current_weight"]

    set_dict = {**clean_updates, **sync_profile}

    result = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": set_dict},
        return_document=True,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return UserInDB(result)


async def update_user_need(user_id: str, need: str) -> UserInDB:
    """
    Update the user's primary stated need/goal in MongoDB.
    Also synchronizes with the goals list.
    """
    db = get_database()
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    goals = list(doc.get("goals", []))
    if goals:
        # Update the first active goal description
        updated_first = False
        for g in goals:
            if g.get("status") == "active":
                g["description"] = need
                g["updated_at"] = now_iso
                updated_first = True
                break
        if not updated_first:
            goals.append({
                "id": "goal_1",
                "description": need,
                "status": "active",
                "priority": 1,
                "created_at": now_iso,
                "updated_at": now_iso,
            })
    else:
        goals = [{
            "id": "goal_1",
            "description": need,
            "status": "active",
            "priority": 1,
            "created_at": now_iso,
            "updated_at": now_iso,
        }]

    result = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "need": need,
                "goals": goals,
                "known_facts.need": need,
                "profile.need": need,
            }
        },
        return_document=True,
    )
    return UserInDB(result)


async def get_user_goals(user_id: str) -> list[dict]:
    """
    Retrieve all goals for a user.
    If no goals exist but a legacy `need` exists, migrate it to the goals array.
    """
    db = get_database()
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    goals = list(doc.get("goals", []))
    need = (doc.get("need") or doc.get("profile", {}).get("need") or "").strip()

    if not goals and need:
        now_iso = datetime.now(timezone.utc).isoformat()
        initial_goal = {
            "id": "goal_1",
            "description": need,
            "status": "active",
            "priority": 1,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        goals = [initial_goal]
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"goals": goals}},
        )

    return goals


async def add_user_goal(user_id: str, description: str, priority: int | None = None) -> dict:
    """
    Add a new goal to the user's active goals list.
    """
    db = get_database()
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    import uuid
    goal_id = f"goal_{uuid.uuid4().hex[:8]}"

    new_goal = {
        "id": goal_id,
        "description": description.strip(),
        "status": "active",
        "priority": priority,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    goals = list(doc.get("goals", []))
    goals.append(new_goal)

    # Sync primary need string with active goals
    active_descs = [g["description"] for g in goals if g.get("status") == "active"]
    combined_need = " | ".join(active_descs) if active_descs else description

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "goals": goals,
                "need": combined_need,
                "known_facts.need": combined_need,
                "profile.need": combined_need,
            }
        },
    )

    return new_goal


async def update_user_goal(
    user_id: str,
    goal_id: str,
    description: str | None = None,
    status_val: str | None = None,
    priority: int | None = None,
) -> dict:
    """
    Update an existing goal's description, status, or priority.
    """
    db = get_database()
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    goals = list(doc.get("goals", []))
    now_iso = datetime.now(timezone.utc).isoformat()

    found_goal = None
    for g in goals:
        if g.get("id") == goal_id:
            if description is not None:
                g["description"] = description.strip()
            if status_val is not None:
                g["status"] = status_val
            if priority is not None:
                g["priority"] = priority
            g["updated_at"] = now_iso
            found_goal = g
            break

    if not found_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found.",
        )

    active_descs = [g["description"] for g in goals if g.get("status") == "active"]
    combined_need = " | ".join(active_descs) if active_descs else ""

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "goals": goals,
                "need": combined_need,
                "known_facts.need": combined_need,
                "profile.need": combined_need,
            }
        },
    )

    return found_goal


async def delete_user_goal(user_id: str, goal_id: str) -> bool:
    """
    Remove or archive a goal from the user's goals list.
    """
    db = get_database()
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    goals = [g for g in doc.get("goals", []) if g.get("id") != goal_id]
    active_descs = [g["description"] for g in goals if g.get("status") == "active"]
    combined_need = " | ".join(active_descs) if active_descs else ""

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "goals": goals,
                "need": combined_need,
                "known_facts.need": combined_need,
                "profile.need": combined_need,
            }
        },
    )

    return True

