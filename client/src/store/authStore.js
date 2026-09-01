/**
 * Zustand auth store — manages JWT token, user profile, and auth state.
 * Token is persisted in localStorage for simplicity (swappable to cookies later).
 *
 * User profile now includes onboarding_complete flag and dynamic profile dict.
 */

import { create } from "zustand";
import { getCurrentUser } from "../services/authService";

const useAuthStore = create((set) => ({
  token: localStorage.getItem("access_token") || null,
  user: null,
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,

  /**
   * Save the JWT after a successful login and fetch the user profile.
   */
  login: async (token) => {
    localStorage.setItem("access_token", token);
    set({ token, isAuthenticated: true });

    try {
      const user = await getCurrentUser();
      set({ user });
    } catch {
      // Token might be invalid — clear auth state
      localStorage.removeItem("access_token");
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  /**
   * Clear auth state and remove the stored token.
   */
  logout: () => {
    localStorage.removeItem("access_token");
    set({ token: null, user: null, isAuthenticated: false });
  },

  /**
   * Load the user profile from the backend using the stored token.
   * Called on app mount to restore session.
   */
  loadUser: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("access_token");
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },

  /**
   * Update the user object in the store (e.g., after onboarding completes).
   */
  setUser: (user) => set({ user }),
}));

export default useAuthStore;
