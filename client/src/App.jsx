/**
 * Root application component — defines routes and protected routing.
 *
 * Routing logic:
 *   - Unauthenticated → /login or /register
 *   - Authenticated + onboarding incomplete → /onboarding
 *   - Authenticated + onboarding complete → /dashboard
 */

import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ProfilePage from "./pages/ProfilePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import useAuthStore from "./store/authStore";

/* ------------------------------------------------------------------ */
/* Route guard components                                              */
/* ------------------------------------------------------------------ */

/**
 * Redirect to /login if not authenticated.
 */
function RequireAuth({ children }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="w-8 h-8 border-4 border-primary-200 dark:border-blue-900 border-t-primary-600 dark:border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user hasn't completed onboarding, direct them to /onboarding
  if (user && !user.onboarding_complete && window.location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

/**
 * Redirect authenticated users away from login/register.
 * Goes to /onboarding or /home based on onboarding status.
 */
function RedirectIfAuth({ children }) {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    if (user && user.onboarding_complete) {
      return <Navigate to="/home" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);

  // Restore session on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      {/* Public / Auth routes */}
      <Route
        path="/login"
        element={
          <RedirectIfAuth>
            <LoginPage />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuth>
            <RegisterPage />
          </RedirectIfAuth>
        }
      />

      {/* Public informational routes */}
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Protected onboarding route */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />

      {/* Protected application routes */}
      <Route
        path="/home"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <AnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />

      {/* Catch-all */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
