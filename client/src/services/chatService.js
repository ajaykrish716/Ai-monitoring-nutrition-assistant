/**
 * Nutrition Mentor Chat API client.
 */

import api from "./api";

/**
 * Send a message to the AI Nutrition Mentor.
 * @param {string} message
 * @returns {Promise<object>}
 */
export async function sendChatMessage(message) {
  const response = await api.post("/chat/message", { message });
  return response.data;
}

/**
 * Fetch recent chat history.
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getChatHistory(limit = 50) {
  const response = await api.get("/chat/history", { params: { limit } });
  return response.data;
}

/**
 * Clear chat history.
 * @returns {Promise<object>}
 */
export async function clearChatHistory() {
  const response = await api.delete("/chat/history");
  return response.data;
}
