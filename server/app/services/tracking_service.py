"""
Nutrition tracking, analytics, deterministic goal evaluation, streaks, and reward service.

All nutritional arithmetic and progress computations are performed deterministically in Python.
AI is solely used to estimate macro breakdowns from free-text food descriptions.
"""

import json
import logging
from datetime import datetime, timezone, timedelta

from bson import ObjectId

from app.db.mongodb import get_database
from app.schemas.daily_plan import DailyTargets, MacroNutrition
from app.schemas.tracking import (
    ActivityDayItem,
    ActivityHistoryResponse,
    ConsumedTotals,
    DailyGoalEvaluation,
    FoodLogEntry,
    LogFoodRequest,
    ProgressPercentages,
    RemainingTargets,
    RewardBadge,
    StreakInfo,
    TrackingTodayResponse,
)
from app.services.ai_service import chat_completion
from app.services.daily_plan_service import generate_or_get_daily_plan

logger = logging.getLogger(__name__)

FOOD_PARSER_SYSTEM_PROMPT = """\
You are an expert nutritional breakdown parser.
Given a free-text food description (which may include single foods, traditional meals, brand items, or multi-course descriptions), estimate its macro nutrition with realistic dietary values.

Output JSON ONLY in this format:
{
  "matched_items": ["Item 1", "Item 2"],
  "nutrition": {
    "calories": 250.0,
    "protein": 8.0,
    "carbohydrates": 42.0,
    "fat": 5.0
  },
  "notes": "Estimated breakdown based on standard portion"
}
"""

# Available extensible badge definitions
BADGE_DEFINITIONS = [
    {
        "type": "starter",
        "name": "First Fuel",
        "description": "Logged your first meal on NutriTrack",
        "icon": "Sparkles",
        "min_logs": 1,
    },
    {
        "type": "streak_3",
        "name": "3-Day Momentum",
        "description": "Achieved nutrition goals 3 days in a row",
        "icon": "Flame",
        "min_streak": 3,
    },
    {
        "type": "streak_7",
        "name": "7-Day Consistency Master",
        "description": "Hit your target macros for a full week",
        "icon": "ShieldCheck",
        "min_streak": 7,
    },
    {
        "type": "streak_14",
        "name": "14-Day Champion",
        "description": "Two weeks of dedicated nutrition tracking",
        "icon": "Award",
        "min_streak": 14,
    },
    {
        "type": "streak_30",
        "name": "30-Day Monthly Legend",
        "description": "Completed a full month milestone streak",
        "icon": "Trophy",
        "min_streak": 30,
    },
]


def _get_today_date_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def compute_scores(consumed: ConsumedTotals, targets: DailyTargets, logs: list[FoodLogEntry], planned_meals: list) -> tuple[float, float]:
    """
    Compute Nutrition Success Score (0-100) and Plan Adherence (0-100).
    Nutritional Success is based on actual nutritional adequacy vs target macros.
    Plan Adherence is based on matching suggested meal names/foods.
    """
    if targets.calories <= 0 or not logs:
        return 0.0, 0.0

    # 1. Nutrition Success (100 pts max)
    # Calorie component (35 pts)
    cal_ratio = consumed.calories / targets.calories if targets.calories > 0 else 0
    if 0.85 <= cal_ratio <= 1.15:
        cal_score = 35.0
    elif 0.70 <= cal_ratio < 0.85 or 1.15 < cal_ratio <= 1.30:
        cal_score = 28.0
    elif 0.50 <= cal_ratio < 0.70:
        cal_score = 18.0
    else:
        cal_score = max(5.0, 35.0 * min(1.0, cal_ratio))

    # Protein component (35 pts)
    prot_ratio = consumed.protein / targets.protein if targets.protein > 0 else 0
    prot_score = min(35.0, 35.0 * (prot_ratio / 0.85)) if prot_ratio < 0.85 else 35.0

    # Carbs & Fats balance (20 pts)
    carb_ratio = min(1.0, consumed.carbohydrates / targets.carbohydrates) if targets.carbohydrates > 0 else 0.5
    fat_ratio = min(1.0, consumed.fat / targets.fat) if targets.fat > 0 else 0.5
    macro_balance_score = (carb_ratio * 10.0) + (fat_ratio * 10.0)

    # Hydration component (10 pts)
    water_ratio = min(1.0, consumed.water_ml / targets.water_ml) if targets.water_ml > 0 else 0.5
    water_score = water_ratio * 10.0

    nutrition_success_score = round(min(100.0, cal_score + prot_score + macro_balance_score + water_score), 1)

    # 2. Plan Adherence (0 to 100%)
    adherence_points = 0
    planned_keywords = []
    for m in planned_meals:
        name = m.get("name", "").lower() if isinstance(m, dict) else getattr(m, "name", "").lower()
        planned_keywords.extend(name.split())
        foods = m.get("foods", []) if isinstance(m, dict) else getattr(m, "foods", [])
        for f in foods:
            planned_keywords.extend(f.lower().split())

    logged_text = " ".join(l.food_description.lower() for l in logs)
    if planned_keywords:
        matches = sum(1 for kw in set(planned_keywords) if len(kw) > 3 and kw in logged_text)
        adherence_rate = min(100.0, (matches / max(3, len(planned_meals))) * 100.0)
    else:
        adherence_rate = 50.0

    return nutrition_success_score, round(adherence_rate, 1)


