/**
 * Dashboard Page — Focused Daily Nutrition Hub.
 *
 * Visual Hierarchy:
 * 1. Top Bar: Dynamic Welcome ("Good morning, {name} 👋") + "Log Meal" Action
 * 2. Main 2-Column Split:
 *    - Left: Nutri AI Companion (independently scrollable chat, plan modifier, meal reviewer)
 *    - Right: Today's Diet Plan (Responsive 2-column Grid of meal cards, fixed aspect-ratio images, compact macros, actions)
 * 3. Bottom: Today's Physical Activity (Full-width responsive grid of balanced activity cards)
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Utensils,
  Activity,
  Plus,
  RefreshCw,
  Clock,
  Check,
  Bot,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronRight,
  Flame,
  Dumbbell,
  Timer,
} from "lucide-react";
import Navbar from "../components/Navbar";
import NutriWidget from "../components/NutriWidget";
import useAuthStore from "../store/authStore";
import { getTodayPlan, regeneratePlan } from "../services/dailyPlanService";
import { getTodayTracking, logFood } from "../services/trackingService";
import { getMealImage } from "../utils/imageHelper";

export default function DashboardPage() {
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [tracking, setTracking] = useState(null);

  // Quick Food Log Modal State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [foodText, setFoodText] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [loggingFood, setLoggingFood] = useState(false);
  const [logSuccessToast, setLogSuccessToast] = useState("");

  // External prompt passed to NutriWidget
  const [nutriPrompt, setNutriPrompt] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [planData, trackingData] = await Promise.all([
        getTodayPlan(),
        getTodayTracking(),
      ]);
      setPlan(planData);
      setTracking(trackingData);
    } catch (err) {
      setError(err.message || "Failed to load your daily plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError("");
      const newPlan = await regeneratePlan();
      setPlan(newPlan);
      const trackingData = await getTodayTracking();
      setTracking(trackingData);
    } catch (err) {
      setError(err.message || "Failed to regenerate daily plan.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleQuickFoodLog = async (e) => {
    e.preventDefault();
    if (!foodText.trim()) return;

    try {
      setLoggingFood(true);
      setError("");
      const result = await logFood({
        food_description: foodText.trim(),
        meal_type: mealType,
      });
      setFoodText("");
      setLogSuccessToast(
        result?.nutri_review
          ? `Meal logged! Nutri: "${result.nutri_review}"`
          : "Meal logged! Your nutrition progress updated."
      );
      setTimeout(() => setLogSuccessToast(""), 7000);

      const updatedTracking = await getTodayTracking();
      setTracking(updatedTracking);
      setLogModalOpen(false);
    } catch (err) {
      setError(err.message || "Failed to log food.");
    } finally {
      setLoggingFood(false);
    }
  };

  const handleLogPlannedMeal = async (meal) => {
    try {
      setLoggingFood(true);
      const description = `${meal.name} (${meal.portion_information || (meal.foods || []).join(", ")})`;
      const result = await logFood({
        food_description: description,
        meal_type: meal.meal_type || "Snack",
      });
      setLogSuccessToast(
        result?.nutri_review
          ? `Logged "${meal.name}"! Nutri: "${result.nutri_review}"`
          : `Logged "${meal.name}"!`
      );
      setTimeout(() => setLogSuccessToast(""), 7000);

      const updatedTracking = await getTodayTracking();
      setTracking(updatedTracking);
    } catch (err) {
      setError(err.message || "Failed to log meal.");
    } finally {
      setLoggingFood(false);
    }
  };

  const handleRequestSwap = (meal) => {
    const prompt = `I want to adjust my ${meal.meal_type} ("${meal.name}"). Can you suggest a suitable alternative or budget swap?`;
    setNutriPrompt(prompt);
  };

  // Dynamic time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const userName = user?.name ? user.name.split(" ")[0] : "Friend";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Notification Toasts */}
        {logSuccessToast && (
          <div className="rounded-2xl bg-primary-50 dark:bg-slate-900 border border-primary-300 dark:border-primary-800 p-4 text-sm text-primary-900 dark:text-primary-300 flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
              <span className="font-semibold">{logSuccessToast}</span>
            </div>
            <button
              onClick={() => setLogSuccessToast("")}
              className="text-xs font-bold underline hover:no-underline"
            >
              Close
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/20 p-4 text-sm text-danger-600 dark:text-danger-400 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Notice</p>
              <p>{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-xs font-semibold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* 1. TOP BAR: Greeting & Welcome (Left) | Log Meal   */}
        {/* -------------------------------------------------- */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                {getGreeting()}, {userName} 👋
              </h1>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-full border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900 transition"
              >
                <Sparkles className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                <span>
                  {user?.goals?.filter((g) => g.status === "active").length || 1} Active Focus
                </span>
                <ChevronRight className="w-2.5 h-2.5 opacity-60" />
              </Link>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
              Personalized guidance & real-time meal adjustments for your nutrition goals.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => setLogModalOpen(true)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md shadow-primary-500/20 transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Meal</span>
            </button>
          </div>
        </section>

        {/* -------------------------------------------------- */}
        {/* 2. MAIN 2-COLUMN SPLIT: NUTRI (Left) | DIET PLAN  */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* LEFT SIDE: NUTRI AI COMPANION */}
          <div className="w-full flex flex-col">
            <NutriWidget
              tracking={tracking}
              currentPlan={plan}
              onPlanUpdated={(newPlan) => setPlan(newPlan)}
              onMealLogged={fetchData}
              externalPrompt={nutriPrompt}
              onClearExternalPrompt={() => setNutriPrompt("")}
            />
          </div>

          {/* RIGHT SIDE: TODAY'S DIET PLAN (2-COLUMN GRID) */}
          <div className="w-full flex flex-col">
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full transition-colors space-y-4">
              {/* Diet Plan Header */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                    Today's Diet Plan 🍽️
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Personalized for you • Flexible recommendations
                  </p>
                </div>

                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || loading}
                  title="Regenerate today's ideas"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl transition disabled:opacity-50 shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      regenerating ? "animate-spin text-primary-600 dark:text-primary-400" : ""
                    }`}
                  />
                  <span>{regenerating ? "Regenerating…" : "New Ideas"}</span>
                </button>
              </div>

              {/* Meals Grid: 2 Columns on Desktop/Tablet, 1 on Mobile */}
              {loading ? (
                <div className="py-20 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-500 mx-auto" />
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
                    Loading your personalized diet plan…
                  </p>
                </div>
              ) : plan?.meals && plan.meals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1 content-start">
                  {plan.meals.map((meal, index) => {
                    const mealImageUrl = getMealImage(
                      meal.meal_type,
                      meal.name,
                      meal.foods || []
                    );
                    return (
                      <div
                        key={index}
                        className="bg-gray-50/70 dark:bg-slate-950/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 overflow-hidden flex flex-col justify-between hover:border-primary-300 dark:hover:border-primary-700 transition group shadow-2xs"
                      >
                        {/* Meal Image with Aspect Ratio */}
                        <div className="w-full h-32 bg-gray-100 dark:bg-slate-800 relative shrink-0 overflow-hidden">
                          <img
                            src={mealImageUrl}
                            alt={meal.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=80";
                            }}
                          />
                          <span className="absolute top-2 left-2 text-[10px] font-extrabold uppercase tracking-wider text-white bg-black/65 backdrop-blur-md px-2 py-0.5 rounded-full">
                            {meal.meal_type}
                          </span>
                          <span className="absolute bottom-2 right-2 text-xs font-bold text-white bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-lg">
                            {meal.nutrition?.calories || 0} kcal
                          </span>
                        </div>

                        {/* Meal Content */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                          <div>
                            <h3
                              className="text-sm font-bold text-gray-900 dark:text-slate-100 line-clamp-1"
                              title={meal.name}
                            >
                              {meal.name}
                            </h3>

                            {/* Macro Breakdown */}
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-slate-400 mt-1">
                              <span className="text-primary-700 dark:text-primary-400 font-bold">
                                P: {meal.nutrition?.protein || 0}g
                              </span>
                              <span>•</span>
                              <span>C: {meal.nutrition?.carbohydrates || 0}g</span>
                              <span>•</span>
                              <span>F: {meal.nutrition?.fat || 0}g</span>
                            </div>

                            {/* Portion Information */}
                            {meal.portion_information && (
                              <p className="text-[11px] text-gray-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-900 rounded-lg p-1.5 mt-1.5 border border-gray-100 dark:border-slate-800 line-clamp-2">
                                <span className="font-bold text-gray-900 dark:text-slate-100">
                                  Portion:{" "}
                                </span>
                                {meal.portion_information}
                              </p>
                            )}

                            {/* Food Tags (Compact) */}
                            {meal.foods && meal.foods.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {meal.foods.slice(0, 3).map((food, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="text-[9px] bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md font-medium border border-gray-100 dark:border-slate-800 truncate max-w-[120px]"
                                  >
                                    {food}
                                  </span>
                                ))}
                                {meal.foods.length > 3 && (
                                  <span className="text-[9px] text-gray-400 px-1 py-0.5">
                                    +{meal.foods.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-200/60 dark:border-slate-800/80 mt-2">
                            <button
                              onClick={() => handleLogPlannedMeal(meal)}
                              disabled={loggingFood}
                              className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 dark:bg-primary-950/70 hover:bg-primary-100 dark:hover:bg-primary-900 text-primary-800 dark:text-primary-300 text-[11px] font-bold rounded-lg transition"
                            >
                              <Check className="w-3 h-3" />
                              <span>Log</span>
                            </button>

                            <button
                              onClick={() => handleRequestSwap(meal)}
                              className="text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1"
                            >
                              <Bot className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                              <span>Swap</span>
                              <ChevronRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-gray-500 dark:text-slate-400 space-y-3 flex-1 flex flex-col items-center justify-center">
                  <Utensils className="w-8 h-8 mx-auto text-gray-400" />
                  <p className="text-sm">No meal recommendations available for today.</p>
                  <button
                    onClick={handleRegenerate}
                    className="px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700"
                  >
                    Generate Plan Now
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* 3. BOTTOM SECTION: TODAY'S PHYSICAL ACTIVITY       */}
        {/* -------------------------------------------------- */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-600 dark:text-primary-500" />
              Today's Physical Activity
            </h2>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              Tailored for energy balance
            </span>
          </div>

          {plan?.physical_activities && plan.physical_activities.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {plan.physical_activities.map((act, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-gray-50/70 dark:bg-slate-950/70 border border-gray-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-2 hover:border-primary-300 dark:hover:border-primary-700 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/80 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
                          <Dumbbell className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 line-clamp-1">
                          {act.name}
                        </h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded-full shrink-0">
                        {act.intensity}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 font-medium pt-1">
                      <Timer className="w-3.5 h-3.5 text-gray-400" />
                      <span>{act.duration_minutes} minutes</span>
                    </div>

                    {act.notes && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 italic line-clamp-2 pt-1">
                        {act.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-gray-500 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
              Rest day or flexible light activity based on your energy level. 🌱
            </div>
          )}
        </section>
      </main>

      {/* Quick Meal Log Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                Log Any Consumed Food
              </h3>
              <button
                onClick={() => setLogModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickFoodLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Meal Timing
                </label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  What did you eat?
                </label>
                <textarea
                  rows={3}
                  value={foodText}
                  onChange={(e) => setFoodText(e.target.value)}
                  placeholder="e.g., 2 eggs and 2 roti, or 1 bowl dal with rice"
                  required
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3 text-sm text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  Nutri automatically reviews every meal with constructive feedback!
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingFood || !foodText.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-600 dark:bg-primary-600 hover:bg-primary-700 dark:hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {loggingFood ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    "Save Log"
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
