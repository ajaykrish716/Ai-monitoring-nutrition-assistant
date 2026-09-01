/**
 * Dashboard Page — minimal post-onboarding landing page.
 *
 * Displays the user's name and their dynamic profile data
 * populated during AI-driven onboarding.
 *
 * This is NOT a full-featured dashboard — it's just the landing
 * page after onboarding completes.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, LogOut, Loader2, User } from "lucide-react";

import useAuthStore from "../store/authStore";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isLoading, logout, loadUser } = useAuthStore();

  useEffect(() => {
    if (!user) {
      loadUser();
    }
  }, [user, loadUser]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const profile = user.profile || {};

  return (
    <div className="min-h-dvh bg-gradient-to-br from-primary-50 via-white to-primary-100 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white shadow">
              <Leaf className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-gray-900">NutriTrack</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-800"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {/* Welcome card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Welcome, {user.name}!
              </h1>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          {Object.keys(profile).length > 0 ? (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Your Profile
              </h2>
              <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
                {Object.entries(profile).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-start gap-4 px-5 py-3">
                    <span className="text-sm font-medium text-gray-500 capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-gray-800 text-right">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Complete your onboarding to see your personalized profile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
