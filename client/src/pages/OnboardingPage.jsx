/**
 * Onboarding Page — generic renderer for AI-driven questions with unified theme tokens.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Sun,
  Moon,
} from "lucide-react";

import { startOnboarding, submitAnswer } from "../services/onboardingService";
import useThemeStore from "../store/themeStore";

/* ------------------------------------------------------------------ */
/* Dynamic field renderers — keyed by question type                    */
/* ------------------------------------------------------------------ */

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Type your answer…"}
      className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500/40"
      autoFocus
    />
  );
}

function NumberInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Enter a number…"}
      className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500/40"
      autoFocus
    />
  );
}

function TextareaInput({ value, onChange, placeholder }) {
  return (
    <textarea
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Tell us more…"}
      className="w-full rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none transition focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500/40 resize-none"
      autoFocus
    />
  );
}

function SingleSelect({ value, onChange, options, name = "onboarding_single_select" }) {
  return (
    <div className="space-y-2 select-none" role="radiogroup">
      {(options || []).map((opt, index) => {
        const optValue =
          typeof opt === "object" && opt !== null
            ? String(opt.value ?? opt.id ?? opt.label ?? opt.text ?? index)
            : String(opt);
        const optLabel =
          typeof opt === "object" && opt !== null
            ? String(opt.label ?? opt.text ?? opt.value ?? opt.id ?? optValue)
            : String(opt);
        const isSelected = value === optValue;

        return (
          <label
            key={optValue + "-" + index}
            onClick={() => onChange(optValue)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition select-none ${
              isSelected
                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/80 ring-2 ring-primary-500/30"
                : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={optValue}
              checked={isSelected}
              onChange={() => onChange(optValue)}
              className="sr-only"
            />
            <div
              className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                isSelected
                  ? "border-primary-600"
                  : "border-gray-300 dark:border-slate-600"
              }`}
            >
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-primary-600" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100 select-none">
              {optLabel}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function MultiSelect({ value, onChange, options, name = "onboarding_multi_select" }) {
  const selected = value ? value.split(", ").filter(Boolean) : [];

  const toggle = (optValue) => {
    const next = selected.includes(optValue)
      ? selected.filter((s) => s !== optValue)
      : [...selected, optValue];
    onChange(next.join(", "));
  };

  return (
    <div className="space-y-2 select-none">
      {(options || []).map((opt, index) => {
        const optValue =
          typeof opt === "object" && opt !== null
            ? String(opt.value ?? opt.id ?? opt.label ?? opt.text ?? index)
            : String(opt);
        const optLabel =
          typeof opt === "object" && opt !== null
            ? String(opt.label ?? opt.text ?? opt.value ?? opt.id ?? optValue)
            : String(opt);
        const isSelected = selected.includes(optValue);

        return (
          <label
            key={optValue + "-" + index}
            onClick={(e) => {
              if (e.target.tagName !== "INPUT") {
                toggle(optValue);
              }
            }}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition select-none ${
              isSelected
                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/80 ring-2 ring-primary-500/30"
                : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <input
              type="checkbox"
              name={name}
              value={optValue}
              checked={isSelected}
              onChange={() => toggle(optValue)}
              className="sr-only"
            />
            <div
              className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border-2 shrink-0 transition ${
                isSelected
                  ? "border-primary-600 bg-primary-600"
                  : "border-gray-300 dark:border-slate-600"
              }`}
            >
              {isSelected && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100 select-none">
              {optLabel}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function BooleanInput({ value, onChange, options }) {
  const opts = options && options.length > 0 ? options : ["Yes", "No"];
  return (
    <div className="grid grid-cols-2 gap-3 select-none">
      {opts.map((opt) => {
        const optStr = String(opt);
        const isSelected = String(value).toLowerCase() === optStr.toLowerCase();
        return (
          <button
            key={optStr}
            type="button"
            onClick={() => onChange(optStr)}
            className={`flex items-center justify-center gap-2 rounded-2xl border py-3 px-4 text-sm font-bold transition ${
              isSelected
                ? "border-primary-600 bg-primary-50 text-primary-800 dark:bg-primary-950 dark:text-primary-300 ring-2 ring-primary-500/30 shadow-sm"
                : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            }`}
          >
            {optStr}
          </button>
        );
      })}
    </div>
  );
}

const RENDERERS = {
  text: TextInput,
  number: NumberInput,
  textarea: TextareaInput,
  single_select: SingleSelect,
  multi_select: MultiSelect,
  boolean: BooleanInput,
};

/* ------------------------------------------------------------------ */
/* Completion summary — renders dynamic profile dict                   */
/* ------------------------------------------------------------------ */

function CompletionSummary({ question, profile, onContinue }) {
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 mb-2">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
          {question?.text || "Onboarding Complete!"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Here's what we personalized for you
        </p>
      </div>

      {profile && Object.keys(profile).length > 0 && (
        <div className="bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 text-left space-y-3">
          {Object.entries(profile).map(([key, val]) => (
            <div key={key} className="flex justify-between items-start gap-4">
              <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide min-w-[100px]">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-200 text-right">
                {typeof val === "object" ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onContinue}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-600 hover:bg-primary-700 px-4 py-3.5 text-sm font-bold text-white shadow-md transition cursor-pointer"
      >
        <span>Go to Dashboard</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Onboarding Page                                                */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [profile, setProfile] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError("");
        const state = await startOnboarding();
        if (cancelled) return;

        setIsComplete(state.is_complete);
        setQuestionsAnswered(state.questions_answered || 0);
        setCurrentQuestion(state.current_question);
        setProfile(state.profile || {});
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to start onboarding.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim()) return;

    try {
      setSubmitting(true);
      setError("");
      const result = await submitAnswer(answer.trim());

      setAnswer("");
      setIsComplete(result.is_complete);
      setQuestionsAnswered(result.questions_answered || 0);
      setCurrentQuestion(result.current_question);
      setProfile(result.profile || {});
    } catch (err) {
      setError(err.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }, [answer]);

  const handleKeyDown = useCallback(
    (e) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        currentQuestion?.type !== "textarea" &&
        currentQuestion?.type !== "multi_select"
      ) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, currentQuestion?.type]
  );

  const Renderer = currentQuestion ? RENDERERS[currentQuestion.type] : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center px-4 py-12 transition-colors relative">
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white shadow-xs transition cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4.5 h-4.5 text-amber-400" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-primary-600" />
          )}
        </button>
      </div>

      <div className="mx-auto w-full max-w-lg space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white shadow-lg">
            <Leaf className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {isComplete ? "All Set!" : "Let's Personalize Your Plan"}
          </h1>
          {!isComplete && (
            <p className="text-gray-500 dark:text-slate-400 text-sm flex items-center justify-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              Dynamic AI-Driven Onboarding
            </p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8">
          {error && (
            <div
              className="mb-6 rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-500/30 p-4 text-sm text-danger-600 dark:text-danger-400 flex items-start gap-2.5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Starting your personalized onboarding…
              </p>
            </div>
          )}

          {!loading && isComplete && (
            <CompletionSummary
              question={currentQuestion}
              profile={profile}
              onContinue={() => navigate("/dashboard")}
            />
          )}

          {!loading && !isComplete && currentQuestion && (
            <div className="space-y-6" onKeyDown={handleKeyDown}>
              {questionsAnswered > 0 && (
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  <span>
                    {questionsAnswered} question{questionsAnswered !== 1 ? "s" : ""} answered
                  </span>
                </div>
              )}

              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 leading-relaxed">
                {currentQuestion.text}
              </h2>

              {Renderer ? (
                <Renderer
                  value={answer}
                  onChange={setAnswer}
                  options={currentQuestion.options}
                  placeholder={
                    currentQuestion.id === "need" || currentQuestion.field === "need"
                      ? "e.g., I want to build muscle on a budget, improve energy, eat high-protein vegetarian foods..."
                      : `Enter your ${currentQuestion.field?.replace(/_/g, " ") || "answer"}…`
                  }
                />
              ) : (
                <TextInput
                  value={answer}
                  onChange={setAnswer}
                  placeholder="Type your answer…"
                />
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !answer.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-600 hover:bg-primary-700 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-primary-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking…</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
