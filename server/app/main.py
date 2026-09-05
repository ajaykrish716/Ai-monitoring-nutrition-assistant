"""
FastAPI application entry-point.

Start with:
    uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.mongodb import close_db, connect_db
from app.routes.auth import router as auth_router
from app.routes.onboarding import router as onboarding_router
from app.routes.daily_plan import router as daily_plan_router
from app.routes.tracking import router as tracking_router
from app.routes.nutri import router as nutri_router
from app.routes.meal_schedule import router as meal_schedule_router


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to MongoDB on startup, close on shutdown."""
    await connect_db()
    yield
    await close_db()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NutriTrack API",
    description="AI-Powered Personalized Nutrition and Diet Adherence Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — origins from environment + local dev origins regex
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(daily_plan_router)
app.include_router(tracking_router)
app.include_router(nutri_router)
app.include_router(meal_schedule_router)


from fastapi import Depends, HTTPException, status
from app.models.user import UserInDB
from app.schemas.tracking import FoodLogEntry, LogFoodRequest
from app.services.auth_service import get_current_user
from app.services.tracking_service import log_food_item

@app.post(
    "/meal-logs",
    response_model=FoodLogEntry,
    status_code=status.HTTP_201_CREATED,
    tags=["Tracking & Analytics"],
    summary="Direct meal-logs endpoint strictly validated server-side",
)
async def post_meal_logs(
    payload: LogFoodRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    try:
        return await log_food_item(current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

@app.get("/", tags=["Health"])
async def health_check():
    """Simple health-check endpoint."""
    return {"status": "ok", "service": "NutriTrack API"}
