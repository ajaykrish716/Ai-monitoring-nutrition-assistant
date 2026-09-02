/**
 * Tracking & Analytics API client.
 */

import api from "./api";

/**
 * Get today's nutrition analytics, food logs, goal status, and streak.
 * @param {string} [date] - Optional date YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function getTodayTracking(date) {
  const params = date ? { date } : {};
  const response = await api.get("/tracking/today", { params });
  return response.data;
}

/**
 * Log a meal/food description.
 * @param {{ food_description: string, meal_type?: string, date?: string }} data
 * @returns {Promise<object>}
 */
export async function logFood(data) {
  const response = await api.post("/tracking/log-food", data);
  return response.data;
}

/**
 * Delete a food log entry by ID.
 * @param {string} logId
 * @returns {Promise<object>}
 */
export async function deleteFoodLog(logId) {
  const response = await api.delete(`/tracking/log/${logId}`);
  return response.data;
}

/**
 * Log water intake in ml.
 * @param {number} amountMl
 * @param {string} [date]
 * @returns {Promise<object>}
 */
export async function logWater(amountMl, date) {
  const response = await api.post("/tracking/log-water", {
    amount_ml: amountMl,
    date,
  });
  return response.data;
}
