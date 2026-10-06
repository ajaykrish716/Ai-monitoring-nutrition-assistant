/**
 * Plan Progress API client — communicates with the /plan-progress endpoints.
 */

import api from "./api";

/**
 * Get the user's nutrition plan progress, calendar, and per-day breakdown.
 * @returns {Promise<object>} PlanProgressResponse
 */
export async function getPlanProgress() {
  const response = await api.get("/plan-progress");
  return response.data;
}

/**
 * Initialize or reset the user's nutrition plan with a chosen duration.
 * @param {number} durationDays - Plan duration in days (1–365)
 * @returns {Promise<object>}
 */
export async function initializePlan(durationDays) {
  const response = await api.post("/plan-progress/initialize", {
    duration_days: durationDays,
  });
  return response.data;
}
