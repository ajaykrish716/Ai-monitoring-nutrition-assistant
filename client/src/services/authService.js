/**
 * Auth & User Goals API calls.
 */

import api from "./api";

/**
 * Register a new user account.
 * @param {object} data – registration form data matching the backend schema
 * @returns {Promise<{access_token: string, token_type: string}>}
 */
export async function registerUser(data) {
  const response = await api.post("/auth/register", data);
  return response.data;
}

/**
 * Log in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{access_token: string, token_type: string}>}
 */
export async function loginUser(email, password) {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
}

/**
 * Get the currently authenticated user's profile.
 * Requires a valid JWT in localStorage.
 * @returns {Promise<object>} user profile
 */
export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data;
}

/**
 * Update basic user profile metrics.
 * @param {object} data - { name, age, gender, height, current_weight, email }
 * @returns {Promise<object>} updated user profile
 */
export async function updateUserProfile(data) {
  const response = await api.put("/auth/profile", data);
  return response.data;
}

/**
 * Update user's stated need/goal.
 * @param {string} need
 * @returns {Promise<object>} updated user profile
 */
export async function updateUserNeed(need) {
  const response = await api.put("/auth/need", { need });
  return response.data;
}

/**
 * Fetch all user goals (active and archived).
 * @returns {Promise<Array<object>>} list of goals
 */
export async function getUserGoals() {
  const response = await api.get("/auth/goals");
  return response.data;
}

/**
 * Add a new arbitrary goal.
 * @param {object} data - { description: string, priority?: number }
 * @returns {Promise<object>} created goal
 */
export async function addUserGoal(data) {
  const response = await api.post("/auth/goals", data);
  return response.data;
}

/**
 * Update an existing goal.
 * @param {string} goalId
 * @param {object} data - { description?: string, status?: string, priority?: number }
 * @returns {Promise<object>} updated goal
 */
export async function updateUserGoal(goalId, data) {
  const response = await api.put(`/auth/goals/${goalId}`, data);
  return response.data;
}

/**
 * Delete / archive a goal.
 * @param {string} goalId
 * @returns {Promise<{message: string}>}
 */
export async function deleteUserGoal(goalId) {
  const response = await api.delete(`/auth/goals/${goalId}`);
  return response.data;
}
