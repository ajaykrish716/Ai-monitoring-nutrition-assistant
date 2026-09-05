/**
 * Sticky Meal Bar Component — renders the three sticky meal boxes (Breakfast, Lunch, Dinner).
 * Stays permanently anchored above the independent chat stream without hiding messages.
 */

import React from "react";
import { Check, Clock, AlertCircle, Sparkles, Utensils, ChevronRight } from "lucide-react";

export default function StickyMealBar({
  timingData,
  plan,
  onOpenLogModal,
  onLogPlannedMeal,
  onRequestSwap,
  loggingFood = false,
}) {
  const formatTime12h = (timeStr) => {
    if (!timeStr) return "";
    try {
      const [h, m] = timeStr.split(":");
      const hour = parseInt(h, 10);
      const minute = m || "00";
      if (hour === 0) return `12:${minute} AM`;
      if (hour < 12) return `${hour}:${minute} AM`;
      if (hour === 12) return `12:${minute} PM`;
      return `${hour - 12}:${minute} PM`;
    } catch {
      return timeStr;
    }
  };

  const mealDefinitions = [
    {
      key: "breakfast",
      type: "Breakfast",
      icon: "🍳",
      defaultStart: "08:00",
      defaultEnd: "10:00",
      defaultDisplay: "08:00 AM – 10:00 AM",
    },
    {
      key: "lunch",
      type: "Lunch",
      icon: "🍛",
      defaultStart: "12:30",
      defaultEnd: "14:30",
      defaultDisplay: "12:30 PM – 02:30 PM",
    },
    {
      key: "dinner",
      type: "Dinner",
      icon: "🍽️",
      defaultStart: "19:00",
      defaultEnd: "21:00",
      defaultDisplay: "07:00 PM – 09:00 PM",
    },
  ];

  return (
    <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-slate-800/80 p-3 sm:p-4 shrink-0 z-20 transition-colors shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-6xl mx-auto">
        {mealDefinitions.map((def) => {
          const timing = timingData?.meals?.find(
            (t) => t.meal_type.toLowerCase() === def.key
          );

          const plannedMeal = plan?.meals?.find(
            (m) => m.meal_type.toLowerCase() === def.key
          );

          const startStr = timing?.window_start || def.defaultStart;
          const endStr = timing?.window_end || def.defaultEnd;
          const timeWindowDisplay = `${formatTime12h(startStr)} – ${formatTime12h(endStr)}`;

          // Real backend state - NEVER default to "available" if timing is unknown
          const rawState = timing?.state?.toLowerCase();
          const isLogged = timing?.is_logged || false;

          let state = "upcoming";
          if (isLogged) {
            state = "completed";
          } else if (rawState) {
            state = rawState;
          } else {
            // Client-side fallback based on local clock
            const now = new Date();
            const [sh, sm] = startStr.split(":").map(Number);
            const [eh, em] = endStr.split(":").map(Number);
            const curMins = now.getHours() * 60 + now.getMinutes();
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;

            if (curMins >= endMins) {
              state = "window_closed";
            } else if (curMins >= startMins) {
              state = "available";
            } else {
              state = "upcoming";
            }
          }

          const isCompleted = state === "completed";
          const isAvailable = state === "available";
          const isClosed = state === "window_closed";
          const isUpcoming = state === "upcoming";

          return (
            <div
              key={def.key}
              className={`rounded-2xl p-3 border transition flex flex-col justify-between shadow-2xs ${
                isCompleted
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80"
                  : isClosed
                  ? "bg-gray-100/80 dark:bg-slate-950/80 border-gray-200 dark:border-slate-800 opacity-80"
                  : isAvailable
                  ? "bg-primary-50/50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-700/80 shadow-xs ring-1 ring-primary-500/20"
                  : "bg-gray-50/60 dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800"
              }`}
            >
              {/* Header: Icon + Title + Status Pill */}
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base shrink-0">{def.icon}</span>
                  <div className="min-w-0">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white truncate block">
                      {def.type}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 block -mt-0.5">
                      {timeWindowDisplay}
                    </span>
                  </div>
                </div>

                {/* State Badge */}
                <div className="shrink-0">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <Check className="w-2.5 h-2.5" />
                      Completed
                    </span>
                  ) : isClosed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <Clock className="w-2.5 h-2.5" />
                      Window closed
                    </span>
                  ) : isAvailable ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      Available now
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                      <Clock className="w-2.5 h-2.5" />
                      Available at {formatTime12h(startStr)}
                    </span>
                  )}
                </div>
              </div>

              {/* Meal Name & Portion from plan */}
              <div className="my-1 text-left min-h-[30px] flex flex-col justify-center">
                <span
                  className="text-xs font-semibold text-gray-800 dark:text-slate-200 line-clamp-1"
                  title={plannedMeal?.name || `${def.type} target`}
                >
                  {plannedMeal?.name || `Planned ${def.type}`}
                </span>
                {plannedMeal?.portion_information && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 line-clamp-1">
                    {plannedMeal.portion_information}
                  </span>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5 mt-auto">
                {isCompleted ? (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Logged ✓</span>
                  </span>
                ) : isClosed ? (
                  <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 cursor-not-allowed">
                    Logging disabled
                  </span>
                ) : isAvailable ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (plannedMeal && onLogPlannedMeal) {
                        onLogPlannedMeal(plannedMeal);
                      } else if (onOpenLogModal) {
                        onOpenLogModal(def.type);
                      }
                    }}
                    disabled={loggingFood}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    <span>Log {def.type}</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                    Opens at {formatTime12h(startStr)}
                  </span>
                )}

                {/* Swap / Ask Nutri button */}
                {!isCompleted && !isClosed && plannedMeal && onRequestSwap && (
                  <button
                    type="button"
                    onClick={() => onRequestSwap(plannedMeal)}
                    className="text-[11px] font-semibold text-gray-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 flex items-center gap-0.5 transition cursor-pointer"
                    title="Ask Nutri to swap or customize this meal"
                  >
                    <span>Swap</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
