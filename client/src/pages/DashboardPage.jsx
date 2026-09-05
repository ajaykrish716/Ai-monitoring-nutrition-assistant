/**
 * Dashboard Page — Primary ChatGPT-style Nutri AI Conversation Hub.
 *
 * Architecture:
 * - Fixed application shell: no runaway window scrolling.
 * - Left Persistent Sidebar with navigation (Home, Analytics, Profile, About, Contact),
 *   theme toggle, user profile, and scrollable Recent Chats list.
 * - Top Header with integrated 3 summary metrics (Nutrition Score, Progress, Meals Logged)
 *   and quick "Log Meal" action.
 * - Sticky Meal Bar anchored at the top of the chat area (Breakfast, Lunch, Dinner only - no snacks).
 * - Independently scrollable conversation area with persistent MongoDB chat history.
 * - Fixed bottom composer anchored at the bottom.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Bot,
  Send,
  Loader2,
  Check,
  Clock,
  AlertCircle,
  Plus,
  Menu,
  CheckCircle2,
  Utensils,
  Activity,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Dumbbell,
  Timer,
  Copy,
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import StickyMealBar from "../components/StickyMealBar";
import ChatMessageFormatter from "../components/ChatMessageFormatter";
import useAuthStore from "../store/authStore";
import useChatStore from "../store/chatStore";
import { getTodayPlan, regeneratePlan } from "../services/dailyPlanService";
import { getTodayTracking, logFood } from "../services/trackingService";
import { getDailyMealTiming } from "../services/mealScheduleService";
import {
  getNutriHistory,
  interactWithNutri,
  getNutriConversations,
  createNutriConversation,
  deleteNutriConversation,
} from "../services/nutriService";

const DEFAULT_WELCOME_MSG = {
  role: "assistant",
  content:
    "Hello! 👋 I'm Nutri, your personal AI nutrition assistant. I'm here to review your meals, provide affordable food swaps, adjust today's plan, and keep your nutrition on track. How can I help you today?",
  timestamp: new Date().toISOString(),
};

export default function DashboardPage() {
  const { user } = useAuthStore();

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [timingData, setTimingData] = useState(null);
  const [globalError, setGlobalError] = useState("");

  // Chat & Conversation States
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([DEFAULT_WELCOME_MSG]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastPlanMod, setLastPlanMod] = useState(null);

  // UI States
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);

  // Quick Food Log Modal State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [mealType, setMealType] = useState("Breakfast");
  const [foodText, setFoodText] = useState("");
  const [loggingFood, setLoggingFood] = useState(false);
  const [logToast, setLogToast] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatScrollRef = useRef(null);

  const handleCopyMessage = (text, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isBottom);
  };

  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // ----------------------------------------------------
  // Initial Data Fetching
  // ----------------------------------------------------
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setGlobalError("");
      const [planRes, trackRes, timeRes, convRes] = await Promise.all([
        getTodayPlan().catch(() => null),
        getTodayTracking().catch(() => null),
        getDailyMealTiming().catch(() => null),
        getNutriConversations().catch(() => ({ conversations: [] })),
      ]);

      setPlan(planRes);
      setTracking(trackRes);
      setTimingData(timeRes);

      const convList = convRes?.conversations || [];
      setConversations(convList);

      if (convList.length > 0) {
        const initialId = convList[0].id;
        setActiveConversationId(initialId);
        loadConversationHistory(initialId);
      }
    } catch (err) {
      setGlobalError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle cross-page URL actions (e.g. ?newChat=true or ?convId=...)
  useEffect(() => {
    const isNew = searchParams.get("newChat");
    const targetConvId = searchParams.get("convId");
    if (isNew === "true") {
      handleNewChat();
      setSearchParams({});
    } else if (targetConvId && targetConvId !== activeConversationId) {
      handleSelectConversation(targetConvId);
      setSearchParams({});
    }
  }, [searchParams]);

  // Load chat history for a specific conversation
  const loadConversationHistory = async (convId) => {
    try {
      setChatLoading(true);
      setChatError("");
      const historyRes = await getNutriHistory(convId);
      if (historyRes?.messages && historyRes.messages.length > 0) {
        setMessages(historyRes.messages);
      } else {
        setMessages([DEFAULT_WELCOME_MSG]);
      }
    } catch (err) {
      console.warn("Could not load history for conversation:", err);
      setMessages([DEFAULT_WELCOME_MSG]);
    } finally {
      setChatLoading(false);
    }
  };

  // Auto-scroll chat container to bottom when messages update
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, chatLoading]);

  // ----------------------------------------------------
  // Conversation Management Handlers
  // ----------------------------------------------------
  const handleSelectConversation = (convId) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    loadConversationHistory(convId);
  };

  const handleNewChat = async () => {
    try {
      setChatLoading(true);
      const newConv = await createNutriConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([DEFAULT_WELCOME_MSG]);
    } catch (err) {
      // Fallback: local fresh chat
      setActiveConversationId(null);
      setMessages([DEFAULT_WELCOME_MSG]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await deleteNutriConversation(convId);
      const updated = conversations.filter((c) => c.id !== convId);
      setConversations(updated);

      if (activeConversationId === convId) {
        if (updated.length > 0) {
          setActiveConversationId(updated[0].id);
          loadConversationHistory(updated[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([DEFAULT_WELCOME_MSG]);
        }
      }
    } catch (err) {
      setChatError("Failed to delete conversation.");
    }
  };

  // ----------------------------------------------------
  // Chat Messaging Handler
  // ----------------------------------------------------
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || chatInput).trim();
    if (!text || chatLoading) return;

    const userMsg = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    setChatError("");

    try {
      const response = await interactWithNutri(text, null, activeConversationId);

      const assistantMsg = {
        role: "assistant",
        content: response.message,
        action: response.action,
        plan_modified: response.plan_modified,
        plan_modification: response.plan_modification,
        timestamp: response.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If backend assigned or created a conversation ID, track it
      if (response.conversation_id && response.conversation_id !== activeConversationId) {
        setActiveConversationId(response.conversation_id);
        // Refresh conversation list to get latest title
        getNutriConversations().then((res) => {
          if (res?.conversations) setConversations(res.conversations);
        });
      }

      // If meal plan was modified dynamically, update local plan state
      if (response.plan_modified && response.updated_plan) {
        setPlan(response.updated_plan);
        setLastPlanMod(response.plan_modification);
      }
    } catch (err) {
      setChatError(err.message || "Failed to communicate with Nutri.");
    } finally {
      setChatLoading(false);
    }
  };

  // ----------------------------------------------------
  // Meal Logging Handlers
  // ----------------------------------------------------
  const handleQuickFoodLog = async (e) => {
    e.preventDefault();
    if (!foodText.trim()) return;

    try {
      setLoggingFood(true);
      setGlobalError("");
      const result = await logFood({
        food_description: foodText.trim(),
        meal_type: mealType,
      });

      setFoodText("");
      setLogToast(
        result?.nutri_review
          ? `Meal logged! Nutri: "${result.nutri_review}"`
          : "Meal successfully logged! Daily nutrition updated."
      );
      setTimeout(() => setLogToast(""), 7000);

      // Refresh tracking and timing data immediately (deterministic update)
      const [updatedTrack, updatedTiming] = await Promise.all([
        getTodayTracking(),
        getDailyMealTiming().catch(() => null),
      ]);
      setTracking(updatedTrack);
      setTimingData(updatedTiming);
      setLogModalOpen(false);
    } catch (err) {
      setGlobalError(err.message || "Failed to log meal.");
    } finally {
      setLoggingFood(false);
    }
  };

  const handleLogPlannedMeal = async (plannedMeal) => {
    try {
      setLoggingFood(true);
      setGlobalError("");
      const description = `${plannedMeal.name} (${plannedMeal.portion_information || (plannedMeal.foods || []).join(", ")})`;
      const result = await logFood({
        food_description: description,
        meal_type: plannedMeal.meal_type || "Breakfast",
      });

      setLogToast(
        result?.nutri_review
          ? `Logged "${plannedMeal.name}"! Nutri: "${result.nutri_review}"`
          : `Logged "${plannedMeal.name}"!`
      );
      setTimeout(() => setLogToast(""), 7000);

      const [updatedTrack, updatedTiming] = await Promise.all([
        getTodayTracking(),
        getDailyMealTiming().catch(() => null),
      ]);
      setTracking(updatedTrack);
      setTimingData(updatedTiming);
    } catch (err) {
      setGlobalError(err.message || "Failed to log planned meal.");
    } finally {
      setLoggingFood(false);
    }
  };

  const handleRequestSwap = (plannedMeal) => {
    const prompt = `I want to adjust my ${plannedMeal.meal_type} ("${plannedMeal.name}"). Can you suggest an affordable, budget-friendly alternative or swap?`;
    handleSendMessage(prompt);
  };

  const handleRegenerateDietPlan = async () => {
    try {
      setRegeneratingPlan(true);
      setGlobalError("");
      const newPlan = await regeneratePlan();
      setPlan(newPlan);
      const [trackRes, timeRes] = await Promise.all([
        getTodayTracking(),
        getDailyMealTiming().catch(() => null),
      ]);
      setTracking(trackRes);
      setTimingData(timeRes);
    } catch (err) {
      setGlobalError(err.message || "Failed to regenerate plan.");
    } finally {
      setRegeneratingPlan(false);
    }
  };

  // ----------------------------------------------------
  // UI Helpers
  // ----------------------------------------------------
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

  const formatMsgTime = (ts) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const userName = user?.name ? user.name.split(" ")[0] : "Friend";

  const quickPrompts = [
    { label: "Give diet plan not the same 🥗", text: "give diet plan not the same diet plan. Provide fresh, creative meals with varied cuisines!" },
    { label: "Can't afford lunch 💡", text: "I can't afford today's lunch. Can you replace it with affordable budget-friendly foods?" },
    { label: "What did we talk about earlier? 🕒", text: "What did we discuss earlier in our past conversations? Can you remind me?" },
    { label: "Make dinner vegetarian 🥑", text: "Can you change today's dinner to a high-protein vegetarian meal?" },
    { label: "Hit protein goal 🎯", text: "How can I hit my remaining protein target with budget staples?" },
  ];

  // Meals logged count: Breakfast, Lunch, Dinner only
  const mealsLoggedCount = ["breakfast", "lunch", "dinner"].filter(
    (mType) =>
      timingData?.meals?.some((m) => m.meal_type.toLowerCase() === mType && m.is_logged) ||
      tracking?.logs?.some((l) => l.meal_type?.toLowerCase() === mType)
  ).length;

  const headerActions = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Metric 1: Nutrition Score */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary-50 dark:bg-primary-950/70 border border-primary-200 dark:border-primary-800 text-[11px] font-bold text-primary-900 dark:text-primary-200">
        <Sparkles className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
        <span className="hidden sm:inline">Score:</span>
        <span className="font-extrabold text-primary-700 dark:text-primary-400">
          {tracking?.nutrition_score ?? 0}
        </span>
        <span className="text-[10px] opacity-70">/100</span>
      </div>

      {/* Metric 2: Today's Calories */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-900 dark:text-blue-200">
        <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span className="hidden sm:inline">Calories:</span>
        <span className="font-extrabold text-blue-700 dark:text-blue-400">
          {tracking?.progress_percentages?.calories != null
            ? `${Math.round(tracking.progress_percentages.calories)}%`
            : "0%"}
        </span>
      </div>

      {/* Metric 3: Meals Logged */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
        <Utensils className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">Logged:</span>
        <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
          {mealsLoggedCount}/3
        </span>
      </div>

      {/* View Full Plan Drawer Button */}
      <button
        onClick={() => setPlanModalOpen(true)}
        className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
        title="View full meal schedule and physical activities"
      >
        <Utensils className="w-3.5 h-3.5 text-primary-600" />
        <span>Plan</span>
      </button>

      {/* Log Meal Button */}
      <button
        onClick={() => setLogModalOpen(true)}
        className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-xl text-xs font-bold shadow-xs shadow-primary-500/20 transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Log Meal</span>
      </button>
    </div>
  );

  return (
    <AppLayout
      fixedHeight={true}
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      onNewChat={handleNewChat}
      onDeleteConversation={handleDeleteConversation}
      headerActions={headerActions}
      title={`${getGreeting()}, ${userName} 👋`}
      subtitle="Nutri AI Companion • Authoritative meal tracking & cross-session memory"
    >
      {/* Global Error Banner */}
      {globalError && (
        <div className="p-3 bg-danger-50 dark:bg-danger-950/40 border-b border-danger-200 dark:border-danger-900/60 text-xs text-danger-700 dark:text-danger-300 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
            <span>{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError("")}
            className="font-bold underline text-[11px] hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Toast */}
      {logToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between px-4 sm:px-6 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{logToast}</span>
          </div>
          <button
            onClick={() => setLogToast("")}
            className="font-bold underline text-[11px] hover:no-underline"
          >
            Close
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. STICKY MEAL BAR (Breakfast, Lunch, Dinner only)   */}
      {/* ---------------------------------------------------- */}
      <StickyMealBar
        timingData={timingData}
        plan={plan}
        onOpenLogModal={(type) => {
          setMealType(type);
          setLogModalOpen(true);
        }}
        onLogPlannedMeal={handleLogPlannedMeal}
        onRequestSwap={handleRequestSwap}
        loggingFood={loggingFood}
      />

      {/* ---------------------------------------------------- */}
      {/* 2. INDEPENDENT SCROLLABLE CHAT STREAM (GEMINI UI)    */}
      {/* ---------------------------------------------------- */}
      <div
        ref={chatScrollRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-6 max-w-4xl w-full mx-auto nutri-chat-scroll relative"
      >
        {/* Plan Modified Toast inside Chat */}
        {lastPlanMod && (
          <div className="p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/70 border border-primary-300 dark:border-primary-800 text-xs text-primary-900 dark:text-primary-300 flex items-start justify-between gap-2 shadow-2xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">✨ Today's Plan Updated Live</span>
                <span>
                  Updated {lastPlanMod.meal_type}:{" "}
                  <strong>{lastPlanMod.replacement_meal?.name}</strong>
                </span>
              </div>
            </div>
            <button
              onClick={() => setLastPlanMod(null)}
              className="text-xs font-bold text-primary-700 dark:text-primary-400 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Conversation Messages */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return isUser ? (
            /* User Message Bubble */
            <div key={idx} className="flex items-start gap-3 flex-row-reverse w-full">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="rounded-2xl rounded-tr-xs px-4 py-3 bg-primary-600 text-white text-xs sm:text-sm leading-relaxed max-w-[85%] sm:max-w-[78%] shadow-xs whitespace-pre-wrap font-medium">
                {msg.content}
                {msg.timestamp && (
                  <div className="text-[10px] text-primary-200 mt-1 text-right">
                    {formatMsgTime(msg.timestamp)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Gemini-style Assistant Message */
            <div key={idx} className="flex items-start gap-3 sm:gap-4 flex-row w-full group">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-teal-500/20 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800/90 rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-xs space-y-3 transition-all hover:border-gray-300 dark:hover:border-slate-700">
                {/* Clean Formatted Markdown Text */}
                <ChatMessageFormatter content={msg.content} />

                {/* Plan Modification Card inside message */}
                {msg.plan_modified && msg.plan_modification && (
                  <div className="mt-3 pt-2.5 border-t border-primary-200/80 dark:border-primary-900/60 text-xs bg-primary-50/70 dark:bg-primary-950/50 p-3.5 rounded-2xl text-primary-900 dark:text-primary-200 font-medium space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-primary-700 dark:text-primary-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>✨ Live Plan Modification Applied</span>
                    </div>
                    <p>
                      {msg.plan_modification.meal_type} →{" "}
                      <strong className="text-primary-900 dark:text-white font-bold">
                        {msg.plan_modification.replacement_meal?.name}
                      </strong>
                    </p>
                    {msg.plan_modification.replacement_meal?.nutrition && (
                      <p className="text-[11px] text-primary-700/80 dark:text-primary-400/80">
                        {msg.plan_modification.replacement_meal.nutrition.calories || 0} kcal •{" "}
                        P: {msg.plan_modification.replacement_meal.nutrition.protein || 0}g •{" "}
                        C: {msg.plan_modification.replacement_meal.nutrition.carbohydrates || 0}g •{" "}
                        F: {msg.plan_modification.replacement_meal.nutrition.fat || 0}g
                      </p>
                    )}
                    {msg.plan_modification.reason && (
                      <p className="text-[11px] italic text-primary-800/70 dark:text-primary-300/70">
                        Reason: {msg.plan_modification.reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Footer Action & Timestamp */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800/80 text-[11px] text-gray-400 dark:text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 opacity-70" />
                    <span>{formatMsgTime(msg.timestamp)}</span>
                  </div>

                  <button
                    onClick={() => handleCopyMessage(msg.content, idx)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
                    title="Copy response"
                  >
                    {copiedIdx === idx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Gemini-style Animated Thinking Shimmer */}
        {chatLoading && (
          <div className="flex items-start gap-3 sm:gap-4 w-full">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-teal-500/20 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800/90 rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span>Nutri is reasoning and tailoring your nutrition…</span>
            </div>
          </div>
        )}

        {/* Error Message inside Chat */}
        {chatError && (
          <div className="p-3.5 rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/20 text-xs text-danger-700 dark:text-danger-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{chatError}</span>
            </div>
            <button
              onClick={() => setChatError("")}
              className="underline text-[11px] font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-28 right-6 sm:right-10 z-30 p-2.5 rounded-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 shadow-lg hover:shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer"
          title="Scroll to latest message"
        >
          <ChevronDown className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </button>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. FIXED BOTTOM MESSAGE COMPOSER                      */}
      {/* ---------------------------------------------------- */}
      <div className="shrink-0 p-3 sm:p-4 bg-white/95 dark:bg-slate-900/95 border-t border-gray-200/80 dark:border-slate-800/80 backdrop-blur-md z-20">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 nutri-chat-scroll">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q.text)}
                disabled={chatLoading}
                className="text-[11px] bg-gray-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/60 text-gray-700 dark:text-slate-300 hover:text-primary-700 dark:hover:text-primary-300 px-3 py-1.5 rounded-xl border border-gray-200/80 dark:border-slate-700 transition font-medium whitespace-nowrap disabled:opacity-50 cursor-pointer shrink-0"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-gray-100/90 dark:bg-slate-950/90 p-1.5 rounded-2xl border border-gray-300/80 dark:border-slate-800 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask Nutri: 'give diet plan not the same diet plan', 'What did we talk about earlier?'..."
              disabled={chatLoading}
              className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          <p className="text-[10px] text-center text-gray-400 dark:text-slate-500">
            Nutri AI Companion • Contextually remembers your past questions, goals, and logged meals.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 6. QUICK MEAL LOG MODAL                               */}
      {/* ---------------------------------------------------- */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                Log Consumed Meal
              </h3>
              <button
                onClick={() => setLogModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Warning if selected meal window is closed, upcoming, or completed */}
            {(() => {
              const selectedTiming = timingData?.meals?.find(
                (m) => m.meal_type.toLowerCase() === mealType.toLowerCase()
              );
              const selState = selectedTiming?.state?.toLowerCase();

              if (selectedTiming?.is_logged || selState === "completed") {
                return (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-900 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{mealType} has already been logged for today.</span>
                  </div>
                );
              }

              if (selState === "window_closed") {
                return (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900 text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{mealType} window is closed. This meal can no longer be logged today.</span>
                  </div>
                );
              }

              if (selState === "upcoming") {
                return (
                  <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-900 text-xs font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>
                      {mealType} is not available yet. It opens at{" "}
                      {formatTime12h(selectedTiming?.window_start || "08:00")}.
                    </span>
                  </div>
                );
              }

              return null;
            })()}

            <form onSubmit={handleQuickFoodLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Meal Type (Breakfast, Lunch, Dinner only)
                </label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Breakfast">Breakfast (08:00 AM – 10:00 AM)</option>
                  <option value="Lunch">Lunch (12:30 PM – 02:30 PM)</option>
                  <option value="Dinner">Dinner (07:00 PM – 09:00 PM)</option>
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
                  Nutri calculates actual nutrition and updates your score deterministically.
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
                  disabled={
                    loggingFood ||
                    !foodText.trim() ||
                    timingData?.meals?.some(
                      (m) =>
                        m.meal_type.toLowerCase() === mealType.toLowerCase() &&
                        (m.state?.toLowerCase() === "window_closed" ||
                          m.state?.toLowerCase() === "upcoming" ||
                          m.is_logged)
                    )
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
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

      {/* ---------------------------------------------------- */}
      {/* 7. FULL PLAN & ACTIVITIES DRAWER / MODAL              */}
      {/* ---------------------------------------------------- */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto nutri-chat-scroll">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-primary-600" />
                  Today's Daily Plan & Activities
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Breakfast, Lunch, Dinner (No snacks) • Energy balancing activities
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerateDietPlan}
                  disabled={regeneratingPlan}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regeneratingPlan ? "animate-spin" : ""}`} />
                  <span>{regeneratingPlan ? "Regenerating…" : "New Ideas"}</span>
                </button>
                <button
                  onClick={() => setPlanModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Meals List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Scheduled Meals
              </h4>
              {["breakfast", "lunch", "dinner"].map((mType) => {
                const meal = plan?.meals?.find((m) => m.meal_type.toLowerCase() === mType);
                return (
                  <div
                    key={mType}
                    className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-bold uppercase text-primary-600 dark:text-primary-400 block">
                        {mType}
                      </span>
                      <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                        {meal?.name || `Planned ${mType}`}
                      </h5>
                      {meal?.portion_information && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          Portion: {meal.portion_information}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs font-semibold text-gray-700 dark:text-slate-300">
                      <span>{meal?.nutrition?.calories || 0} kcal</span>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        P: {meal?.nutrition?.protein || 0}g • C: {meal?.nutrition?.carbohydrates || 0}g • F: {meal?.nutrition?.fat || 0}g
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Physical Activities List */}
            {plan?.physical_activities && plan.physical_activities.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Physical Activities
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plan.physical_activities.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {act.name}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-primary-600 bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded-full">
                          {act.intensity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Timer className="w-3 h-3" />
                        <span>{act.duration_minutes} mins</span>
                      </div>
                      {act.notes && (
                        <p className="text-[11px] text-gray-400 italic">{act.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