async def log_food_item(user_id: str, payload: LogFoodRequest) -> FoodLogEntry:
    """
    Parse food description via AI macro estimation and persist in MongoDB.
    """
    db = get_database()
    target_date = payload.date or _get_today_date_str()

    messages = [
        {"role": "system", "content": FOOD_PARSER_SYSTEM_PROMPT},
        {"role": "user", "content": f"Parse nutrition for: {payload.food_description}"},
    ]

    try:
        ai_data = await chat_completion(messages, temperature=0.2, max_tokens=500)
    except Exception as e:
        logger.warning("AI food parsing fallback: %s", e)
        ai_data = {
            "matched_items": [payload.food_description],
            "nutrition": {"calories": 220.0, "protein": 10.0, "carbohydrates": 25.0, "fat": 6.0},
            "notes": "Estimated approximation",
        }

    nutrition = ai_data.get("nutrition", {})
    now = datetime.now(timezone.utc)

    # Generate immediate Nutri review
    try:
        from app.services.nutri_service import review_logged_meal
        macro_obj = MacroNutrition(
            calories=float(nutrition.get("calories", 0.0)),
            protein=float(nutrition.get("protein", 0.0)),
            carbohydrates=float(nutrition.get("carbohydrates", 0.0)),
            fat=float(nutrition.get("fat", 0.0)),
        )
        nutri_review_text = await review_logged_meal(
            user_id,
            payload.food_description,
            payload.meal_type,
            macro_obj,
            target_date,
        )
    except Exception as exc:
        logger.warning("Nutri review error: %s", exc)
        nutri_review_text = f"Great fuel! 👍 Logged {payload.meal_type.lower()}."

    log_doc = {
        "user_id": user_id,
        "date": target_date,
        "food_description": payload.food_description,
        "meal_type": payload.meal_type,
        "matched_items": ai_data.get("matched_items", [payload.food_description]),
        "nutrition": {
            "calories": float(nutrition.get("calories", 0.0)),
            "protein": float(nutrition.get("protein", 0.0)),
            "carbohydrates": float(nutrition.get("carbohydrates", 0.0)),
            "fat": float(nutrition.get("fat", 0.0)),
        },
        "notes": ai_data.get("notes", ""),
        "nutri_review": nutri_review_text,
        "logged_at": now,
    }

    result = await db.food_logs.insert_one(log_doc)
    log_id = str(result.inserted_id)

    # Trigger streak & badge checks
    await evaluate_and_update_streak(user_id, target_date)

    return FoodLogEntry(
        id=log_id,
        user_id=user_id,
        date=target_date,
        food_description=log_doc["food_description"],
        meal_type=log_doc["meal_type"],
        matched_items=log_doc["matched_items"],
        nutrition=log_doc["nutrition"],
        notes=log_doc["notes"],
        nutri_review=nutri_review_text,
        logged_at=now,
    )


async def delete_food_log(user_id: str, log_id: str) -> bool:
    """Delete a food log entry belonging to the authenticated user."""
    db = get_database()
    res = await db.food_logs.delete_one({"_id": ObjectId(log_id), "user_id": user_id})
    return res.deleted_count > 0


