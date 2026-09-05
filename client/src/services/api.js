/**
 * Axios instance pre-configured with the API base URL.
 * Automatically attaches the JWT token to every request.
 */

import axios from "axios";

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
    return envUrl ? envUrl.replace("localhost", "127.0.0.1") : "http://127.0.0.1:8000";
  }
  return envUrl || "http://localhost:8000";
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token if available
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        config.headers["X-Timezone"] = tz;
      }
    } catch (e) {
      // Ignore
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — normalise error shape & handle session expiry
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server returned a structured detail message, surface it.
    if (error.response?.data?.detail) {
      error.message = error.response.data.detail;
    }

    // Handle 401 Unauthorized (expired or invalid login session)
    if (error.response?.status === 401) {
      const detail = String(error.response?.data?.detail || "");
      if (
        detail.toLowerCase().includes("expired") ||
        detail.toLowerCase().includes("invalid token") ||
        detail.toLowerCase().includes("missing subject")
      ) {
        localStorage.removeItem("access_token");
        error.message = "Your login session has expired. Please log in again.";

        // If not already on auth pages, redirect to login
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register")
        ) {
          window.location.href = "/login?expired=1";
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
