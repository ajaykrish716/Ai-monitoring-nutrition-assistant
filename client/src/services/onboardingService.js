/**
 * Onboarding API client — communicates with the AI-driven onboarding
 * endpoints. Has no knowledge of specific questions or fields.
 */

import api from "./api";

/**
 * Start or resume the onboarding conversation.
 * @returns {Promise<object>} Onboarding state with first/current question
 */
export async function startOnboarding() {
  const response = await api.post("/onboarding/start");
  return response.data;
}

/**
 * Submit the user's answer and get the next question.
 * @param {string} answer - The user's answer text
 * @returns {Promise<object>} Next question or completion state
 */
export async function submitAnswer(answer) {
  const response = await api.post("/onboarding/answer", { answer });
  return response.data;
}

/**
 * Get the current onboarding state.
 * @returns {Promise<object>} Current onboarding state
 */
export async function getOnboardingState() {
  const response = await api.get("/onboarding/state");
  return response.data;
}
