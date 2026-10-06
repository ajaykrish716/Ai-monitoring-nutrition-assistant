/**
 * MealDetailModal — full-screen modal for a single planned meal.
 *
 * Shows:
 *  • Meal name, type, recommended time
 *  • AI recommendation rationale (from meal.notes / plan.summary)
 *  • Full nutrition breakdown (macro + micro where available)
 *  • Food items & portion information
 *  • Mandatory photo upload before "Complete Meal"
 *  • Three evidence states: PENDING → PHOTO_SELECTED → COMPLETED
 *
 * Props:
 *   meal         {object|null}  - MealItem from daily plan
 *   plan         {object|null}  - Full DailyPlanResponse (for daily_targets & summary)
 *   date         {string}       - YYYY-MM-DD
 *   evidence     {object|null}  - Existing MealEvidenceItem (or null)
 *   onClose      {function}     - Close modal
 *   onUploaded   {function}     - (mealType, record) => void — after successful upload
 *   onDeleted    {function}     - (mealType) => void — after evidence deleted
 */

import React, { useRef, useState } from "react";
import {
  X,
  Clock,
  Sparkles,
  Utensils,
  Camera,
  CheckCircle2,
  ImageOff,
  Loader2,
  AlertCircle,
  Info,
  Flame,
  Zap,
  Wheat,
  Droplet,
  Leaf,
} from "lucide-react";
import {
  uploadMealEvidence,
  deleteMealEvidence,
} from "../services/mealEvidenceService";

// ─── constants ───────────────────────────────────────────────────────────────
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MEAL_ICONS = { Breakfast: "🍳", Lunch: "🍛", Dinner: "🍽️" };

