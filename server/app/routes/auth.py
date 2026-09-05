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
    UserUpdateProfile,
    UserUpdateNeed,
    GoalItem,
    GoalCreate,
    GoalUpdate,
    MessageResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_user,
    get_current_user,
    update_user_profile,
    update_user_need,
    get_user_goals,
    add_user_goal,
    update_user_goal,
    delete_user_goal,
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
    Register a new user with baseline info.

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
    Return the authenticated user's profile including multiple active goals.

    Identity is determined **solely** from the verified JWT — no user_id
    parameter is accepted from the client.
    """
    goals = await get_user_goals(current_user.id)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        age=current_user.age,
        gender=current_user.gender,
        height=current_user.height,
        current_weight=current_user.current_weight,
        need=current_user.need,
        goals=[GoalItem(**g) for g in goals],
        onboarding_complete=current_user.onboarding_complete,
        profile=current_user.profile,
        meal_schedule=current_user.meal_schedule,
        timezone=current_user.timezone,
    )


# ---------------------------------------------------------------------------
# PUT /auth/profile
# ---------------------------------------------------------------------------

@router.put(
    "/profile",
    response_model=UserResponse,
    summary="Update current user's basic profile metrics",
)
async def update_profile(
    payload: UserUpdateProfile,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update name, age, gender, height, current_weight, and email in MongoDB.
    """
    updated_user = await update_user_profile(current_user.id, payload.model_dump(exclude_unset=True))
    goals = await get_user_goals(current_user.id)
    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        name=updated_user.name,
        age=updated_user.age,
        gender=updated_user.gender,
        height=updated_user.height,
        current_weight=updated_user.current_weight,
        need=updated_user.need,
        goals=[GoalItem(**g) for g in goals],
        onboarding_complete=updated_user.onboarding_complete,
        profile=updated_user.profile,
        meal_schedule=updated_user.meal_schedule,
        timezone=updated_user.timezone,
    )


# ---------------------------------------------------------------------------
# PUT /auth/need
# ---------------------------------------------------------------------------

@router.put(
    "/need",
    response_model=UserResponse,
    summary="Update current user's primary stated need",
)
async def update_need(
    payload: UserUpdateNeed,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update stated need in MongoDB.
    """
    updated_user = await update_user_need(current_user.id, payload.need)
    goals = await get_user_goals(current_user.id)
    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        name=updated_user.name,
        age=updated_user.age,
        gender=updated_user.gender,
        height=updated_user.height,
        current_weight=updated_user.current_weight,
        need=updated_user.need,
        goals=[GoalItem(**g) for g in goals],
        onboarding_complete=updated_user.onboarding_complete,
        profile=updated_user.profile,
        meal_schedule=updated_user.meal_schedule,
        timezone=updated_user.timezone,
    )


# ---------------------------------------------------------------------------
# GET /auth/goals
# ---------------------------------------------------------------------------

@router.get(
    "/goals",
    response_model=list[GoalItem],
    summary="Get current user's multiple goals",
)
async def list_goals(current_user: UserInDB = Depends(get_current_user)):
    """
    Return the user's active and archived wellness goals.
    """
    goals = await get_user_goals(current_user.id)
    return [GoalItem(**g) for g in goals]


# ---------------------------------------------------------------------------
# POST /auth/goals
# ---------------------------------------------------------------------------

@router.post(
    "/goals",
    response_model=GoalItem,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new goal to current user's profile",
)
async def create_goal(
    payload: GoalCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Add a new arbitrary natural-language goal for the user.
    """
    new_goal = await add_user_goal(
        user_id=current_user.id,
        description=payload.description,
        priority=payload.priority,
    )
    return GoalItem(**new_goal)


# ---------------------------------------------------------------------------
# PUT /auth/goals/{goal_id}
# ---------------------------------------------------------------------------

@router.put(
    "/goals/{goal_id}",
    response_model=GoalItem,
    summary="Update an existing goal",
)
async def modify_goal(
    goal_id: str,
    payload: GoalUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update goal description, status (active/inactive/archived), or priority.
    """
    updated_goal = await update_user_goal(
        user_id=current_user.id,
        goal_id=goal_id,
        description=payload.description,
        status_val=payload.status,
        priority=payload.priority,
    )
    return GoalItem(**updated_goal)


# ---------------------------------------------------------------------------
# DELETE /auth/goals/{goal_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/goals/{goal_id}",
    response_model=MessageResponse,
    summary="Remove a goal from user profile",
)
async def remove_goal(
    goal_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Delete or archive a user's goal.
    """
    await delete_user_goal(current_user.id, goal_id)
    return MessageResponse(message="Goal removed successfully.")

