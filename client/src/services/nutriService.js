/**
 * Client service for Nutri AI Companion API interactions.
 */

import apiClient from "./api";

/**
 * Send user query / instruction to Nutri (e.g. general question or plan modification).
 *
 * @param {string} message - User natural language prompt
 * @param {string} [date] - Optional date YYYY-MM-DD
 * @param {string} [conversationId] - Optional conversation session ID
 * @returns {Promise<{message: string, action: string, plan_modified: boolean, plan_modification?: object, updated_plan?: object, conversation_id?: string}>}
 */
export async function interactWithNutri(message, date, conversationId) {
  const response = await apiClient.post("/nutri/interact", {
    message,
    date,
    conversation_id: conversationId,
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

/**
 * Fetch persistent Nutri chat history from MongoDB.
 * @param {string} [conversationId]
 * @returns {Promise<{messages: Array, conversation_id?: string}>}
 */
export async function getNutriHistory(conversationId) {
  const params = conversationId ? { conversation_id: conversationId } : {};
  const response = await apiClient.get("/nutri/history", { params });
  return response.data;
}

/**
 * Fetch list of recent conversation threads.
 * @returns {Promise<{conversations: Array}>}
 */
export async function getNutriConversations() {
  const response = await apiClient.get("/nutri/conversations");
  return response.data;
}

/**
 * Create a new conversation thread.
 * @returns {Promise<{id: string, title: string}>}
 */
export async function createNutriConversation() {
  const response = await apiClient.post("/nutri/conversations");
  return response.data;
}

/**
 * Delete a conversation thread.
 * @param {string} conversationId
 * @returns {Promise<{message: string}>}
 */
export async function deleteNutriConversation(conversationId) {
  const response = await apiClient.delete(`/nutri/conversations/${conversationId}`);
  return response.data;
}
