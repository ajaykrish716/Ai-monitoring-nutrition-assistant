/**
 * NutritionPlanCalendar — Shows a calendar view of the user's active nutrition plan.
 *
 * Features:
 * - Displays all plan days within start_date → end_date range
 * - ✔ = completed day (green)
 * - ○ = pending/past day (neutral)
 * - Highlighted = current day
 * - Muted = future day
 * - Clickable days show a detail panel with meal breakdown
 * - Responsive grid layout (month-per-month)
 * - Supports dark mode and light mode
 */

import { useState } from "react";
import { CheckCircle2, Camera, Calendar, Info } from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Groups plan days into months with proper grid padding.
 */
function groupIntoMonths(days) {
  const months = {};
  for (const day of days) {
    const d = new Date(day.date + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months[key]) {
      months[key] = {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        days: [],
      };
    }
    months[key].days.push(day);
  }
  return Object.values(months);
}

/**
 * Renders a single month grid.
 */
function MonthGrid({ monthData, todayStr, onDayClick, selectedDate }) {
  const { year, month, label, days } = monthData;

  // Figure out what day of the week the first day of this month lands on
  // But we only care about plan days, so we look at the first plan day in the month
  const firstPlanDay = days[0];
  const firstDate = new Date(firstPlanDay.date + "T00:00:00");
  const startDow = firstDate.getDay(); // 0 = Sunday

  // Build a padded array: nulls for days before first plan day in this month
  // then null for days after last plan day
  const lastPlanDay = days[days.length - 1];
  const lastDate = new Date(lastPlanDay.date + "T00:00:00");

  // Create a map of date string → day data for quick lookup
  const dayMap = {};
  for (const d of days) {
    dayMap[d.date] = d;
  }

  // Generate all calendar slots for this month from day 1 to last day
  // but only fill in plan days — non-plan days are null
  const calendarDays = [];
  // Pad start
  for (let i = 0; i < startDow; i++) {
    calendarDays.push(null);
  }
  // Fill plan days (only days that belong to this month in the plan)
  for (const d of days) {
    calendarDays.push(d);
  }
  // Pad end to complete the last row
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  // Chunk into weeks
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-1">
        {label}
      </h4>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 dark:text-slate-500 pb-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      <div className="space-y-1">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 gap-1">
            {week.map((day, dIdx) => {
              if (!day) {
                return <div key={dIdx} className="aspect-square" />;
              }

              const isToday = day.date === todayStr;
              const isCompleted = day.status === "completed";
              const isFuture = day.status === "future";
              const isSelected = day.date === selectedDate;
              const dateNum = new Date(day.date + "T00:00:00").getDate();

              let cellClass =
                "aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 border text-xs font-bold select-none ";

              if (isSelected) {
                cellClass += "ring-2 ring-primary-500 ring-offset-1 ";
              }

              if (isCompleted) {
                cellClass +=
                  "bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 ";
              } else if (isToday) {
                cellClass +=
                  "bg-primary-50 dark:bg-primary-950/60 border-primary-400 dark:border-primary-500 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/60 shadow-sm ";
              } else if (isFuture) {
                cellClass +=
                  "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-300 dark:text-slate-600 cursor-default ";
              } else {
                // Past pending
                cellClass +=
                  "bg-gray-50 dark:bg-slate-900/80 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800/60 ";
              }

              return (
                <button
                  key={dIdx}
                  onClick={() => !isFuture && onDayClick(day)}
                  className={cellClass}
                  title={`${day.date} — ${isCompleted ? "Completed ✔" : isFuture ? "Future" : "Pending ○"}`}
                  disabled={isFuture}
                >
                  <span className="text-[11px] leading-none">{dateNum}</span>
                  <span className="text-[9px] leading-none mt-0.5 opacity-80">
                    {isCompleted ? "✔" : isToday ? "●" : isFuture ? "" : "○"}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Day detail panel shown when a plan day is clicked.
 */
function DayDetailPanel({ day, onClose }) {
  if (!day) return null;

  const { date, status, completion_percentage, breakdown } = day;
  const isCompleted = status === "completed";

  return (
    <div className="mt-4 bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 space-y-3 animate-in fade-in duration-150">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {formatDateDisplay(date)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {isCompleted ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </span>
            ) : (
              <span className="text-gray-500 dark:text-slate-400 text-sm font-semibold">
                ○ Pending
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xs font-bold cursor-pointer transition"
        >
          Close ✕
        </button>
      </div>

      {/* Meal breakdown */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Meal Progress</p>
        {[
          { label: "Breakfast", done: breakdown?.breakfast },
          { label: "Lunch", done: breakdown?.lunch },
          { label: "Dinner", done: breakdown?.dinner },
        ].map(({ label, done }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-700 dark:text-slate-300 font-medium">{label}</span>
            {done ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✔ Done</span>
            ) : (
              <span className="text-gray-400 dark:text-slate-500">✗ Pending</span>
            )}
          </div>
        ))}
      </div>

      {/* Daily progress */}
      <div className="pt-1 border-t border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500 dark:text-slate-400 font-semibold">Daily Progress</span>
          <span className="font-black text-primary-600 dark:text-primary-400">
            {Math.round(completion_percentage || 0)}%
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, completion_percentage || 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Main NutritionPlanCalendar component.
 */
export default function NutritionPlanCalendar({ planData }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const todayStr = getTodayStr();

  if (!planData || !planData.has_active_plan) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
            My Nutrition Plan
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
          No active plan. Complete onboarding to create your personalized plan calendar.
        </p>
      </div>
    );
  }

  const { duration_days, start_date, end_date, days } = planData;
  const monthGroups = groupIntoMonths(days || []);

  const formatShort = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDayClick = (day) => {
    setSelectedDay((prev) => (prev?.date === day.date ? null : day));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
            📅 My Nutrition Plan
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {duration_days}-Day Plan &nbsp;•&nbsp; {formatShort(start_date)} — {formatShort(end_date)}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-slate-400 self-start sm:self-auto flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[9px] font-bold">✔</span>
            Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-primary-50 dark:bg-primary-950/60 border-2 border-primary-400 dark:border-primary-500 text-primary-700 dark:text-primary-300 flex items-center justify-center text-[9px] font-bold">●</span>
            Today
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-500 flex items-center justify-center text-[9px] font-bold">○</span>
            Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-200 dark:text-slate-700 flex items-center justify-center text-[9px]">·</span>
            Future
          </span>
        </div>
      </div>

      {/* Calendar Grid — rendered per-month */}
      <div className={`grid gap-6 ${monthGroups.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {monthGroups.map((monthData) => (
          <MonthGrid
            key={`${monthData.year}-${monthData.month}`}
            monthData={monthData}
            todayStr={todayStr}
            onDayClick={handleDayClick}
            selectedDate={selectedDay?.date}
          />
        ))}
      </div>

      {/* Click hint */}
      {!selectedDay && (
        <p className="text-[11px] text-gray-400 dark:text-slate-500 text-center flex items-center justify-center gap-1">
          <Info className="w-3 h-3" />
          Click on any past or current day to see detailed meal progress
        </p>
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <DayDetailPanel
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
