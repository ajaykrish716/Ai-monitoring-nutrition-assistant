/**
 * Profile Page — Clean profile management with metric editing,
 * dedicated Multiple Simultaneous Goals & Needs management,
 * milestone badges, and 365-day activity heatmap.
 */

import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Sparkles,
  Flame,
  Award,
  Trophy,
  Loader2,
  AlertCircle,
  Edit3,
  CheckCircle2,
  ChevronRight,
  Target,
  Plus,
  Trash2,
  Power,
  Clock,
  Shield,
  Layers,
} from "lucide-react";
import Navbar from "../components/Navbar";
import ActivityCalendar from "../components/ActivityCalendar";
import useAuthStore from "../store/authStore";
import api from "../services/api";
import {
  updateUserProfile,
  getUserGoals,
  addUserGoal,
  updateUserGoal,
  deleteUserGoal,
} from "../services/authService";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [activityData, setActivityData] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [goals, setGoals] = useState([]);

  // Modals state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null); // Goal object when editing
  const [saving, setSaving] = useState(false);

  // Form states for Edit Profile
  const [profileForm, setProfileForm] = useState({
    name: "",
    age: "",
    gender: "",
    height: "",
    current_weight: "",
    email: "",
  });

  // Form state for Add/Edit Goal
  const [goalDescForm, setGoalDescForm] = useState("");
  const [goalPriorityForm, setGoalPriorityForm] = useState("");

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError("");
      const [actRes, trackRes, meRes, goalsRes] = await Promise.all([
        api.get("/tracking/activity-calendar"),
        api.get("/tracking/today"),
        api.get("/auth/me"),
        getUserGoals(),
      ]);
      setActivityData(actRes.data);
      setTrackingData(trackRes.data);
      if (meRes.data) {
        setUser(meRes.data);
      }
      setGoals(goalsRes || []);
    } catch (err) {
      setError(err.message || "Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const handleOpenEditProfile = () => {
    setProfileForm({
      name: user?.name || "",
      age: user?.age !== undefined && user?.age !== null ? String(user.age) : "",
      gender: user?.gender || "",
      height: user?.height !== undefined && user?.height !== null ? String(user.height) : "",
      current_weight:
        user?.current_weight !== undefined && user?.current_weight !== null
          ? String(user.current_weight)
          : "",
      email: user?.email || "",
    });
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      const payload = {
        name: profileForm.name.trim(),
        age: profileForm.age ? parseInt(profileForm.age, 10) : undefined,
        gender: profileForm.gender.trim() || undefined,
        height: profileForm.height ? parseFloat(profileForm.height) : undefined,
        current_weight: profileForm.current_weight
          ? parseFloat(profileForm.current_weight)
          : undefined,
        email: profileForm.email.trim(),
      };

      const updated = await updateUserProfile(payload);
      setUser(updated);
      setEditProfileOpen(false);
      setSuccessToast("Profile metrics updated successfully!");
      setTimeout(() => setSuccessToast(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  // --- Goal Actions ---

  const handleOpenAddGoal = () => {
    setGoalDescForm("");
    setGoalPriorityForm("");
    setAddGoalOpen(true);
  };

  const handleSaveAddGoal = async (e) => {
    e.preventDefault();
    if (!goalDescForm.trim()) return;

    try {
      setSaving(true);
      setError("");
      const created = await addUserGoal({
        description: goalDescForm.trim(),
        priority: goalPriorityForm ? parseInt(goalPriorityForm, 10) : undefined,
      });
      setGoals((prev) => [...prev, created]);
      setAddGoalOpen(false);
      setSuccessToast("New goal added! Daily plans will adapt to all your active goals.");
      setTimeout(() => setSuccessToast(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to add goal.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditGoal = (goal) => {
    setEditingGoal(goal);
    setGoalDescForm(goal.description || "");
    setGoalPriorityForm(goal.priority !== undefined && goal.priority !== null ? String(goal.priority) : "");
  };

  const handleSaveEditGoal = async (e) => {
    e.preventDefault();
    if (!editingGoal || !goalDescForm.trim()) return;

    try {
      setSaving(true);
      setError("");
      const updated = await updateUserGoal(editingGoal.id, {
        description: goalDescForm.trim(),
        priority: goalPriorityForm ? parseInt(goalPriorityForm, 10) : undefined,
      });
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setEditingGoal(null);
      setSuccessToast("Goal updated successfully!");
      setTimeout(() => setSuccessToast(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to update goal.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGoalStatus = async (goal) => {
    try {
      const nextStatus = goal.status === "active" ? "inactive" : "active";
      const updated = await updateUserGoal(goal.id, { status: nextStatus });
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setSuccessToast(
        nextStatus === "active"
          ? "Goal activated! It will be factored into future plans."
          : "Goal paused (inactive)."
      );
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to update goal status.");
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Are you sure you want to remove this goal?")) return;
    try {
      await deleteUserGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      setSuccessToast("Goal removed.");
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to remove goal.");
    }
  };

  const activeGoalsCount = goals.filter((g) => g.status === "active").length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Success Toast */}
        {successToast && (
          <div className="rounded-2xl bg-primary-50 dark:bg-slate-900 border border-primary-300 dark:border-primary-800 p-4 text-sm text-primary-900 dark:text-primary-300 flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
              <span className="font-semibold">{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast("")}
              className="text-xs font-bold underline cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/20 p-4 text-sm text-danger-600 dark:text-danger-400 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Notice</p>
              <p>{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-xs font-semibold underline hover:no-underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Profile Header Card */}
        <section className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900 dark:from-slate-900 dark:via-primary-950 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-72 h-72 bg-white/10 dark:bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-10 w-60 h-60 bg-primary-400/20 dark:bg-primary-600/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white text-primary-700 dark:bg-slate-900 dark:text-primary-400 flex items-center justify-center text-2xl sm:text-3xl font-black uppercase shadow-xl shrink-0">
                {user?.name ? user.name.charAt(0) : "U"}
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 dark:bg-primary-900/40 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
                  <Sparkles className="w-3 h-3 text-primary-200 dark:text-primary-300" />
                  <span>{activeGoalsCount} Active Goal{activeGoalsCount !== 1 ? "s" : ""}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {user?.name || "Your Profile"}
                </h1>
                <p className="text-xs sm:text-sm text-primary-100 dark:text-slate-300 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{user?.email}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleOpenEditProfile}
                className="flex items-center gap-2 bg-white text-primary-800 dark:bg-slate-900 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition hover:scale-[1.02] cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={handleOpenAddGoal}
                className="flex items-center gap-2 bg-primary-800/60 dark:bg-primary-950/60 hover:bg-primary-800 dark:hover:bg-primary-900 border border-primary-400/30 dark:border-primary-700/40 text-white px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm backdrop-blur-md transition hover:scale-[1.02] cursor-pointer"
              >
                <Plus className="w-4 h-4 text-primary-200 dark:text-primary-300" />
                <span>+ Add Goal</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. Basic Health Metrics */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-primary-600" />
              Basic Health Metrics
            </h2>
            <button
              onClick={handleOpenEditProfile}
              className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Edit Metrics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">Age</p>
              <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                {user?.age ? `${user.age} yrs` : "—"}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">Gender</p>
              <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                {user?.gender || "—"}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">Height</p>
              <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                {user?.height ? `${user.height} cm` : "—"}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">Weight</p>
              <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                {user?.current_weight ? `${user.current_weight} kg` : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* 3. DEDICATED GOALS & NEEDS SECTION (Multiple Simultaneous Goals) */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-5 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-600" />
                Goals & Wellness Needs
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Maintain multiple active goals simultaneously. Daily meal plans and Nutri AI dynamically reason across all active objectives together.
              </p>
            </div>

            <button
              onClick={handleOpenAddGoal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm shadow-xs transition hover:scale-[1.02] cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Goal</span>
            </button>
          </div>

          {/* Goals List */}
          {goals.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-slate-950 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 space-y-2">
              <Layers className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
                No goals added yet
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                Add your nutrition and fitness objectives in natural language (e.g. "Build muscle while keeping meals affordable").
              </p>
              <button
                onClick={handleOpenAddGoal}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add your first goal</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal, idx) => {
                const isActive = goal.status === "active";
                return (
                  <div
                    key={goal.id || idx}
                    className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isActive
                        ? "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-2xs hover:border-primary-300 dark:hover:border-primary-800"
                        : "bg-gray-50/70 dark:bg-slate-950/60 border-gray-200/60 dark:border-slate-800/60 opacity-70"
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                            isActive
                              ? "bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60"
                              : "bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-primary-600" : "bg-gray-400"
                            }`}
                          />
                          {isActive ? "Active" : "Paused / Inactive"}
                        </span>

                        {goal.priority && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[10px] font-bold">
                            Priority: {goal.priority}
                          </span>
                        )}
                      </div>

                      <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100 leading-snug">
                        {goal.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleToggleGoalStatus(goal)}
                        title={isActive ? "Pause goal" : "Activate goal"}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isActive
                            ? "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                            : "border-primary-300 dark:border-primary-800 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {isActive ? "Deactivate" : "Activate"}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenEditGoal(goal)}
                        className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        title="Edit goal description"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-primary-600" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-2 rounded-xl border border-danger-200 dark:border-danger-900/40 hover:bg-danger-50 dark:hover:bg-danger-950/40 text-danger-600 dark:text-danger-400 transition cursor-pointer"
                        title="Remove goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Section: Consistency Badges & Streaks */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-5 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Milestone Badges & Streaks
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-center">
              <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {trackingData?.streak?.current_streak || 0}
              </p>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Current Streak Days
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-center">
              <Award className="w-5 h-5 text-primary-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {trackingData?.streak?.longest_streak || 0}
              </p>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Longest Streak Days
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-center">
              <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {trackingData?.badges?.length || 0}
              </p>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                Earned Badges
              </p>
            </div>
          </div>

          {trackingData?.badges && trackingData.badges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {trackingData.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-2xs flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100">
                      {badge.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {badge.description}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Earned on {new Date(badge.earned_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-gray-500 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
              Log meals and stay consistent to unlock milestone badges! 🏆
            </div>
          )}
        </section>

        {/* 5. Section: 365-Day Activity Calendar Heatmap */}
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Loading your activity calendar…
            </p>
          </div>
        ) : (
          <ActivityCalendar activityData={activityData} />
        )}
      </main>

      {/* Edit Profile Metrics Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary-600" />
                Edit Profile Metrics
              </h3>
              <button
                onClick={() => setEditProfileOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Age (yrs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={profileForm.age}
                    onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="50"
                    max="300"
                    required
                    value={profileForm.height}
                    onChange={(e) => setProfileForm({ ...profileForm, height: e.target.value })}
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Current Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="500"
                    required
                    value={profileForm.current_weight}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, current_weight: e.target.value })
                    }
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {addGoalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-600" />
                Add New Goal / Need
              </h3>
              <button
                onClick={() => setAddGoalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  What would you like to work on? (Free text description)
                </label>
                <textarea
                  rows={3}
                  required
                  value={goalDescForm}
                  onChange={(e) => setGoalDescForm(e.target.value)}
                  placeholder="e.g. Build muscle while keeping meals affordable, improve hair health, boost afternoon energy, increase fiber..."
                  className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  Describe any nutritional or wellness need in your own words.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Priority (Optional, 1 = Highest)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="e.g. 1, 2, 3"
                  value={goalPriorityForm}
                  onChange={(e) => setGoalPriorityForm(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddGoalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !goalDescForm.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add Goal"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Existing Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary-600" />
                Edit Goal
              </h3>
              <button
                onClick={() => setEditingGoal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Goal Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={goalDescForm}
                  onChange={(e) => setGoalDescForm(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Priority (Optional, 1 = Highest)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="e.g. 1"
                  value={goalPriorityForm}
                  onChange={(e) => setGoalPriorityForm(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !goalDescForm.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
