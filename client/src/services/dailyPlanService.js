/**
 * Daily Plan API client.
 */

import api from "./api";

/**
 * Get today's AI-generated meal and activity plan.
 * @param {string} [date] - Optional date YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function getTodayPlan(date) {
  const params = date ? { date } : {};
  const response = await api.get("/daily-plan/today", { params });
  return response.data;
}

/**
 * Force regeneration of the daily plan.
 * @param {string} [date] - Optional date YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function regeneratePlan(date) {
  const params = date ? { date } : {};
  const response = await api.post("/daily-plan/regenerate", null, { params });
  return response.data;
}
