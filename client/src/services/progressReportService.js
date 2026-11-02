/**
 * Progress Report API client — communicates with the /reports/progress endpoint.
 *
 * Security: the backend always identifies the user from JWT.
 * The frontend never sends a user_id; the bearer token is attached automatically
 * by the Axios interceptor in api.js.
 */

import api from "./api";

const BASE_URL = (api.defaults.baseURL || "http://localhost:8000").replace(/\/+$/, "");

/**
 * Get the full Authorization header value from the current access token.
 * Used for fetch()-based PDF requests where we need to handle binary blobs.
 */
function _getAuthHeader() {
  const token = localStorage.getItem("access_token");
  return token ? `Bearer ${token}` : "";
}

/**
 * Fetch the PDF as a Blob from the backend.
 * @param {boolean} download - If true, request with ?download=true (attachment).
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
async function _fetchReportBlob(download = false) {
  const url = `${BASE_URL}/reports/progress?download=${download}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: _getAuthHeader(),
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
  });

  if (!response.ok) {
    // Try to parse error body
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  const blob = await response.blob();

  // Extract filename from Content-Disposition header if available
  let filename = "NutriTrack_Progress_Report.pdf";
  const cd = response.headers.get("Content-Disposition");
  if (cd) {
    const match = cd.match(/filename="?([^";\n]+)"?/i);
    if (match) filename = match[1];
  }

  return { blob, filename };
}

/**
 * Open the progress report PDF in a new browser tab (inline view).
 */
export async function viewProgressReport() {
  const { blob, filename } = await _fetchReportBlob(false);
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked — fall back to download
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
  }
  // Revoke after a short delay so the tab has time to load
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

/**
 * Download the progress report PDF as a file.
 */
export async function downloadProgressReport() {
  const { blob, filename } = await _fetchReportBlob(true);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
