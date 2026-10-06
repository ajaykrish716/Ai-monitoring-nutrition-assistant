/**
 * ProgressReportCard — Displays the Nutrition Progress Report section inside Analytics.
 *
 * Adapts its UI based on plan state:
 *   - No plan: friendly empty state
 *   - Active plan: "Current Progress Report" with view/download
 *   - Completed plan: "Final Report Ready" banner + view/download
 *
 * Does NOT redesign or remove any existing Analytics content.
 * Fits into the existing Tailwind design system (light + dark mode).
 */

import { useState } from "react";
import {
  FileText,
  Eye,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trophy,
  Info,
} from "lucide-react";
import { viewProgressReport, downloadProgressReport } from "../services/progressReportService";

export default function ProgressReportCard({ planData }) {
  const [viewLoading, setViewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Plan state detection ───────────────────────────────────────────────────
  const hasPlan = planData?.has_active_plan;
  const isComplete = planData?.is_plan_complete;
  const completedDays = planData?.completed_days ?? 0;
  const durationDays = planData?.duration_days ?? 0;
  const completionPct = planData?.completion_percentage ?? 0;
  const startDate = planData?.start_date ?? "";
  const endDate = planData?.end_date ?? "";

  const fmtDate = (str) => {
    if (!str) return "—";
    try {
      return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (_) {
      return str;
    }
  };

  const handleView = async () => {
    try {
      setViewLoading(true);
      setError("");
      await viewProgressReport();
    } catch (err) {
      setError(err.message || "Failed to open report. Please try again.");
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloadLoading(true);
      setError("");
      await downloadProgressReport();
    } catch (err) {
      setError(err.message || "Failed to download report. Please try again.");
    } finally {
      setDownloadLoading(false);
    }
  };

  // ── No plan ────────────────────────────────────────────────────────────────
  if (!hasPlan) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
            Nutrition Progress Report
          </h3>
        </div>
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-dashed border-gray-300 dark:border-slate-700">
          <Info className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            No nutrition plan is available yet. Complete your onboarding and initialize
            a plan to generate your personalized progress report.
          </p>
        </div>
      </div>
    );
  }

  // ── Completed plan ─────────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-300 dark:border-emerald-800/60 p-6 shadow-xs ring-1 ring-emerald-200/60 dark:ring-emerald-800/30">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
              🎉 Final Report Ready
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Your nutrition plan has been completed
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <_StatBox label="Duration" value={`${durationDays} Days`} color="emerald" />
          <_StatBox label="Completed" value={`${completedDays} / ${durationDays}`} color="primary" />
          <_StatBox label="Adherence" value={`${completionPct}%`} color="amber" />
        </div>

        {/* Dates */}
        <div className="text-xs text-gray-500 dark:text-slate-400 mb-4 space-y-1">
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 dark:text-slate-300 w-20">Started:</span>
            <span>{fmtDate(startDate)}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 dark:text-slate-300 w-20">Ended:</span>
            <span>{fmtDate(endDate)}</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-slate-300 mb-4 leading-relaxed">
          Your personalized {durationDays}-day nutrition progress report is ready.
          It contains your profile, calendar, meal adherence, nutrition data, achievements, and an AI summary.
        </p>

        {/* Buttons */}
        <_ReportButtons
          onView={handleView}
          onDownload={handleDownload}
          viewLoading={viewLoading}
          downloadLoading={downloadLoading}
          viewLabel="View Final Report"
          downloadLabel="Download Final Report"
        />

        {error && <_ErrorMsg message={error} onDismiss={() => setError("")} />}
      </div>
    );
  }

  // ── Active plan ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-950/60 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
            📄 Progress Report
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
            <Clock className="w-3 h-3" />
            Plan in progress
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <_StatBox label="Duration" value={`${durationDays} Days`} color="gray" />
        <_StatBox label="Progress" value={`${completedDays} / ${durationDays}`} color="primary" />
        <_StatBox label="Adherence" value={`${completionPct}%`} color="sky" />
      </div>

      {/* Dates */}
      <div className="text-xs text-gray-500 dark:text-slate-400 mb-4 space-y-1">
        <div className="flex gap-2">
          <span className="font-semibold text-gray-700 dark:text-slate-300 w-20">Started:</span>
          <span>{fmtDate(startDate)}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-semibold text-gray-700 dark:text-slate-300 w-20">Ends:</span>
          <span>{fmtDate(endDate)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 leading-relaxed">
        Generate a current progress snapshot. Your report will include all data logged so far,
        including the plan calendar, meal adherence, nutrition stats, and streaks.
        {completedDays === 0 && (
          <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
            Some sections may have limited data since no days have been completed yet.
          </span>
        )}
      </p>

      {/* Buttons */}
      <_ReportButtons
        onView={handleView}
        onDownload={handleDownload}
        viewLoading={viewLoading}
        downloadLoading={downloadLoading}
        viewLabel="View Current Report"
        downloadLabel="Download Current Report"
      />

      {error && <_ErrorMsg message={error} onDismiss={() => setError("")} />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function _StatBox({ label, value, color }) {
  const colorMap = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300",
    primary: "bg-primary-50 dark:bg-primary-950/40 border-primary-200 dark:border-primary-800/40 text-primary-700 dark:text-primary-300",
    amber: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300",
    sky: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40 text-sky-700 dark:text-sky-300",
    gray: "bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300",
  };

  return (
    <div className={`rounded-2xl border p-3 text-center ${colorMap[color] || colorMap.gray}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">{label}</p>
      <p className="text-base font-black leading-tight">{value}</p>
    </div>
  );
}

function _ReportButtons({ onView, onDownload, viewLoading, downloadLoading, viewLabel, downloadLabel }) {
  const anyLoading = viewLoading || downloadLoading;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        type="button"
        onClick={onView}
        disabled={anyLoading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
      >
        {viewLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
        ) : (
          <><Eye className="w-4 h-4" />{viewLabel}</>
        )}
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={anyLoading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-slate-200 text-sm font-bold rounded-xl border border-gray-300 dark:border-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
      >
        {downloadLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Downloading…</>
        ) : (
          <><Download className="w-4 h-4" />{downloadLabel}</>
        )}
      </button>
    </div>
  );
}

function _ErrorMsg({ message, onDismiss }) {
  return (
    <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-700 dark:text-rose-300">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{message}</span>
      <button
        onClick={onDismiss}
        className="font-bold hover:text-rose-900 dark:hover:text-rose-100 shrink-0"
      >
        ×
      </button>
    </div>
  );
}