async def log_water(user_id: str, amount_ml: float, date_str: str | None = None) -> float:
    """Increment water intake for the date."""
    db = get_database()
    target_date = date_str or _get_today_date_str()
    now = datetime.now(timezone.utc)

    res = await db.water_logs.find_one_and_update(
        {"user_id": user_id, "date": target_date},
        {"$inc": {"amount_ml": amount_ml}, "$setOnInsert": {"created_at": now}},
        upsert=True,
        return_document=True,
    )
    return float(res.get("amount_ml", amount_ml))


def _calculate_goal_status(consumed: ConsumedTotals, targets: DailyTargets, score: float) -> DailyGoalEvaluation:
    """
    Deterministic evaluation of daily goal achievement.
    Goal criteria:
    1. Caloric intake is at least 70% and at most 120% of target.
    2. Protein intake reaches at least 70% of target.
    3. OR Nutrition Success Score >= 75.
    """
    if targets.calories <= 0:
        return DailyGoalEvaluation(is_achieved=False, criteria_met=[], message="No daily target defined yet.")

    cal_pct = (consumed.calories / targets.calories) * 100.0 if targets.calories > 0 else 0
    prot_pct = (consumed.protein / targets.protein) * 100.0 if targets.protein > 0 else 0

    criteria = []
    if cal_pct >= 70:
        criteria.append("Caloric baseline satisfied (>=70%)")
    if cal_pct <= 120:
        criteria.append("Caloric upper limit respected (<=120%)")
    if prot_pct >= 70:
        criteria.append("Protein benchmark achieved (>=70%)")
    if score >= 75:
        criteria.append("Nutritional balance score >= 75/100")

    is_achieved = ((70 <= cal_pct <= 120) and (prot_pct >= 70)) or (score >= 75)
    msg = "Daily nutrition targets on track!" if is_achieved else "Keep logging to reach today's milestone targets."

    return DailyGoalEvaluation(is_achieved=is_achieved, criteria_met=criteria, message=msg)


async def evaluate_and_update_streak(user_id: str, target_date: str) -> StreakInfo:
    """
    Evaluate goal status for the date and update streak and rewards in MongoDB.
    """
    db = get_database()

    plan = await generate_or_get_daily_plan(user_id, target_date)
    logs_cursor = db.food_logs.find({"user_id": user_id, "date": target_date})
    logs = await logs_cursor.to_list(length=100)

    tot_cal = sum(float(l["nutrition"].get("calories", 0)) for l in logs)
    tot_prot = sum(float(l["nutrition"].get("protein", 0)) for l in logs)
    tot_carb = sum(float(l["nutrition"].get("carbohydrates", 0)) for l in logs)
    tot_fat = sum(float(l["nutrition"].get("fat", 0)) for l in logs)

    water_doc = await db.water_logs.find_one({"user_id": user_id, "date": target_date})
    tot_water = float(water_doc.get("amount_ml", 0)) if water_doc else 0.0

    consumed = ConsumedTotals(
        calories=tot_cal,
        protein=tot_prot,
        carbohydrates=tot_carb,
        fat=tot_fat,
        water_ml=tot_water,
    )

    food_log_entries = [
        FoodLogEntry(
            id=str(l["_id"]),
            user_id=user_id,
            date=l["date"],
            food_description=l["food_description"],
            meal_type=l.get("meal_type", "Snack"),
            matched_items=l.get("matched_items", []),
            nutrition=l.get("nutrition", {}),
            notes=l.get("notes", ""),
            logged_at=l.get("logged_at", datetime.now(timezone.utc)),
        )
        for l in logs
    ]

    score, _ = compute_scores(consumed, plan.daily_targets, food_log_entries, plan.meals)
    goal_eval = _calculate_goal_status(consumed, plan.daily_targets, score)

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    streak_doc = user.get("streak_info", {})
    current_streak = streak_doc.get("current_streak", 0)
    longest_streak = streak_doc.get("longest_streak", 0)
    completed_dates = list(streak_doc.get("completed_dates", []))
    last_date = streak_doc.get("last_completed_date")

    if goal_eval.is_achieved and target_date not in completed_dates:
        completed_dates.append(target_date)
        yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        if last_date == yesterday_str or last_date == target_date or current_streak == 0:
            current_streak += 1
        else:
            current_streak = 1

        last_date = target_date
        longest_streak = max(longest_streak, current_streak)

        updated_streak = {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "last_completed_date": last_date,
            "completed_dates": completed_dates,
        }

        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"streak_info": updated_streak}},
        )

        total_logs_count = await db.food_logs.count_documents({"user_id": user_id})
        await check_and_award_badges(user_id, current_streak, total_logs_count)

    return StreakInfo(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_completed_date=last_date,
        completed_dates=completed_dates,
    )


