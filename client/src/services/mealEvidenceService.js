/**
 * Meal Evidence API client.
 *
 * Wraps all /meal-evidence/* endpoints.
 * Images are uploaded as multipart/form-data; all other responses are JSON.
 */

import api from "./api";

/**
 * Upload a meal photo as evidence for a planned meal.
 *
 * @param {object} params
 * @param {string}   params.date              - YYYY-MM-DD
 * @param {string}   params.meal_type         - "Breakfast" | "Lunch" | "Dinner"
 * @param {string}   [params.planned_meal_name] - Meal name from the daily plan
 * @param {string}   [params.notes]           - Optional user note
 * @param {File}     params.imageFile         - The image File object from <input type="file">
 * @param {function} [params.onUploadProgress] - Axios upload progress callback
 * @returns {Promise<object>} MealEvidenceItem
 */
export async function uploadMealEvidence({
  date,
  meal_type,
  planned_meal_name = "",
  notes = "",
  imageFile,
  onUploadProgress,
}) {
  const formData = new FormData();
  formData.append("date", date);
  formData.append("meal_type", meal_type);
  formData.append("planned_meal_name", planned_meal_name);
  formData.append("notes", notes);
  formData.append("image", imageFile);

  const response = await api.post("/meal-evidence/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data;
}

/**
 * Get all evidence records for a given date.
 *
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<object>} MealEvidenceListResponse
 */
export async function getEvidenceForDate(date) {
  const response = await api.get(`/meal-evidence/${date}`);
  return response.data;
}

/**
 * Get the evidence record for a specific date + meal type.
 *
 * @param {string} date      - YYYY-MM-DD
 * @param {string} meal_type - "Breakfast" | "Lunch" | "Dinner"
 * @returns {Promise<object|null>} MealEvidenceItem or null if 404
 */
export async function getEvidenceForMeal(date, meal_type) {
  try {
    const response = await api.get(`/meal-evidence/${date}/${meal_type}`);
    return response.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Get an evidence analytics summary for a given date.
 *
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<object>} MealEvidenceSummary
 */
export async function getEvidenceSummary(date) {
  const response = await api.get(`/meal-evidence/${date}/summary`);
  return response.data;
}

/**
 * Delete a meal evidence record by its ID.
 *
 * @param {string} evidenceId
 * @returns {Promise<object>}
 */
export async function deleteMealEvidence(evidenceId) {
  const response = await api.delete(`/meal-evidence/${evidenceId}`);
  return response.data;
}
