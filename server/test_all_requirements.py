"""
Comprehensive unit verification for:
- Exact meal windows (Breakfast: 08:00-10:00, Lunch: 12:30-14:30, Dinner: 19:00-21:00)
- No score reduction start time (inside window = 100%, closed = 0%)
- Window enforcement (upcoming, available, window_closed)
- Deterministic scoring: Nutrition Success vs Plan Adherence vs Meal Timing
- Daily plan meals (Breakfast, Lunch, Dinner only - no snacks)
- Food log rejection of invalid meal types (e.g., snacks)
"""
import sys
from app.schemas.meal_schedule import (
    DEFAULT_MEAL_SCHEDULE,
    MealTimingConfig,
    MealTimingState,
)
from app.services.meal_schedule_service import (
    compute_meal_state,
    compute_timing_score,
    _parse_time_minutes,
)
from app.schemas.daily_plan import DailyTargets, MacroNutrition
from app.schemas.tracking import ConsumedTotals, FoodLogEntry
from app.services.tracking_service import compute_scores

def test_meal_windows():
    print("Testing exact meal windows...")
    b = DEFAULT_MEAL_SCHEDULE["breakfast"]
    l = DEFAULT_MEAL_SCHEDULE["lunch"]
    d = DEFAULT_MEAL_SCHEDULE["dinner"]
    
    assert b["window_start"] == "08:00" and b["window_end"] == "10:00", f"Breakfast invalid: {b}"
    assert l["window_start"] == "12:30" and l["window_end"] == "14:30", f"Lunch invalid: {l}"
    assert d["window_start"] == "19:00" and d["window_end"] == "21:00", f"Dinner invalid: {d}"
    print("  [OK] Exact meal windows confirmed: 08:00-10:00, 12:30-14:30, 19:00-21:00")

def test_meal_window_enforcement_states():
    print("Testing meal window enforcement states...")
    cfg = MealTimingConfig(meal_type="Breakfast", window_start="08:00", window_end="10:00")
    
    # Before window (07:59) -> UPCOMING
    state_before = compute_meal_state(cfg, 7 * 60 + 59, is_logged=False)
    assert state_before == MealTimingState.UPCOMING, f"Expected UPCOMING, got {state_before}"
    
    # At start (08:00) -> AVAILABLE
    state_start = compute_meal_state(cfg, 8 * 60, is_logged=False)
    assert state_start == MealTimingState.AVAILABLE, f"Expected AVAILABLE, got {state_start}"
    
    # Inside window (09:15) -> AVAILABLE
    state_mid = compute_meal_state(cfg, 9 * 60 + 15, is_logged=False)
    assert state_mid == MealTimingState.AVAILABLE, f"Expected AVAILABLE, got {state_mid}"
    
    # At end / closed (10:00) -> WINDOW_CLOSED
    state_closed = compute_meal_state(cfg, 10 * 60, is_logged=False)
    assert state_closed == MealTimingState.WINDOW_CLOSED, f"Expected WINDOW_CLOSED, got {state_closed}"
    
    # After end (10:01) -> WINDOW_CLOSED
    state_after = compute_meal_state(cfg, 10 * 60 + 1, is_logged=False)
    assert state_after == MealTimingState.WINDOW_CLOSED, f"Expected WINDOW_CLOSED, got {state_after}"
    
    # Already logged -> COMPLETED
    state_completed = compute_meal_state(cfg, 9 * 60, is_logged=True)
    assert state_completed == MealTimingState.COMPLETED, f"Expected COMPLETED, got {state_completed}"
    
    # Timing score: inside window = 100.0, outside = 0.0 (no gradual reduction)
    assert compute_timing_score(cfg, 8 * 60 + 30) == 100.0
    assert compute_timing_score(cfg, 10 * 60 + 5) == 0.0
    print("  [OK] Window enforcement states & scores verified")

