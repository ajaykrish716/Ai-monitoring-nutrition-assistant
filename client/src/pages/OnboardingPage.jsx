/**
 * Onboarding Page — generic renderer for AI-driven questions.
 *
 * This component renders whatever the backend sends. It has NO
 * knowledge of specific questions, fields, or options. The UI
 * control is determined entirely by the `type` field from the API.
 *
 * Supported types (extensible without code changes):
 *   - text         → single-line text input
 *   - number       → numeric input
 *   - textarea     → multi-line text input
 *   - single_select → radio buttons from AI-provided options
 *   - multi_select  → checkboxes from AI-provided options
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
} from "lucide-react";

import { startOnboarding, submitAnswer } from "../services/onboardingService";

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
      className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
      className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
      className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none"
      autoFocus
    />
  );
}

function SingleSelect({ value, onChange, options, name = "onboarding_single_select" }) {
  return (
    <div className="space-y-2 select-none" role="radiogroup">
      {(options || []).map((opt, index) => {
        const optValue = typeof opt === "object" && opt !== null
          ? String(opt.value ?? opt.id ?? opt.label ?? opt.text ?? index)
          : String(opt);
        const optLabel = typeof opt === "object" && opt !== null
          ? String(opt.label ?? opt.text ?? opt.value ?? opt.id ?? optValue)
          : String(opt);
        const isSelected = value === optValue;

        return (
          <label
            key={optValue + "-" + index}
            onClick={() => onChange(optValue)}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition select-none ${
              isSelected
                ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500/30"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
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
                isSelected ? "border-primary-500" : "border-gray-300"
              }`}
            >
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-primary-500" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-800 select-none">{optLabel}</span>
          </label>
        );
      })}
    </div>
  );
}

function MultiSelect({ value, onChange, options, name = "onboarding_multi_select" }) {
  // value is a Set stored as comma-separated string; we manage as array internally
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
        const optValue = typeof opt === "object" && opt !== null
          ? String(opt.value ?? opt.id ?? opt.label ?? opt.text ?? index)
          : String(opt);
        const optLabel = typeof opt === "object" && opt !== null
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
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition select-none ${
              isSelected
                ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500/30"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
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
              className={`w-4.5 h-4.5 rounded flex items-center justify-center border-2 shrink-0 transition ${
                isSelected ? "border-primary-500 bg-primary-500" : "border-gray-300"
              }`}
            >
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium text-gray-800 select-none">{optLabel}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Registry of renderers. The key is the `type` from the API response.
 * Add new types here without modifying any other code.
 */
const RENDERERS = {
  text: TextInput,
  number: NumberInput,
  textarea: TextareaInput,
  single_select: SingleSelect,
  multi_select: MultiSelect,
};

/* ------------------------------------------------------------------ */
/* Completion summary — renders the dynamic profile dict               */
/* ------------------------------------------------------------------ */

function CompletionSummary({ question, profile, onContinue }) {
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-2">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {question?.text || "Onboarding Complete!"}
        </h2>
        <p className="text-sm text-gray-500">
          Here's what we learned about you
        </p>
      </div>

      {profile && Object.keys(profile).length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-left space-y-3">
          {Object.entries(profile).map(([key, val]) => (
            <div key={key} className="flex justify-between items-start gap-4">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide min-w-[100px]">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-sm text-gray-800 text-right">
                {typeof val === "object" ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onContinue}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
      >
        Go to Dashboard
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

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [profile, setProfile] = useState({});

  // Start or resume onboarding
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

        if (state.is_complete) {
          // Already complete — could redirect
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to start onboarding.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
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
      // Submit on Enter (not for textarea or multi_select)
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

  // Determine which renderer to use
  const Renderer = currentQuestion ? RENDERERS[currentQuestion.type] : null;

  return (
    <div className="min-h-dvh bg-gradient-to-br from-primary-50 via-white to-primary-100 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white mb-4 shadow-lg">
            <Leaf className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isComplete ? "All Set!" : "Let's Get to Know You"}
          </h1>
          {!isComplete && (
            <p className="text-gray-500 mt-1 text-sm flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI-powered personalization
            </p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg bg-danger-50 border border-danger-500/30 px-4 py-3 text-sm text-danger-600 flex items-start gap-2" role="alert">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <p className="text-sm text-gray-500">Starting your personalized onboarding…</p>
            </div>
          )}

          {/* Completion */}
          {!loading && isComplete && (
            <CompletionSummary
              question={currentQuestion}
              profile={profile}
              onContinue={() => navigate("/dashboard")}
            />
          )}

          {/* Active question */}
          {!loading && !isComplete && currentQuestion && (
            <div className="space-y-6" onKeyDown={handleKeyDown}>
              {/* Progress indicator */}
              {questionsAnswered > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{questionsAnswered} question{questionsAnswered !== 1 ? "s" : ""} answered</span>
                </div>
              )}

              {/* Question text */}
              <h2 className="text-lg font-semibold text-gray-800 leading-relaxed">
                {currentQuestion.text}
              </h2>

              {/* Dynamic renderer */}
              {Renderer ? (
                <Renderer
                  value={answer}
                  onChange={setAnswer}
                  options={currentQuestion.options}
                  placeholder={`Enter your ${currentQuestion.field?.replace(/_/g, " ") || "answer"}…`}
                />
              ) : (
                // Fallback for unknown types — render as text input
                <TextInput
                  value={answer}
                  onChange={setAnswer}
                  placeholder="Type your answer…"
                />
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !answer.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking…
                  </>
                ) : (
                  <>
                    Continue
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
