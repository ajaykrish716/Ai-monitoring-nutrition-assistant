/**
 * Auth API calls — register, login, and get current user.
 */

import api from "./api";

/**
 * Register a new user account.
 * @param {object} data – registration form data matching the backend schema
 * @returns {Promise<{message: string}>}
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