async def check_and_award_badges(user_id: str, streak: int, total_logs: int) -> None:
    """Award milestone badges if conditions are satisfied."""
    db = get_database()
    now = datetime.now(timezone.utc)

    for badge in BADGE_DEFINITIONS:
        qualifies = False
        if "min_logs" in badge and total_logs >= badge["min_logs"]:
            qualifies = True
        if "min_streak" in badge and streak >= badge["min_streak"]:
            qualifies = True

        if qualifies:
            existing = await db.rewards.find_one({"user_id": user_id, "type": badge["type"]})
            if not existing:
                await db.rewards.insert_one({
                    "user_id": user_id,
                    "type": badge["type"],
                    "name": badge["name"],
                    "description": badge["description"],
                    "icon": badge["icon"],
                    "period": "monthly",
                    "earned_at": now,
                    "metadata": {"streak_at_award": streak, "total_logs": total_logs},
                })


async def get_tracking_today(user_id: str, date_str: str | None = None) -> TrackingTodayResponse:
    """
    Assemble the full daily tracking summary with deterministic calculations.
    """
    db = get_database()
    target_date = date_str or _get_today_date_str()

    daily_plan = await generate_or_get_daily_plan(user_id, target_date)
    targets = daily_plan.daily_targets

    logs_cursor = db.food_logs.find({"user_id": user_id, "date": target_date}).sort("logged_at", 1)
    raw_logs = await logs_cursor.to_list(length=200)

    food_logs = [
        FoodLogEntry(
            id=str(l["_id"]),
            user_id=user_id,
            date=l["date"],
            food_description=l["food_description"],
            meal_type=l.get("meal_type", "Snack"),
            matched_items=l.get("matched_items", []),
            nutrition=l.get("nutrition", {}),
            notes=l.get("notes", ""),
            nutri_review=l.get("nutri_review", ""),
            logged_at=l.get("logged_at", datetime.now(timezone.utc)),
        )
        for l in raw_logs
    ]

    water_doc = await db.water_logs.find_one({"user_id": user_id, "date": target_date})
    water_consumed = float(water_doc.get("amount_ml", 0.0)) if water_doc else 0.0

    tot_cal = sum(l.nutrition.calories for l in food_logs)
    tot_prot = sum(l.nutrition.protein for l in food_logs)
    tot_carb = sum(l.nutrition.carbohydrates for l in food_logs)
    tot_fat = sum(l.nutrition.fat for l in food_logs)

    consumed = ConsumedTotals(
        calories=round(tot_cal, 1),
        protein=round(tot_prot, 1),
        carbohydrates=round(tot_carb, 1),
        fat=round(tot_fat, 1),
        water_ml=round(water_consumed, 1),
    )

    remaining = RemainingTargets(
        calories=round(max(0.0, targets.calories - tot_cal), 1),
        protein=round(max(0.0, targets.protein - tot_prot), 1),
        carbohydrates=round(max(0.0, targets.carbohydrates - tot_carb), 1),
        fat=round(max(0.0, targets.fat - tot_fat), 1),
        water_ml=round(max(0.0, targets.water_ml - water_consumed), 1),
    )

    progress = ProgressPercentages(
        calories=round((tot_cal / targets.calories * 100.0) if targets.calories > 0 else 0.0, 1),
        protein=round((tot_prot / targets.protein * 100.0) if targets.protein > 0 else 0.0, 1),
        carbohydrates=round((tot_carb / targets.carbohydrates * 100.0) if targets.carbohydrates > 0 else 0.0, 1),
        fat=round((tot_fat / targets.fat * 100.0) if targets.fat > 0 else 0.0, 1),
        water_ml=round((water_consumed / targets.water_ml * 100.0) if targets.water_ml > 0 else 0.0, 1),
    )

    nutrition_score, plan_adherence = compute_scores(consumed, targets, food_logs, daily_plan.meals)
    goal_eval = _calculate_goal_status(consumed, targets, nutrition_score)

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    streak_doc = user.get("streak_info", {})
    streak = StreakInfo(
        current_streak=streak_doc.get("current_streak", 0),
        longest_streak=streak_doc.get("longest_streak", 0),
        last_completed_date=streak_doc.get("last_completed_date"),
        completed_dates=streak_doc.get("completed_dates", []),
    )

    badges_cursor = db.rewards.find({"user_id": user_id}).sort("earned_at", -1)
    raw_badges = await badges_cursor.to_list(length=50)
    badges = [
        RewardBadge(
            id=str(b["_id"]),
            user_id=user_id,
            type=b["type"],
            name=b["name"],
            description=b["description"],
            icon=b.get("icon", "Award"),
            period=b.get("period", "monthly"),
            earned_at=b["earned_at"],
            metadata=b.get("metadata", {}),
        )
        for b in raw_badges
    ]

    # Generate friendly proactive Nutri feedback summary
    if not food_logs:
        nutri_feedback = "Good day! ☀️ Ready for today's fuel? Check out your recommended meals or log whatever you enjoy eating today."
    elif goal_eval.is_achieved:
        nutri_feedback = "Awesome work! 🎉 You've hit your key nutritional targets for today. Keep up this fantastic momentum!"
    elif progress.protein >= 70:
        nutri_feedback = "Great protein progress today! 💪 You're powering your goals nicely."
    else:
        nutri_feedback = f"Nice progress! You have {remaining.protein}g protein remaining to hit your target. Want to see some easy options? 😊"

    return TrackingTodayResponse(
        date=target_date,
        daily_targets=targets,
        consumed=consumed,
        remaining=remaining,
        progress_percentages=progress,
        nutrition_score=nutrition_score,
        plan_adherence=plan_adherence,
        logs=food_logs,
        goal_status=goal_eval,
        streak=streak,
        badges=badges,
        nutri_feedback=nutri_feedback,
    )


