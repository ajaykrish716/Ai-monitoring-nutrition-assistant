/**
 * Meal Schedule & Timing API client.
 */

import api from "./api";

/**
 * Get the current user's meal schedule settings.
 * @returns {Promise<{breakfast: object, lunch: object, dinner: object, timezone: string}>}
 */
export async function getMealSchedule() {
  const response = await api.get("/meal-schedule/");
  return response.data;
}

/**
 * Update timing for a specific meal (Breakfast, Lunch, Dinner).
 * @param {{ meal_type: string, window_start: string, window_end: string, enabled?: boolean }} data
 * @returns {Promise<object>}
 */
export async function updateMealTiming(data) {
  const response = await api.put("/meal-schedule/timing", data);
  return response.data;
}

/**
 * Update the user's timezone.
 * @param {string} timezone
 * @returns {Promise<{timezone: string, message: string}>}
 */
export async function updateUserTimezone(timezone) {
  const response = await api.put("/meal-schedule/timezone", { timezone });
  return response.data;
}

/**
 * Get the current timing states for all three meals for a given date.
 * @param {string} [date] - Optional YYYY-MM-DD
 * @returns {Promise<{date: string, timezone: string, meals: Array<object>}>}
 */
export async function getDailyMealTiming(date) {
  const params = date ? { date } : {};
  const response = await api.get("/meal-schedule/today", { params });
  return response.data;
}
