/**
 * GitHub/LeetCode-style Yearly Activity Calendar Heatmap.
 *
 * Renders 365 days with real user activity data:
 * - Light Mode: Pure Green intensity scale
 * - Dark Mode: Pure Blue intensity scale
 * - Month & Day labels
 * - Interactive hover tooltip with date, nutrition score, meals logged, and goal status
 */

import { useState } from "react";
import useThemeStore from "../store/themeStore";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityCalendar({ activityData }) {
  const { theme } = useThemeStore();
  const [tooltip, setTooltip] = useState(null);

  const days = activityData?.days || [];
  const year = activityData?.year || new Date().getFullYear();

  // Color intensities: 0 to 4
  const lightColors = [
    "bg-gray-100 border-gray-200",
    "bg-green-200 border-green-300",
    "bg-green-400 border-green-500",
    "bg-green-600 border-green-700",
    "bg-green-800 border-green-900",
  ];

  const darkColors = [
    "bg-slate-800 border-slate-700",
    "bg-blue-900 border-blue-800",
    "bg-blue-600 border-blue-500",
    "bg-blue-500 border-blue-400",
    "bg-blue-400 border-blue-300",
  ];

  const activeColors = theme === "dark" ? darkColors : lightColors;

  // Group days into weeks of 7 days
  const weeks = [];
  let currentWeek = [];

  // Pad the first week based on start day of the year
  if (days.length > 0) {
    const firstDate = new Date(`${days[0].date}T00:00:00`);
    const startDayOfWeek = firstDate.getDay();
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }
  }

  days.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
            {year} Activity & Habit Consistency
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {activityData?.total_active_days || 0} active days • Current streak:{" "}
            {activityData?.current_streak || 0} days
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
          <span>Less</span>
          {activeColors.map((colorClass, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-xs border ${colorClass}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2 relative">
        {/* Month Labels */}
        <div className="flex text-[11px] font-semibold text-gray-400 dark:text-slate-500 mb-2 pl-6 gap-[2.4rem] min-w-[720px]">
          {MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>

        <div className="flex gap-1.5 min-w-[720px]">
          {/* Weekday indicators */}
          <div className="flex flex-col justify-between text-[9px] font-medium text-gray-400 dark:text-slate-500 pr-1 py-0.5">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>

          {/* Week Columns */}
          <div className="flex gap-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day, dIdx) => {
                  if (!day) {
                    return (
                      <div
                        key={dIdx}
                        className="w-3 h-3 rounded-xs bg-transparent"
                      />
                    );
                  }

                  const colorClass = activeColors[day.level || 0];

                  return (
                    <div
                      key={dIdx}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          day,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className={`w-3 h-3 rounded-xs border transition cursor-pointer hover:scale-125 ${colorClass}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-gray-900 dark:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs shadow-xl pointer-events-none border border-gray-700/50 -translate-x-1/2 -translate-y-full space-y-0.5"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-bold">{tooltip.day.date}</p>
            <p className="text-gray-300">
              {tooltip.day.count} meals logged
            </p>
            <p className="text-primary-400 font-bold">
              Nutrition Score: {tooltip.day.nutrition_score}/100
            </p>
            <p className="text-[10px] text-gray-400">
              {tooltip.day.goal_achieved ? "Goal Achieved ✅" : "In Progress"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