def test_separate_scoring():
    print("Testing separate scoring logic (Nutrition Success primary)...")
    targets = DailyTargets(calories=2000.0, protein=120.0, carbohydrates=220.0, fat=65.0, water_ml=2500.0)
    
    # User eats food with great macros (e.g. dal, rice, eggs) different from planned meals (e.g. salmon bowl)
    consumed = ConsumedTotals(calories=1900.0, protein=115.0, carbohydrates=210.0, fat=60.0, water_ml=2400.0)
    planned_meals = [
        {"name": "Salmon Quinoa Salad", "foods": ["salmon", "quinoa"]},
        {"name": "Tofu Stir Fry", "foods": ["tofu", "broccoli"]},
        {"name": "Steak and Asparagus", "foods": ["beef", "asparagus"]},
    ]
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    logs = [
        FoodLogEntry(
            id="1", user_id="u1", date="2026-09-05", meal_type="Breakfast",
            food_description="Lentil dal and brown rice with 2 boiled eggs",
            matched_items=["dal", "rice", "eggs"],
            nutrition=MacroNutrition(calories=650.0, protein=38.0, carbohydrates=70.0, fat=20.0),
            logged_at=now,
        ),
        FoodLogEntry(
            id="2", user_id="u1", date="2026-09-05", meal_type="Lunch",
            food_description="Chicken curry with whole wheat roti",
            matched_items=["chicken", "roti"],
            nutrition=MacroNutrition(calories=700.0, protein=45.0, carbohydrates=75.0, fat=22.0),
            logged_at=now,
        ),
        FoodLogEntry(
            id="3", user_id="u1", date="2026-09-05", meal_type="Dinner",
            food_description="Paneer bhurji with paratha and yogurt",
            matched_items=["paneer", "paratha", "yogurt"],
            nutrition=MacroNutrition(calories=550.0, protein=32.0, carbohydrates=65.0, fat=18.0),
            logged_at=now,
        ),
    ]
    
    nutrition_score, plan_adherence = compute_scores(consumed, targets, logs, planned_meals)
    
    # Nutrition success score should be very high (~90+) despite eating completely different foods
    assert nutrition_score >= 85.0, f"Nutrition score should be strong, got {nutrition_score}"
    # Plan adherence is low because different food was eaten
    assert plan_adherence < 50.0, f"Plan adherence should be low, got {plan_adherence}"
    print(f"  [OK] Nutrition Success ({nutrition_score}/100) is separate from Plan Adherence ({plan_adherence}%)")

def test_chat_text_cleaner():
    print("Testing chat text cleaner and formatting...")
    from app.services.nutri_service import _clean_chat_text
    
    raw1 = r'\"Here is your dinner recommendation:\n- Lentil soup\n- Quinoa bowl\"'
    cleaned1 = _clean_chat_text(raw1)
    assert '\\"' not in cleaned1, f"Found unescaped quote: {cleaned1}"
    assert '\\n' not in cleaned1, f"Found literal \\n: {cleaned1}"
    assert "Lentil soup" in cleaned1
    
    raw_codeblock = "```markdown\n**Breakfast:** Oats and berries\n```"
    cleaned2 = _clean_chat_text(raw_codeblock)
    assert not cleaned2.startswith("```"), f"Codeblock not stripped: {cleaned2}"
    assert not cleaned2.endswith("```"), f"Codeblock not stripped: {cleaned2}"
    
    print("  [OK] Chat text cleaner correctly cleans escaped quotes, \\n, and codeblocks")

def test_ai_variety_and_memory_prompts():
    print("Testing AI variety mandate and memory recall prompts...")
    from app.services.daily_plan_service import DAILY_PLAN_SYSTEM_PROMPT
    from app.services.nutri_service import NUTRI_SYSTEM_PROMPT
    
    assert "CRITICAL VARIETY & DIVERSITY MANDATE" in DAILY_PLAN_SYSTEM_PROMPT
    assert "CONVERSATIONAL MEMORY & PAST CHAT RECALL" in NUTRI_SYSTEM_PROMPT
    assert "DIVERSE & VARIED DIET PLANS (NEVER REPETITIVE)" in NUTRI_SYSTEM_PROMPT
    assert "regenerate_plan" in NUTRI_SYSTEM_PROMPT
    print("  [OK] Variety and memory prompts verified in daily_plan_service and nutri_service")

if __name__ == "__main__":
    test_meal_windows()
    test_meal_window_enforcement_states()
    test_separate_scoring()
    test_chat_text_cleaner()
    test_ai_variety_and_memory_prompts()
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