// ─── Nutrition card ───────────────────────────────────────────────────────────
function NutrientCard({ icon: Icon, label, value, unit, colorClass }) {
  if (value === undefined || value === null || value === 0) return null;
  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center gap-1 ${colorClass}`}
    >
      <Icon className="w-4 h-4 opacity-70 shrink-0" />
      <span className="text-lg font-black leading-none">
        {typeof value === "number" ? Math.round(value) : value}
        <span className="text-xs font-semibold ml-0.5 opacity-70">{unit}</span>
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
        {label}
      </span>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatTime12h(timeStr) {
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
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MealDetailModal({
  meal,
  plan,
  date,
  evidence,
  onClose,
  onUploaded,
  onDeleted,
}) {
  // ── upload state ──────────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // ── delete state ──────────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false);

  // ── derived ───────────────────────────────────────────────────────────────
  const mealType = meal?.meal_type || "Meal";
  const mealName = meal?.name || `Planned ${mealType}`;
  const icon = MEAL_ICONS[mealType] || "🍽️";
  const nutrition = meal?.nutrition || {};
  const foods = meal?.foods || [];
  const portion = meal?.portion_information || "";
  const aiNotes = meal?.notes || "";
  const planSummary = plan?.summary || "";
  const windowStart = meal?.window_start || null;
  const windowEnd = meal?.window_end || null;

  const isCompleted = !!evidence?.image_data_uri;
  const evidenceState = isCompleted
    ? "COMPLETED"
    : selectedFile
    ? "PHOTO_SELECTED"
    : "PENDING";

  // ── file selection ─────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Only JPEG, PNG, WebP, or GIF images are accepted.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`Image must be smaller than ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploadError("");
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewSrc(null);
    setNotes("");
    setUploadError("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError("");
    setUploadProgress(0);
    try {
      const record = await uploadMealEvidence({
        date,
        meal_type: mealType,
        planned_meal_name: mealName,
        notes,
        imageFile: selectedFile,
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
      });
      clearSelection();
      onUploaded?.(mealType, record);
    } catch (err) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!evidence?.id) return;
    if (!window.confirm("Remove this evidence photo?")) return;
    setDeleting(true);
    setUploadError("");
    try {
      await deleteMealEvidence(evidence.id);
      onDeleted?.(mealType);
    } catch (err) {
      setUploadError(err.message || "Failed to delete evidence.");
    } finally {
      setDeleting(false);
    }
  };

  const hasNutrition =
    nutrition.calories || nutrition.protein || nutrition.carbohydrates || nutrition.fat;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-950/60 dark:to-primary-900/40 flex items-center justify-center text-2xl shrink-0 border border-primary-200 dark:border-primary-800 shadow-xs">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[11px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400">
                  {mealType}
                </span>
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">
                  AI Recommended Meal
                </span>
                {/* State badge */}
                {evidenceState === "COMPLETED" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Completed
                  </span>
                )}
                {evidenceState === "PHOTO_SELECTED" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Camera className="w-2.5 h-2.5" />
                    Evidence Ready
                  </span>
                )}
                {evidenceState === "PENDING" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                    <Clock className="w-2.5 h-2.5" />
                    Pending
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                {mealName}
              </h2>
              {(windowStart || windowEnd) && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Recommended Time:{" "}
                    {windowStart ? formatTime12h(windowStart) : ""}
                    {windowStart && windowEnd ? " – " : ""}
                    {windowEnd ? formatTime12h(windowEnd) : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto nutri-chat-scroll p-5 space-y-5">

          {/* AI Recommendation Rationale ──────────────────────────────────── */}
          {(aiNotes || planSummary) && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-50 to-emerald-50 dark:from-primary-950/40 dark:to-emerald-950/20 border border-primary-200/70 dark:border-primary-800/50">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-primary-700 dark:text-primary-400">
                  Why this meal was recommended
                </span>
              </div>
              {aiNotes && (
                <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                  {aiNotes}
                </p>
              )}
              {planSummary && aiNotes !== planSummary && (
                <p className="text-xs text-gray-500 dark:text-slate-400 italic mt-1.5 leading-relaxed border-t border-primary-200/50 dark:border-primary-800/30 pt-1.5">
                  Today's plan overview: {planSummary}
                </p>
              )}
            </div>
          )}

          {/* Macro Nutrition Grid ─────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Nutrition Information
            </h3>

            {hasNutrition ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <NutrientCard
                    icon={Flame}
                    label="Calories"
                    value={nutrition.calories}
                    unit="kcal"
                    colorClass="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50 text-orange-900 dark:text-orange-200"
                  />
                  <NutrientCard
                    icon={Zap}
                    label="Protein"
                    value={nutrition.protein}
                    unit="g"
                    colorClass="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-900 dark:text-blue-200"
                  />
                  <NutrientCard
                    icon={Wheat}
                    label="Carbs"
                    value={nutrition.carbohydrates}
                    unit="g"
                    colorClass="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
                  />
                  <NutrientCard
                    icon={Droplet}
                    label="Fat"
                    value={nutrition.fat}
                    unit="g"
                    colorClass="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50 text-purple-900 dark:text-purple-200"
                  />
                </div>
                {/* Fiber row if available */}
                {nutrition.fiber != null && nutrition.fiber > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
                    <NutrientCard
                      icon={Leaf}
                      label="Fiber"
                      value={nutrition.fiber}
                      unit="g"
                      colorClass="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
                    />
                  </div>
                )}
                {/* Micronutrient note */}
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  Micronutrient data (vitamins, minerals) is not individually tracked — all values come from the AI-generated plan.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Nutrition data for this meal is not yet available. Ask Nutri
                  to regenerate today's plan for fresh nutritional data.
                </span>
              </div>
            )}
          </div>

          {/* Food Items & Portions ────────────────────────────────────────── */}
          {(foods.length > 0 || portion) && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5" />
                Food Details
              </h3>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 space-y-3">
                {portion && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 block mb-1">
                      Portion Information
                    </span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 leading-snug">
                      {portion}
                    </p>
                  </div>
                )}
                {foods.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 block mb-1.5">
                      Ingredients / Food Items
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {foods.map((food, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 shadow-2xs"
                        >
                          {food}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MEAL EVIDENCE SECTION ──────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              Meal Evidence
              <span className="text-[10px] text-rose-500 dark:text-rose-400 font-black ml-1">
                * required to complete
              </span>
            </h3>

            {/* ── COMPLETED state ── */}
            {isCompleted ? (
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Evidence Uploaded · Meal Recorded</span>
                </div>
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="relative group shrink-0">
                    <img
                      src={evidence.image_data_uri}
                      alt={`${mealType} evidence`}
                      className="w-24 h-24 object-cover rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 shadow-sm cursor-pointer hover:opacity-90 transition"
                      onClick={() =>
                        window.open(evidence.image_data_uri, "_blank")
                      }
                      title="Click to view full image"
                    />
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-rose-700 disabled:opacity-40 cursor-pointer shadow-xs"
                      title="Remove evidence"
                    >
                      {deleting ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <X className="w-2.5 h-2.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    {evidence.uploaded_at && (
                      <p className="text-gray-500 dark:text-slate-400">
                        Uploaded:{" "}
                        {new Date(evidence.uploaded_at).toLocaleString()}
                      </p>
                    )}
                    {evidence.image_filename && (
                      <p className="text-gray-400 dark:text-slate-500 truncate">
                        File: {evidence.image_filename}
                      </p>
                    )}
                    {evidence.notes && (
                      <p className="italic text-gray-500 dark:text-slate-400">
                        "{evidence.notes}"
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed pt-1">
                      This photo is stored as personal meal evidence only. It
                      does not claim the meal was consumed.
                    </p>
                  </div>
                </div>
                {uploadError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {uploadError}
                  </p>
                )}
              </div>
            ) : (
              /* ── PENDING / PHOTO_SELECTED state ── */
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 space-y-3">
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  📸 Upload a photo of your prepared meal as evidence. The
                  "Submit Meal Evidence" button stays disabled until a photo is
                  selected.
                </p>

                {/* File picker */}
                {!previewSrc ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-28 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/60 dark:hover:bg-primary-950/30 transition cursor-pointer group"
                  >
                    <ImageOff className="w-7 h-7 group-hover:text-primary-500 transition" />
                    <span className="text-xs font-semibold group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
                      📸 Choose Photo / Take Photo
                    </span>
                    <span className="text-[10px]">
                      JPEG, PNG, WebP, GIF · max {MAX_SIZE_MB} MB
                    </span>
                  </button>
                ) : (
                  /* Preview */
                  <div className="relative">
                    <img
                      src={previewSrc}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-2xl border border-gray-200 dark:border-slate-700 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                      ✓ Photo selected
                    </div>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Optional note (after photo selected) */}
                {previewSrc && (
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note (optional)"
                    maxLength={200}
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                )}

                {/* Upload progress */}
                {uploading && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400">
                      <span>Uploading evidence…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {uploadError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {uploadError}
                  </p>
                )}

                {/* Status checklist */}
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold pt-1">
                  <span
                    className={`flex items-center gap-1 ${
                      selectedFile
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-400 dark:text-slate-500"
                    }`}
                  >
                    {selectedFile ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-slate-600" />
                    )}
                    Photo selected
                  </span>
                  <span className="flex items-center gap-1 text-gray-400 dark:text-slate-500">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-slate-600" />
                    Evidence uploaded
                  </span>
                  <span className="flex items-center gap-1 text-gray-400 dark:text-slate-500">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-slate-600" />
                    Meal completed
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky Footer ─────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Close
          </button>

          {!isCompleted && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading…
                </>
              ) : !selectedFile ? (
                <>
                  <Camera className="w-4 h-4" />
                  Upload Photo to Complete
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Meal Evidence
                </>
              )}
            </button>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              ✅ Meal Completed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