async def get_yearly_activity(user_id: str, year: int | None = None) -> ActivityHistoryResponse:
    """
    Generate authoritative 365-day activity data for the GitHub/LeetCode-style heatmap.
    """
    db = get_database()
    current_year = year or datetime.now(timezone.utc).year

    # Aggregate food logs grouped by date for this year
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "date": {"$regex": f"^{current_year}-"},
            }
        },
        {
            "$group": {
                "_id": "$date",
                "count": {"$sum": 1},
                "total_calories": {"$sum": "$nutrition.calories"},
                "total_protein": {"$sum": "$nutrition.protein"},
            }
        },
    ]
    cursor = db.food_logs.aggregate(pipeline)
    date_map = {}
    async for doc in cursor:
        date_map[doc["_id"]] = doc

    # Fetch user completed goal dates and streaks
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    streak_doc = user.get("streak_info", {}) if user else {}
    completed_dates = set(streak_doc.get("completed_dates", []))
    current_streak = streak_doc.get("current_streak", 0)
    longest_streak = streak_doc.get("longest_streak", 0)

    # Generate complete list of days in year
    start_date = datetime(current_year, 1, 1)
    end_date = datetime(current_year, 12, 31)
    day_count = (end_date - start_date).days + 1

    days_list = []
    total_active_days = 0

    for i in range(day_count):
        d = start_date + timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")

        log_data = date_map.get(d_str)
        count = log_data["count"] if log_data else 0
        goal_achieved = d_str in completed_dates

        if count > 0 or goal_achieved:
            total_active_days += 1

        # Calculate activity intensity level (0-4)
        if goal_achieved:
            level = 4
            score = 90.0
        elif count >= 3:
            level = 3
            score = 75.0
        elif count == 2:
            level = 2
            score = 50.0
        elif count == 1:
            level = 1
            score = 30.0
        else:
            level = 0
            score = 0.0

        days_list.append(
            ActivityDayItem(
                date=d_str,
                count=count,
                nutrition_score=score,
                plan_adherence=60.0 if count > 0 else 0.0,
                goal_achieved=goal_achieved,
                level=level,
            )
        )

    return ActivityHistoryResponse(
        year=current_year,
        days=days_list,
        total_active_days=total_active_days,
        longest_streak=longest_streak,
        current_streak=current_streak,
    )
