/**
 * Nutri AI Companion Dashboard Component.
 *
 * Polished features:
 * - Standalone, independently scrollable conversation container (NO document/page scrolling).
 * - Instant nutrition guidance, meal reviews, and budget-friendly substitutions.
 * - Dynamic Plan Modification: when requested, updates today's active MongoDB meal plan and notifies the dashboard.
 * - Unified Theme styling: White + Green in Light mode, Dark Slate + Electric Blue in Dark mode.
 */

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { interactWithNutri } from "../services/nutriService";

export default function NutriWidget({
  tracking,
  currentPlan,
  onPlanUpdated,
  onMealLogged,
  externalPrompt,
  onClearExternalPrompt,
}) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi there! 👋 I'm Nutri, your nutrition companion. I'm here to help you adjust today's meals, find budget-friendly swaps, review your food choices, and stay nourished without stress! What do you need today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastPlanMod, setLastPlanMod] = useState(null);

  const chatContainerRef = useRef(null);

  const quickPrompts = [
    {
      label: "Can't afford lunch 💡",
      text: "I can't afford today's lunch. Can you replace it with affordable budget-friendly foods?",
    },
    {
      label: "Don't have chicken 🥑",
      text: "I don't have chicken. What can I eat instead for today's meal?",
    },
    {
      label: "Make dinner vegetarian 🥗",
      text: "Can you change today's dinner to a high-protein vegetarian meal?",
    },
    {
      label: "Ate something else 🍳",
      text: "I already ate 2 eggs and 2 roti. How should I adjust the rest of today?",
    },
    {
      label: "Check my protein 🎯",
      text: "How can I hit my remaining protein target with what I have?",
    },
  ];

  // Internal auto-scroll ONLY on the internal chat container
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle external prompt requests (e.g., clicking "Swap with Nutri" on a meal card)
  useEffect(() => {
    if (externalPrompt) {
      handleSendMessage(externalPrompt);
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
  }, [externalPrompt]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await interactWithNutri(text);

      const assistantMsg = {
        role: "assistant",
        content: response.message,
        action: response.action,
        plan_modified: response.plan_modified,
        plan_modification: response.plan_modification,
        timestamp: response.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If plan was modified, trigger live update of Today's Diet Plan panel
      if (response.plan_modified && response.updated_plan) {
        setLastPlanMod(response.plan_modification);
        if (onPlanUpdated) {
          onPlanUpdated(response.updated_plan);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to communicate with Nutri.");
    } finally {
      setLoading(false);
    }
  };

  const recentLog =
    tracking?.logs && tracking.logs.length > 0
      ? tracking.logs[tracking.logs.length - 1]
      : null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col h-full min-h-[520px] max-h-[640px] transition-colors">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-800 dark:from-slate-900 dark:via-primary-950 dark:to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 dark:bg-primary-600/30 text-white flex items-center justify-center backdrop-blur-md shadow-xs border border-white/20">
            <Bot className="w-5 h-5 text-primary-100 dark:text-primary-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold">Nutri Companion</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-white/20 dark:bg-primary-400/25 text-white dark:text-primary-200 px-2 py-0.5 rounded-full border border-white/30 dark:border-primary-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-primary-400 animate-pulse" />
                Active
              </span>
            </div>
            <p className="text-xs text-primary-100 dark:text-slate-400">
              Your nutrition companion & meal planner
            </p>
          </div>
        </div>
      </div>

      {/* Latest Meal Review Banner if available */}
      {recentLog?.nutri_review && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-primary-50/80 dark:bg-slate-950 border border-primary-200 dark:border-primary-900/60 text-xs text-primary-900 dark:text-primary-300 flex items-start gap-2.5 shadow-2xs shrink-0">
          <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">
              Recent Log Review ({recentLog.meal_type}):
            </span>
            <span className="italic">{recentLog.nutri_review}</span>
          </div>
        </div>
      )}

      {/* Plan Modified Alert Toast */}
      {lastPlanMod && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-primary-50 dark:bg-slate-950 border border-primary-300 dark:border-primary-800 text-xs text-primary-900 dark:text-primary-300 flex items-start justify-between gap-2 shrink-0 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">✨ Today's Plan Updated!</span>
              <span>
                Updated {lastPlanMod.meal_type}:{" "}
                <strong>{lastPlanMod.replacement_meal?.name}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={() => setLastPlanMod(null)}
            className="text-xs font-bold text-primary-700 dark:text-primary-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scrollable Conversation Stream — ONLY this container scrolls */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto nutri-chat-scroll p-4 space-y-3 bg-gray-50/50 dark:bg-slate-950/50"
      >
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? "bg-primary-600 text-white"
                    : "bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
                }`}
              >
                {isUser ? "You" : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed max-w-[85%] shadow-2xs ${
                  isUser
                    ? "bg-primary-600 text-white rounded-tr-xs"
                    : "bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 border border-gray-200/80 dark:border-slate-800 rounded-tl-xs whitespace-pre-wrap"
                }`}
              >
                {msg.content}

                {msg.plan_modified && msg.plan_modification && (
                  <div className="mt-2.5 pt-2 border-t border-primary-200 dark:border-slate-800 text-xs text-primary-800 dark:text-primary-300 bg-primary-50/70 dark:bg-primary-950/50 p-2.5 rounded-xl font-medium">
                    <span className="font-bold block">✨ Applied Plan Change:</span>
                    {msg.plan_modification.meal_type} →{" "}
                    {msg.plan_modification.replacement_meal?.name}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl rounded-tl-xs p-3 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600 dark:text-primary-400" />
              <span>Nutri is thinking and adjusting…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/20 p-2.5 text-xs text-danger-600 dark:text-danger-400 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Prompts & Bottom Input */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0">
        {/* Quick Action Chips */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto max-h-16 nutri-chat-scroll">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q.text)}
              disabled={loading}
              className="text-[11px] bg-gray-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950 text-gray-700 dark:text-slate-300 hover:text-primary-800 dark:hover:text-primary-300 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-slate-700 transition font-medium disabled:opacity-50 shrink-0"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* User Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nutri: 'Change lunch', 'Can't afford chicken'..."
            disabled={loading}
            className="flex-1 rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-4 py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-sm transition disabled:opacity-50 shrink-0"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
