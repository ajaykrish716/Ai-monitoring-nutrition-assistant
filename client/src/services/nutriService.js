/**
 * Client service for Nutri AI Companion API interactions.
 */

import apiClient from "./api";

/**
 * Send user query / instruction to Nutri (e.g. general question or plan modification).
 *
 * @param {string} message - User natural language prompt
 * @param {string} [date] - Optional date YYYY-MM-DD
 * @returns {Promise<{message: string, action: string, plan_modified: boolean, plan_modification?: object, updated_plan?: object}>}
 */
export async function interactWithNutri(message, date) {
  const response = await apiClient.post("/nutri/interact", {
    message,
    date,
  });
  return response.data;
}

/**
 * Request an explicit Nutri review for a meal.
 *
 * @param {object} payload - { food_description, meal_type, nutrition, date }
 * @returns {Promise<{feedback: string}>}
 */
export async function reviewMealWithNutri(payload) {
  const response = await apiClient.post("/nutri/review-meal", payload);
  return response.data;
}
