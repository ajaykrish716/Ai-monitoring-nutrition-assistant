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
  Camera,
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import StickyMealBar from "../components/StickyMealBar";
import ChatMessageFormatter from "../components/ChatMessageFormatter";
import MealEvidenceUpload from "../components/MealEvidenceUpload";
import MealDetailModal from "../components/MealDetailModal";
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
import { getEvidenceForDate } from "../services/mealEvidenceService";

const makeWelcomeMsg = (userName) => ({
  role: "assistant",
  content:
    `👋 Hey ${userName || "there"}! I'm **Nutri**, your personal nutrition companion. 😊\n\nI can help you check today's meals, track your progress, adjust your plan, and answer nutrition questions.\n\nWhat would you like to check today?`,
  timestamp: new Date().toISOString(),
  suggestions: [
    { label: "🍳 Breakfast", text: "Show me today's breakfast" },
    { label: "🍛 Lunch", text: "What's for lunch today?" },
    { label: "🍽️ Dinner", text: "What's for dinner tonight?" },
    { label: "📊 Progress", text: "How am I doing today?" },
  ],
});

const DEFAULT_WELCOME_MSG = makeWelcomeMsg("");

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
  // Contextual suggestions from the last Nutri response
  const [contextualSuggestions, setContextualSuggestions] = useState([
    { label: "🍳 Breakfast", text: "Show me today's breakfast" },
    { label: "🍛 Lunch", text: "What's for lunch today?" },
    { label: "🍽️ Dinner", text: "What's for dinner tonight?" },
    { label: "📊 Progress", text: "How am I doing today?" },
  ]);

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

  // Meal Evidence State — keyed by meal_type ("Breakfast", "Lunch", "Dinner")
  const [evidenceMap, setEvidenceMap] = useState({});

  // Meal Detail Modal state
  const [detailMealType, setDetailMealType] = useState(null); // null = closed

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
  // Fetch today's date as YYYY-MM-DD in local timezone
  const getTodayDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setGlobalError("");
      const todayStr = getTodayDateStr();
      const [planRes, trackRes, timeRes, convRes, evidenceRes] = await Promise.all([
        getTodayPlan().catch(() => null),
        getTodayTracking().catch(() => null),
        getDailyMealTiming().catch(() => null),
        getNutriConversations().catch(() => ({ conversations: [] })),
        getEvidenceForDate(todayStr).catch(() => ({ evidence: [] })),
      ]);

      setPlan(planRes);
      setTracking(trackRes);
      setTimingData(timeRes);

      // Build evidence map keyed by meal_type
      const eMap = {};
      (evidenceRes?.evidence || []).forEach((ev) => {
        eMap[ev.meal_type] = ev;
      });
      setEvidenceMap(eMap);

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

  // Evidence handlers
  const handleEvidenceUploaded = (mealTypeKey, record) => {
    setEvidenceMap((prev) => ({ ...prev, [mealTypeKey]: record }));
  };

  const handleEvidenceDeleted = (mealTypeKey) => {
    setEvidenceMap((prev) => {
      const next = { ...prev };
      delete next[mealTypeKey];
      return next;
    });
  };

  // Meal Detail Modal handlers
  const handleViewDetails = (mealType) => {
    setDetailMealType(mealType);
  };

  const handleDetailModalClose = () => {
    setDetailMealType(null);
  };

  // Called when evidence uploaded from detail modal
  const handleDetailEvidenceUploaded = (mealType, record) => {
    setEvidenceMap((prev) => ({ ...prev, [mealType]: record }));
    // Keep modal open so user sees the completed state
  };

  // Called when evidence deleted from detail modal
  const handleDetailEvidenceDeleted = (mealType) => {
    setEvidenceMap((prev) => {
      const next = { ...prev };
      delete next[mealType];
      return next;
    });
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
        intent: response.intent,
        plan_modified: response.plan_modified,
        plan_modification: response.plan_modification,
        suggestions: response.suggestions || [],
        timestamp: response.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Update contextual suggestions from the latest response
      if (response.suggestions && response.suggestions.length > 0) {
        setContextualSuggestions(response.suggestions);
      }

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
      setChatError(err.message || "Sorry, I'm having trouble connecting right now. Please try again!");
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

  // Update welcome message with real user name once user data loads
  const prevUserNameRef = React.useRef("");
  useEffect(() => {
    if (userName && userName !== "Friend" && userName !== prevUserNameRef.current) {
      prevUserNameRef.current = userName;
      setMessages((prev) => {
        if (prev.length === 1 && prev[0].role === "assistant" && prev[0].content.includes("there")) {
          return [makeWelcomeMsg(userName)];
        }
        return prev;
      });
    }
  }, [userName]);

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
      {/* ── Global Error Banner ── */}
      {globalError && (
        <div className="px-4 sm:px-6 py-2.5 bg-danger-50 dark:bg-danger-950/40 border-b border-danger-200 dark:border-danger-900/60 text-xs text-danger-700 dark:text-danger-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
            <span>{globalError}</span>
          </div>
          <button onClick={() => setGlobalError("")} className="font-bold underline text-[11px] hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* ── Success Toast ── */}
      {logToast && (
        <div className="px-4 sm:px-6 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{logToast}</span>
          </div>
          <button onClick={() => setLogToast("")} className="font-bold underline text-[11px] hover:no-underline">Close</button>
        </div>
      )}

      {/* ================================================================ */}
      {/* THREE-COLUMN DASHBOARD BODY                                       */}
      {/* COL-1: via AppLayout sidebar  |  COL-2: meal cards  |  COL-3: AI */}
      {/* ================================================================ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ────────────────────────────────────────────────── */}
        {/* COL-2 Â· MAIN MEAL CONTENT (scrollable)            */}
        {/* ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto nutri-chat-scroll px-5 py-6 lg:px-8 lg:py-8 min-w-0 bg-gray-50/60 dark:bg-slate-950/60">

          {/* Personalised Greeting */}
          <div className="mb-7">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {getGreeting()}, <span className="text-primary-600 dark:text-primary-400">{userName.toUpperCase()}</span> 👋
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-medium">Today's Nutrition Plan</p>

            {/* Plan Modified Banner */}
            {lastPlanMod && (
              <div className="mt-3 p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/70 border border-primary-300 dark:border-primary-800 text-xs text-primary-900 dark:text-primary-300 flex items-start justify-between gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">✨ Today's Plan Updated Live</span>
                    <span>Updated {lastPlanMod.meal_type}: <strong>{lastPlanMod.replacement_meal?.name}</strong></span>
                  </div>
                </div>
                <button onClick={() => setLastPlanMod(null)} className="text-xs font-bold text-primary-700 dark:text-primary-400 underline hover:no-underline shrink-0">Dismiss</button>
              </div>
            )}
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 h-44" />
              ))}
            </div>
          )}

          {/* Meal Cards */}
          {!loading && (
            <div className="space-y-4">
              {[
                { key: "breakfast", type: "Breakfast", icon: "🍳", defaultStart: "08:00", defaultEnd: "10:00" },
                { key: "lunch",     type: "Lunch",     icon: "🍛", defaultStart: "12:30", defaultEnd: "14:30" },
                { key: "dinner",    type: "Dinner",    icon: "🍽️", defaultStart: "19:00", defaultEnd: "21:00" },
              ].map((def) => {
                const timing      = timingData?.meals?.find((t) => t.meal_type.toLowerCase() === def.key);
                const meal        = plan?.meals?.find((m) => m.meal_type.toLowerCase() === def.key);
                const mealEvidence = evidenceMap[def.type] || null;
                const hasEvidence = !!mealEvidence?.image_data_uri;

                const startStr = timing?.window_start || def.defaultStart;
                const endStr   = timing?.window_end   || def.defaultEnd;

                const rawState = timing?.state?.toLowerCase();
                const isLogged = timing?.is_logged || false;
                let state = "upcoming";
                if (isLogged) {
                  state = "completed";
                } else if (rawState) {
                  state = rawState;
                } else {
                  const now = new Date();
                  const [sh, sm] = startStr.split(":").map(Number);
                  const [eh, em] = endStr.split(":").map(Number);
                  const curMins   = now.getHours() * 60 + now.getMinutes();
                  const startMins = sh * 60 + sm;
                  const endMins   = eh * 60 + em;
                  if (curMins >= endMins)   state = "window_closed";
                  else if (curMins >= startMins) state = "available";
                }

                const isCompleted = state === "completed";
                const isAvailable = state === "available";
                const isClosed    = state === "window_closed";

                // Card border colour based on state
                const cardBorder = isCompleted
                  ? "border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-slate-900"
                  : isAvailable
                  ? "border-primary-300 dark:border-primary-700/80 bg-white dark:bg-slate-900 ring-2 ring-primary-500/10"
                  : isClosed
                  ? "border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/60 opacity-80"
                  : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900";

                return (
                  <div
                    key={def.key}
                    onClick={() => handleViewDetails(def.type)}
                    className={`group relative rounded-3xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.995] ${cardBorder}`}
                  >
                    <div className="p-6">
                      {/* Card Top Row */}
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: icon + type */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200/60 dark:from-primary-950/60 dark:to-primary-900/30 flex items-center justify-center text-3xl border border-primary-200/60 dark:border-primary-800/50 shrink-0 shadow-xs">
                            {def.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400">{def.type}</span>
                              {/* State badge */}
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <Check className="w-2.5 h-2.5" />Logged
                                </span>
                              )}
                              {isAvailable && !isCompleted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Now
                                </span>
                              )}
                              {isClosed && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  <Clock className="w-2.5 h-2.5" />Closed
                                </span>
                              )}
                              {!isCompleted && !isAvailable && !isClosed && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                  <Clock className="w-2.5 h-2.5" />{formatTime12h(startStr)}
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight mt-0.5 truncate">
                              {meal?.name || `Planned ${def.type}`}
                            </h3>
                          </div>
                        </div>

                        {/* Right: Details arrow */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-400 group-hover:underline transition">
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* Time row */}
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 dark:text-slate-400 font-medium">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatTime12h(startStr)} – {formatTime12h(endStr)}</span>
                      </div>

                      {/* Nutrition row */}
                      {(meal?.nutrition?.calories || meal?.nutrition?.protein) ? (
                        <div className="mt-4 flex items-center flex-wrap gap-3">
                          {meal.nutrition.calories > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 text-orange-900 dark:text-orange-200">
                              <span className="text-base">🔥</span>
                              <span className="text-sm font-black">{Math.round(meal.nutrition.calories)}</span>
                              <span className="text-xs opacity-70">kcal</span>
                            </div>
                          )}
                          {meal.nutrition.protein > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200">
                              <span className="text-base">💪</span>
                              <span className="text-sm font-black">{Math.round(meal.nutrition.protein)}g</span>
                              <span className="text-xs opacity-70">Protein</span>
                            </div>
                          )}
                          {meal.nutrition.carbohydrates > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200">
                              <span className="text-base">🌾</span>
                              <span className="text-sm font-black">{Math.round(meal.nutrition.carbohydrates)}g</span>
                              <span className="text-xs opacity-70">Carbs</span>
                            </div>
                          )}
                          {meal.nutrition.fat > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200">
                              <span className="text-base">🫒</span>
                              <span className="text-sm font-black">{Math.round(meal.nutrition.fat)}g</span>
                              <span className="text-xs opacity-70">Fat</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-gray-400 dark:text-slate-500 italic">
                          Generate today's plan to see nutrition details
                        </p>
                      )}

                      {/* Food chips */}
                      {meal?.foods && meal.foods.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {meal.foods.slice(0, 5).map((food, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-slate-300 font-medium">
                              {food}
                            </span>
                          ))}
                          {meal.foods.length > 5 && (
                            <span className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-500 dark:text-slate-400">
                              +{meal.foods.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bottom action row */}
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800/70 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Evidence status */}
                          {hasEvidence ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Evidence Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
                              <Camera className="w-3.5 h-3.5 shrink-0" />
                              No evidence yet
                            </span>
                          )}

                          {/* Quick Log button (stops propagation so card click doesn't also trigger) */}
                          {isAvailable && !isCompleted && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleLogPlannedMeal(meal); }}
                              disabled={loggingFood}
                              className="flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />Log
                            </button>
                          )}

                          {/* Swap button */}
                          {!isCompleted && !isClosed && meal && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRequestSwap(meal); }}
                              className="text-[11px] font-semibold text-gray-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 flex items-center gap-0.5 transition cursor-pointer"
                            >
                              Swap<ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* View Details cta */}
                        <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 shrink-0">
                          View Details <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No plan state */}
          {!loading && !plan && (
            <div className="mt-8 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 text-center space-y-3">
              <div className="text-4xl">🥗</div>
              <h4 className="text-base font-bold text-gray-800 dark:text-slate-200">No plan generated yet</h4>
              <p className="text-xs text-gray-500 dark:text-slate-400">Ask Nutri to generate today's nutrition plan, or click below.</p>
              <button
                onClick={handleRegenerateDietPlan}
                disabled={regeneratingPlan}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regeneratingPlan ? "animate-spin" : ""}`} />
                {regeneratingPlan ? "Generating…" : "Generate Plan"}
              </button>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────── */}
        {/* COL-3 Â· NUTRI AI COMPACT RIGHT PANEL              */}
        {/* ────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-[22rem] shrink-0 border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
          {/* Panel Header */}
          <div className="px-4 py-3.5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2.5 shrink-0 bg-gradient-to-r from-primary-600 to-primary-700 dark:from-slate-900 dark:to-primary-950">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white truncate">Nutri AI</h3>
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded-full border border-white/25">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />Live
                </span>
              </div>
              <p className="text-[10px] text-primary-100 dark:text-slate-400 truncate">Your nutrition companion</p>
            </div>
          </div>

          {/* Plan Modified Alert inside panel */}
          {lastPlanMod && (
            <div className="mx-3 mt-2.5 p-2.5 rounded-xl bg-primary-50 dark:bg-primary-950/70 border border-primary-200 dark:border-primary-800 text-[11px] text-primary-900 dark:text-primary-300 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                <span className="font-semibold">Plan updated: <strong>{lastPlanMod.replacement_meal?.name}</strong></span>
              </div>
              <button onClick={() => setLastPlanMod(null)} className="font-bold underline text-[10px] shrink-0">×</button>
            </div>
          )}

          {/* Scrollable Chat Messages */}
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto nutri-chat-scroll p-3 space-y-3 bg-gray-50/50 dark:bg-slate-950/50 min-h-0"
          >
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div key={idx} className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isUser ? "bg-primary-600 text-white" : "bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"}`}>
                    {isUser ? (user?.name ? user.name.charAt(0).toUpperCase() : "U") : <Sparkles className="w-3 h-3" />}
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed max-w-[88%] shadow-2xs ${isUser ? "bg-primary-600 text-white rounded-tr-xs" : "bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 border border-gray-200/80 dark:border-slate-800 rounded-tl-xs whitespace-pre-wrap"}`}>
                    <ChatMessageFormatter content={msg.content} />
                    {msg.plan_modified && msg.plan_modification && (
                      <div className="mt-2 pt-1.5 border-t border-primary-200 dark:border-slate-700 text-[10px] font-medium text-primary-800 dark:text-primary-300">
                        ✨ {msg.plan_modification.meal_type} → <strong>{msg.plan_modification.replacement_meal?.name}</strong>
                      </div>
                    )}
                    {msg.timestamp && (
                      <div className={`text-[9px] mt-1 ${isUser ? "text-primary-200 text-right" : "text-gray-400 dark:text-slate-500"}`}>
                        {formatMsgTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-primary-600 dark:text-primary-400 animate-pulse" />
                </div>
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl rounded-tl-xs px-3 py-2 text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  Thinking…
                </div>
              </div>
            )}

            {chatError && (
              <div className="p-2.5 rounded-xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/20 text-[11px] text-danger-700 dark:text-danger-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{chatError}</span>
                <button onClick={() => setChatError("")} className="ml-auto font-bold underline text-[10px]">×</button>
              </div>
            )}
          </div>

          {/* Quick Prompt Chips — contextual from last AI response */}
          <div className="px-3 pt-2.5 pb-1 border-t border-gray-100 dark:border-slate-800 shrink-0">
            <div className="flex flex-wrap gap-1.5 max-h-14 overflow-y-auto nutri-chat-scroll">
              {contextualSuggestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q.text)}
                  disabled={chatLoading}
                  className="text-[10px] bg-gray-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/60 text-gray-700 dark:text-slate-300 hover:text-primary-700 dark:hover:text-primary-300 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 transition font-medium whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <div className="p-3 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2 bg-gray-100/80 dark:bg-slate-950/80 p-1 rounded-xl border border-gray-300/70 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about meals, nutrition, progress…"
                disabled={chatLoading}
                className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              >
                {chatLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </form>
          </div>
        </aside>

        {/* Mobile: Nutri chat below meals (shown only on <lg) */}
        <div className="lg:hidden border-t border-gray-200 dark:border-slate-800 shrink-0">
          {/* Mobile quick-send strip */}
          <div className="p-3 bg-white/95 dark:bg-slate-900/95 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 nutri-chat-scroll">
              {contextualSuggestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q.text)}
                  disabled={chatLoading}
                  className="text-[10px] bg-gray-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/60 text-gray-700 dark:text-slate-300 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 transition font-medium whitespace-nowrap disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2 bg-gray-100/90 dark:bg-slate-950/90 p-1.5 rounded-2xl border border-gray-300/80 dark:border-slate-800 focus-within:ring-2 focus-within:ring-primary-500 transition"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Nutri AI…"
                disabled={chatLoading}
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

      </div>{/* end three-col body */}

      {/* ──────────────────────────────────────── */}
      {/* MODALS — all preserved exactly          */}
      {/* ──────────────────────────────────────── */}

      {/* Quick Meal Log Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary-600 dark:text-primary-500" />
                Log Consumed Meal
              </h3>
              <button onClick={() => setLogModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold">✕</button>
            </div>

            {(() => {
              const selectedTiming = timingData?.meals?.find((m) => m.meal_type.toLowerCase() === mealType.toLowerCase());
              const selState = selectedTiming?.state?.toLowerCase();
              if (selectedTiming?.is_logged || selState === "completed")
                return <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-900 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>{mealType} has already been logged.</span></div>;
              if (selState === "window_closed")
                return <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900 text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /><span>{mealType} window is closed.</span></div>;
              if (selState === "upcoming")
                return <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-900 text-xs font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-2"><Clock className="w-4 h-4 text-sky-600 shrink-0" /><span>{mealType} opens at {formatTime12h(selectedTiming?.window_start || "08:00")}.</span></div>;
              return null;
            })()}

            <form onSubmit={handleQuickFoodLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Meal Type</label>
                <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="Breakfast">Breakfast (08:00 AM – 10:00 AM)</option>
                  <option value="Lunch">Lunch (12:30 PM – 02:30 PM)</option>
                  <option value="Dinner">Dinner (07:00 PM – 09:00 PM)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">What did you eat?</label>
                <textarea rows={3} value={foodText} onChange={(e) => setFoodText(e.target.value)} placeholder="e.g., 2 eggs and 2 roti, or 1 bowl dal with rice" required className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none" autoFocus />
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Nutri calculates actual nutrition and updates your score.</p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setLogModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition">Cancel</button>
                <button type="submit" disabled={loggingFood || !foodText.trim() || timingData?.meals?.some((m) => m.meal_type.toLowerCase() === mealType.toLowerCase() && (m.state?.toLowerCase() === "window_closed" || m.state?.toLowerCase() === "upcoming" || m.is_logged))} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer">
                  {loggingFood ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</> : "Save Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Plan & Activities Modal */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto nutri-chat-scroll">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2"><Utensils className="w-5 h-5 text-primary-600" />Today's Daily Plan & Activities</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Breakfast, Lunch, Dinner • Energy balancing activities</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRegenerateDietPlan} disabled={regeneratingPlan} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${regeneratingPlan ? "animate-spin" : ""}`} />
                  <span>{regeneratingPlan ? "Regenerating…" : "New Ideas"}</span>
                </button>
                <button onClick={() => setPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-sm font-bold p-1">✕</button>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Scheduled Meals</h4>
              {["Breakfast", "Lunch", "Dinner"].map((mType) => {
                const meal = plan?.meals?.find((m) => m.meal_type.toLowerCase() === mType.toLowerCase());
                const mealEvidence = evidenceMap[mType] || null;
                return (
                  <div key={mType} className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase text-primary-600 dark:text-primary-400 block">{mType}</span>
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white">{meal?.name || `Planned ${mType}`}</h5>
                        {meal?.portion_information && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Portion: {meal.portion_information}</p>}
                      </div>
                      <div className="text-right text-xs font-semibold text-gray-700 dark:text-slate-300 shrink-0">
                        <span>{meal?.nutrition?.calories || 0} kcal</span>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">P: {meal?.nutrition?.protein || 0}g • C: {meal?.nutrition?.carbohydrates || 0}g • F: {meal?.nutrition?.fat || 0}g</p>
                      </div>
                    </div>
                    <MealEvidenceUpload date={getTodayDateStr()} mealType={mType} plannedMealName={meal?.name || ""} evidence={mealEvidence} onUploaded={(record) => handleEvidenceUploaded(mType, record)} onDeleted={() => handleEvidenceDeleted(mType)} />
                  </div>
                );
              })}
            </div>
            {plan?.physical_activities && plan.physical_activities.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Physical Activities</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plan.physical_activities.map((act, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{act.name}</span>
                        <span className="text-[10px] uppercase font-bold text-primary-600 bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded-full">{act.intensity}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Timer className="w-3 h-3" /><span>{act.duration_minutes} mins</span>
                      </div>
                      {act.notes && <p className="text-[11px] text-gray-400 italic">{act.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meal Detail Modal */}
      {detailMealType && (
        <MealDetailModal
          meal={plan?.meals?.find((m) => m.meal_type.toLowerCase() === detailMealType.toLowerCase()) || null}
          plan={plan}
          date={getTodayDateStr()}
          evidence={evidenceMap[detailMealType] || null}
          onClose={handleDetailModalClose}
          onUploaded={handleDetailEvidenceUploaded}
          onDeleted={handleDetailEvidenceDeleted}
        />
      )}
    </AppLayout>
  );
}

