/**
 * NutritionPlanProgress — Displays the user's overall plan progress bar, stats,
 * and completion percentage, derived from real tracking data.
 *
 * Follows the existing NutriTrack design system (cards, dark mode, spacing).
 */

import {
  Flame,
  Trophy,
  Calendar,
  CheckCircle2,
  Sparkles,
  Target,
} from "lucide-react";

export default function NutritionPlanProgress({ planData }) {
  if (!planData || !planData.has_active_plan) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
            Nutrition Plan Progress
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-950 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 p-4 text-center">
          No active nutrition plan found. Complete onboarding to start your personalized plan!
        </p>
      </div>
    );
  }

  const {
    duration_days,
    start_date,
    end_date,
    current_day,
    completed_days,
    remaining_days,
    completion_percentage,
    current_streak,
    longest_streak,
    is_plan_complete,
  } = planData;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const progressPct = Math.min(100, Math.max(0, completion_percentage || 0));
  const displayDay = current_day > 0 ? current_day : 1;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Target className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
            Your {duration_days}-Day Nutrition Plan
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {formatDate(start_date)} — {formatDate(end_date)}
          </p>
        </div>

        {is_plan_complete ? (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Plan Complete!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/40 px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto">
            <Calendar className="w-3.5 h-3.5" />
            Day {displayDay} of {duration_days}
          </span>
        )}
      </div>

      {/* Plan Complete Banner */}
      {is_plan_complete && (
        <div className="bg-gradient-to-r from-emerald-50 to-primary-50 dark:from-emerald-950/50 dark:to-primary-950/40 rounded-2xl p-4 border border-emerald-200/60 dark:border-emerald-800/40 text-center space-y-1">
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">🎉 Nutrition Plan Completed!</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {duration_days} / {duration_days} Days • Completion Rate: 100% • Best Streak: {longest_streak} Days
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-gray-600 dark:text-slate-300">
            {completed_days} / {duration_days} Days Completed
          </span>
          <span className="text-primary-700 dark:text-primary-300 text-base font-black">
            {Math.round(progressPct)}%
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Progress text blocks */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
          <span>Start</span>
          <span>{remaining_days} day{remaining_days !== 1 ? "s" : ""} remaining</span>
          <span>Finish</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Days */}
        <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl p-3.5 border border-gray-200 dark:border-slate-800 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Total Days</p>
          <p className="text-2xl font-black text-gray-900 dark:text-slate-100">{duration_days}</p>
        </div>

        {/* Completed */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-3.5 border border-emerald-200 dark:border-emerald-800/40 space-y-1">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{completed_days}</p>
        </div>

        {/* Current Streak */}
        <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-3.5 border border-amber-200 dark:border-amber-800/40 space-y-1">
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-500" />
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Streak</p>
          </div>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{current_streak}</p>
            <p className="text-[10px] text-amber-500 font-semibold">days</p>
          </div>
        </div>

        {/* Best Streak */}
        <div className="bg-primary-50 dark:bg-primary-950/40 rounded-2xl p-3.5 border border-primary-200 dark:border-primary-800/40 space-y-1">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-primary-600 dark:text-primary-400" />
            <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Best</p>
          </div>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-black text-primary-700 dark:text-primary-300">{longest_streak}</p>
            <p className="text-[10px] text-primary-500 font-semibold">days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
