"""
Plan Progress Service — computes nutrition plan duration progress from real tracking data.

Design decisions:
- Plan metadata (duration, start_date, end_date) is stored in the users collection
  under the key `plan_progress_meta` to avoid a new collection.
- Day completion is derived LIVE from existing food_logs and meal_evidence collections.
- A day is "completed" when all 3 planned meals (Breakfast, Lunch, Dinner) have a
  food_log entry OR meal_evidence record for that date — reusing the existing systems.
- Streak calculations re-use the user's existing streak_info to avoid duplication.
"""

import logging
from datetime import datetime, timezone, timedelta, date

from bson import ObjectId

from app.db.mongodb import get_database
from app.core.timezone_utils import get_user_now
from app.schemas.plan_progress import (
    PlanDayBreakdown,
    PlanDayItem,
    PlanProgressResponse,
)

logger = logging.getLogger(__name__)

MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"]


def _date_str_to_date(date_str: str) -> date:
    """Parse 'YYYY-MM-DD' string to a date object."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _generate_date_range(start_str: str, end_str: str) -> list[str]:
    """Generate list of YYYY-MM-DD strings from start_date to end_date inclusive."""
    start = _date_str_to_date(start_str)
    end = _date_str_to_date(end_str)
    delta = (end - start).days
    return [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(delta + 1)]


async def _get_day_breakdown(user_id: str, date_str: str) -> PlanDayBreakdown:
    """
    Check whether Breakfast, Lunch, Dinner are done for a given date.

    A meal is considered "done" if EITHER:
    - There is a food_log entry for that meal_type + date, OR
    - There is a meal_evidence record for that meal_type + date.

    This reuses both existing tracking systems without duplicating logic.
    """
    db = get_database()

    # Fetch food logs for this date (all meals in one query)
    food_logs_cursor = db.food_logs.find(
        {"user_id": user_id, "date": date_str},
        {"meal_type": 1},
    )
    food_logs = await food_logs_cursor.to_list(length=50)
    logged_meals = {doc["meal_type"].capitalize() for doc in food_logs}

    # Fetch meal evidence for this date
    evidence_cursor = db.meal_evidence.find(
        {"user_id": user_id, "date": date_str},
        {"meal_type": 1},
    )
    evidence_docs = await evidence_cursor.to_list(length=10)
    evidenced_meals = {doc["meal_type"].capitalize() for doc in evidence_docs}

    # Union: meal is done if either logged or evidenced
    completed_meals = logged_meals | evidenced_meals

    return PlanDayBreakdown(
        breakfast="Breakfast" in completed_meals,
        lunch="Lunch" in completed_meals,
        dinner="Dinner" in completed_meals,
    )


async def _compute_day_completion(breakdown: PlanDayBreakdown) -> tuple[bool, float]:
    """
    Compute day completion from meal breakdown.
    Returns (is_fully_complete, completion_percentage).
    """
    completed_count = sum([breakdown.breakfast, breakdown.lunch, breakdown.dinner])
    total = len(MEAL_TYPES)
    pct = round((completed_count / total) * 100.0, 1)
    is_complete = completed_count == total
    return is_complete, pct


async def get_plan_progress(user_id: str) -> PlanProgressResponse:
    """
    Compute and return the full nutrition plan progress for the user.

    Dynamically derives day completion from real food_logs and meal_evidence.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        return PlanProgressResponse(has_active_plan=False)

    # Get plan metadata stored during onboarding/profile
    meta = user.get("plan_progress_meta", {})
    duration_days = meta.get("duration_days", 0)
    start_date_str = meta.get("start_date", "")
    end_date_str = meta.get("end_date", "")

    if not duration_days or not start_date_str or not end_date_str:
        return PlanProgressResponse(has_active_plan=False)

    # Get today in user's timezone
    user_tz_name = user.get("timezone", "UTC")
    user_now = get_user_now(user_tz_name)
    today_str = user_now.strftime("%Y-%m-%d")
    today_date = _date_str_to_date(today_str)

    start_date = _date_str_to_date(start_date_str)
    end_date = _date_str_to_date(end_date_str)

    # All dates in the plan
    all_dates = _generate_date_range(start_date_str, end_date_str)

    # Build per-day data (only for dates up to today — future days don't need DB queries)
    day_items: list[PlanDayItem] = []
    completed_days = 0
    completed_streak_dates: list[str] = []

    for d_str in all_dates:
        d = _date_str_to_date(d_str)

        if d > today_date:
            # Future day: no data fetching needed
            day_items.append(PlanDayItem(
                date=d_str,
                status="future",
                completion_percentage=0.0,
                breakdown=PlanDayBreakdown(),
            ))
        else:
            # Past or today: fetch real data
            breakdown = await _get_day_breakdown(user_id, d_str)
            is_complete, pct = await _compute_day_completion(breakdown)

            if is_complete:
                status = "completed"
                completed_days += 1
                completed_streak_dates.append(d_str)
            elif d == today_date:
                status = "pending"  # today, in progress
            else:
                status = "pending"  # past, not completed

            day_items.append(PlanDayItem(
                date=d_str,
                status=status,
                completion_percentage=pct,
                breakdown=breakdown,
            ))

    # Calculate current day number (1-based, within plan period)
    if today_date < start_date:
        current_day = 0  # Plan hasn't started yet
    elif today_date > end_date:
        current_day = duration_days  # Plan ended
    else:
        current_day = (today_date - start_date).days + 1

    remaining_days = max(0, duration_days - completed_days)
    completion_pct = round((completed_days / duration_days) * 100.0, 1) if duration_days > 0 else 0.0
    is_plan_complete = completed_days >= duration_days

    # Compute streak from plan-specific completion sequence
    # (Avoid duplicating from streak_info — we compute plan-specific streak)
    plan_streak = 0
    plan_longest_streak = 0
    temp_streak = 0
    prev_d: date | None = None

    for d_str in sorted(completed_streak_dates):
        d = _date_str_to_date(d_str)
        if prev_d is None or (d - prev_d).days == 1:
            temp_streak += 1
        else:
            temp_streak = 1
        plan_longest_streak = max(plan_longest_streak, temp_streak)
        prev_d = d

    # Current streak: count backwards from today within completed dates
    temp_streak = 0
    check_date = today_date
    completed_set = set(completed_streak_dates)
    while check_date >= start_date:
        if check_date.strftime("%Y-%m-%d") in completed_set:
            temp_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    plan_streak = temp_streak

    # Persist completed_days count back to user doc for quick access (no separate collection)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "plan_progress_meta.completed_days": completed_days,
            "plan_progress_meta.current_streak": plan_streak,
            "plan_progress_meta.longest_streak": plan_longest_streak,
        }},
    )

    return PlanProgressResponse(
        duration_days=duration_days,
        start_date=start_date_str,
        end_date=end_date_str,
        current_day=current_day,
        completed_days=completed_days,
        remaining_days=remaining_days,
        completion_percentage=completion_pct,
        current_streak=plan_streak,
        longest_streak=plan_longest_streak,
        is_plan_complete=is_plan_complete,
        has_active_plan=True,
        days=day_items,
    )


async def initialize_plan(user_id: str, duration_days: int) -> dict:
    """
    Initialize a new nutrition plan for the user.

    Called when the user completes onboarding and selects a plan duration.
    Stores plan metadata in the users collection under `plan_progress_meta`.
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    user_tz_name = user.get("timezone", "UTC")
    user_now = get_user_now(user_tz_name)
    today_str = user_now.strftime("%Y-%m-%d")
    today_date = _date_str_to_date(today_str)

    end_date = today_date + timedelta(days=duration_days - 1)
    end_date_str = end_date.strftime("%Y-%m-%d")

    plan_meta = {
        "duration_days": duration_days,
        "start_date": today_str,
        "end_date": end_date_str,
        "completed_days": 0,
        "current_streak": 0,
        "longest_streak": 0,
        "initialized_at": datetime.now(timezone.utc),
    }

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"plan_progress_meta": plan_meta}},
    )

    logger.info(
        "Initialized %d-day plan for user %s: %s → %s",
        duration_days,
        user_id,
        today_str,
        end_date_str,
    )

    return plan_meta
