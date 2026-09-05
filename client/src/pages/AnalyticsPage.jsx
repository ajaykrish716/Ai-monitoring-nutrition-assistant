/**
 * Analytics & Food Tracking Page — Detailed nutrition insights, food logs, scores, streaks, and trends.
 */

import { useState, useEffect } from "react";
import {
  BarChart3,
  Utensils,
  Plus,
  Trash2,
  Droplets,
  Flame,
  Award,
  Trophy,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import { getTodayTracking, logFood, deleteFoodLog, logWater } from "../services/trackingService";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(null);

  // Form State
  const [foodDescription, setFoodDescription] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [waterAmount, setWaterAmount] = useState(250);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getTodayTracking();
      setTracking(data);
    } catch (err) {
      setError(err.message || "Failed to load tracking data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const handleLogFoodSubmit = async (e) => {
    e.preventDefault();
    if (!foodDescription.trim()) return;

    try {
      setLogging(true);
      setError("");
      await logFood({
        food_description: foodDescription.trim(),
        meal_type: mealType,
      });
      setFoodDescription("");
      const updated = await getTodayTracking();
      setTracking(updated);
    } catch (err) {
      setError(err.message || "Failed to log food entry.");
    } finally {
      setLogging(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await deleteFoodLog(logId);
      const updated = await getTodayTracking();
      setTracking(updated);
    } catch (err) {
      setError(err.message || "Failed to delete log entry.");
    }
  };

  const handleAddWater = async () => {
    try {
      await logWater(Number(waterAmount));
      const updated = await getTodayTracking();
      setTracking(updated);
    } catch (err) {
      setError(err.message || "Failed to log water.");
    }
  };

  return (
    <AppLayout
      title="Analytics & Tracking"
      subtitle="Track your macros, food entries, and nutrition consistency score"
    >
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-primary-600 dark:text-primary-500" />
              Nutrition Tracking & Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Log any foods naturally, track macro adequacy deterministically, and view your consistency score.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 shadow-2xs">
            <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <span>Date: {tracking?.date || "Today"}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/20 p-4 text-sm text-danger-600 dark:text-danger-400 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button
              onClick={() => setError("")}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dual Scores Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-semibold">
              <span>Nutrition Success Score</span>
              <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-primary-600 dark:text-primary-400">
                {tracking?.nutrition_score || 0}
              </span>
              <span className="text-xs text-gray-400 font-bold">/100</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Evaluates actual macro & caloric adequacy against your targets.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-semibold">
              <span>Plan Adherence</span>
              <Utensils className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-gray-800 dark:text-slate-200">
                {tracking?.plan_adherence || 0}%
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Similarity to suggested recommendations. (Alternative foods are 100% fine!)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-semibold">
              <span>Current Streak</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-amber-500">
                {tracking?.streak?.current_streak || 0}
              </span>
              <span className="text-xs text-gray-400 font-bold">days</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Longest: {tracking?.streak?.longest_streak || 0} consecutive days.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-semibold">
              <span>Goal Verification</span>
              <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-gray-900 dark:text-slate-100">
                {tracking?.goal_status?.is_achieved ? "Goal Achieved ✅" : "In Progress 🌱"}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
              {tracking?.goal_status?.message || "Keep logging!"}
            </p>
          </div>
        </div>

        {/* Top Grid: Food Logger Form + Hydration Logger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Food Entry Form (2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Utensils className="w-4.5 h-4.5 text-primary-600 dark:text-primary-500" />
              Record Consumed Food (Planned or Alternative)
            </h2>

            <form onSubmit={handleLogFoodSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Meal Timing
                  </label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                    <option value="Snack">Snack</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Food & Portion Description
                  </label>
                  <input
                    type="text"
                    value={foodDescription}
                    onChange={(e) => setFoodDescription(e.target.value)}
                    placeholder="e.g. 2 eggs and 2 roti, or 1 bowl dal with rice"
                    required
                    className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  AI estimates calories, protein, carbs & fat with deterministic precision.
                </p>
                <button
                  type="submit"
                  disabled={logging || !foodDescription.trim()}
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-2xl text-sm font-bold shadow-sm transition disabled:opacity-50"
                >
                  {logging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Food
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Hydration Tracker Card (1 col) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Droplets className="w-4.5 h-4.5 text-primary-500" />
                Hydration Tracker
              </h2>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-2xl font-black text-gray-900 dark:text-slate-100">
                  {tracking?.consumed?.water_ml || 0}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  Goal: {tracking?.daily_targets?.water_ml || 2500} ml
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-primary-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, tracking?.progress_percentages?.water_ml || 0)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={waterAmount}
                onChange={(e) => setWaterAmount(Number(e.target.value))}
                className="rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 outline-none"
              >
                <option value={150}>150 ml (Small Cup)</option>
                <option value={250}>250 ml (Glass)</option>
                <option value={500}>500 ml (Bottle)</option>
                <option value={750}>750 ml (Large Bottle)</option>
              </select>
              <button
                onClick={handleAddWater}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded-xl text-xs font-bold shadow-2xs transition text-center cursor-pointer"
              >
                + Log Water
              </button>
            </div>
          </div>
        </div>

        {/* Macro Progress Bars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
              <span>Calories</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {tracking?.consumed?.calories || 0}
                </p>
                <p className="text-xs text-gray-400">
                  Target: {tracking?.daily_targets?.calories || 2000} kcal
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, tracking?.progress_percentages?.calories || 0)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
              <span>{tracking?.progress_percentages?.calories || 0}% met</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {tracking?.remaining?.calories || 0} kcal left
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
              <span>Protein</span>
              <span className="text-xs font-extrabold text-primary-600 dark:text-primary-400">PRO</span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {tracking?.consumed?.protein || 0}g
                </p>
                <p className="text-xs text-gray-400">
                  Target: {tracking?.daily_targets?.protein || 100}g
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-primary-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, tracking?.progress_percentages?.protein || 0)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
              <span>{tracking?.progress_percentages?.protein || 0}% met</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {tracking?.remaining?.protein || 0}g left
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
              <span>Carbohydrates</span>
              <span className="text-xs font-extrabold text-primary-700 dark:text-primary-300">CARB</span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {tracking?.consumed?.carbohydrates || 0}g
                </p>
                <p className="text-xs text-gray-400">
                  Target: {tracking?.daily_targets?.carbohydrates || 220}g
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-primary-600 dark:bg-primary-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, tracking?.progress_percentages?.carbohydrates || 0)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
              <span>{tracking?.progress_percentages?.carbohydrates || 0}% met</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {tracking?.remaining?.carbohydrates || 0}g left
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
              <span>Fats</span>
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">FAT</span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {tracking?.consumed?.fat || 0}g
                </p>
                <p className="text-xs text-gray-400">
                  Target: {tracking?.daily_targets?.fat || 65}g
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, tracking?.progress_percentages?.fat || 0)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
              <span>{tracking?.progress_percentages?.fat || 0}% met</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {tracking?.remaining?.fat || 0}g left
              </span>
            </div>
          </div>
        </div>

        {/* Section: Today's Logged Meals Table & Streaks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Food Logs List (2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center justify-between">
              <span>Today's Logged Items</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {tracking?.logs?.length || 0} meals logged
              </span>
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600 dark:text-primary-400" />
                <p className="text-xs">Loading food logs…</p>
              </div>
            ) : tracking?.logs && tracking.logs.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {tracking.logs.map((log) => (
                  <div
                    key={log.id}
                    className="py-3.5 flex items-start justify-between gap-4 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/80 px-2 py-0.5 rounded-md">
                          {log.meal_type}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {log.food_description}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-slate-400 font-medium">
                        <span>{log.nutrition?.calories || 0} kcal</span>
                        <span>•</span>
                        <span>P: {log.nutrition?.protein || 0}g</span>
                        <span>•</span>
                        <span>C: {log.nutrition?.carbohydrates || 0}g</span>
                        <span>•</span>
                        <span>F: {log.nutrition?.fat || 0}g</span>
                      </div>
                      {log.notes && (
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 italic">{log.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      title="Delete log entry"
                      className="text-gray-300 dark:text-slate-600 hover:text-danger-600 dark:hover:text-danger-400 p-2 rounded-xl hover:bg-danger-50 dark:hover:bg-danger-950/40 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 space-y-1">
                <Utensils className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-700" />
                <p className="text-sm font-medium">No meals logged for today yet.</p>
                <p className="text-xs text-gray-400">Use the form above to log your first meal!</p>
              </div>
            )}
          </div>

          {/* Right Column: Goal Evaluation & Rewards */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Daily Goal Verification
              </h3>
              <div
                className={`p-3.5 rounded-2xl border ${
                  tracking?.goal_status?.is_achieved
                    ? "bg-primary-50 dark:bg-primary-950/80 border-primary-200 dark:border-primary-800/40 text-primary-900 dark:text-primary-300"
                    : "bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300"
                }`}
              >
                <p className="text-xs font-bold">
                  {tracking?.goal_status?.is_achieved
                    ? "Goal Achieved for Today!"
                    : "In Progress"}
                </p>
                <p className="text-[11px] mt-1 text-gray-600 dark:text-slate-400">
                  {tracking?.goal_status?.message}
                </p>
              </div>

              {tracking?.goal_status?.criteria_met &&
                tracking.goal_status.criteria_met.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Criteria Met:
                    </p>
                    <ul className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                      {tracking.goal_status.criteria_met.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {/* Streak & Badges Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Consistency Badges
                </h3>
              </div>

              <div className="space-y-2">
                {tracking?.badges && tracking.badges.length > 0 ? (
                  <div className="space-y-2">
                    {tracking.badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="flex items-start gap-3 bg-gray-50 dark:bg-slate-950 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-gray-900 dark:text-slate-100">{badge.name}</h5>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400">{badge.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400 bg-gray-50/60 dark:bg-slate-950/60 p-3 rounded-2xl border border-dashed border-gray-300 dark:border-slate-800 text-center">
                    Log meals consistently to unlock milestone badges!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
