/**
 * MealEvidenceUpload — inline component attached to each planned meal card.
 *
 * Responsibilities:
 * - Show "Upload Evidence" button when no evidence exists for this meal.
 * - Show an image picker with preview.
 * - Show upload progress.
 * - Show success (thumbnail + "Evidence Added" badge) after upload.
 * - Allow deletion of existing evidence.
 *
 * Props:
 *   date            {string}   - YYYY-MM-DD
 *   mealType        {string}   - "Breakfast" | "Lunch" | "Dinner"
 *   plannedMealName {string}   - Name of the planned meal (from daily plan)
 *   evidence        {object|null} - Existing evidence record (or null)
 *   onUploaded      {function} - Called with the new evidence record after upload
 *   onDeleted       {function} - Called after successful deletion
 */

import React, { useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImageOff,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteMealEvidence,
  uploadMealEvidence,
} from "../services/mealEvidenceService";

// Max file size shown in UI (must match server constant: 5 MB)
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function MealEvidenceUpload({
  date,
  mealType,
  plannedMealName = "",
  evidence = null,
  onUploaded,
  onDeleted,
}) {
  const fileInputRef = useRef(null);

  // Preview before upload
  const [previewSrc, setPreviewSrc] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [notes, setNotes] = useState("");

  // Upload flow state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  // Delete flow state
  const [deleting, setDeleting] = useState(false);

  // Panel open/close
  const [panelOpen, setPanelOpen] = useState(false);

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side MIME validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Only JPEG, PNG, WebP, or GIF images are accepted.`);
      return;
    }
    // Client-side size validation
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_SIZE_MB} MB.`);
      return;
    }

    setError("");
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewSrc(null);
    setNotes("");
    setError("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    setUploadProgress(0);
    try {
      const record = await uploadMealEvidence({
        date,
        meal_type: mealType,
        planned_meal_name: plannedMealName,
        notes,
        imageFile: selectedFile,
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
      });
      clearSelection();
      setPanelOpen(false);
      onUploaded?.(record);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!evidence?.id) return;
    if (!window.confirm("Remove this evidence photo?")) return;
    setDeleting(true);
    setError("");
    try {
      await deleteMealEvidence(evidence.id);
      onDeleted?.();
    } catch (err) {
      setError(err.message || "Failed to delete evidence.");
    } finally {
      setDeleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render: existing evidence (thumbnail + status badge)
  // -------------------------------------------------------------------------
  if (evidence?.image_data_uri) {
    return (
      <div className="mt-2.5 space-y-2">
        {/* Success badge */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Evidence Added</span>
        </div>

        {/* Thumbnail */}
        <div className="relative group w-fit">
          <img
            src={evidence.image_data_uri}
            alt={`${mealType} evidence`}
            className="w-20 h-20 object-cover rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 shadow-xs cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(evidence.image_data_uri, "_blank")}
            title="Click to view full image"
          />
          {/* Delete overlay on hover */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-danger-700 disabled:opacity-40 cursor-pointer shadow-xs"
            title="Remove evidence"
          >
            {deleting ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <X className="w-2.5 h-2.5" />
            )}
          </button>
        </div>

        {evidence.notes && (
          <p className="text-[10px] italic text-gray-400 dark:text-slate-500">
            "{evidence.notes}"
          </p>
        )}
        {error && (
          <p className="text-[10px] text-danger-600 dark:text-danger-400">{error}</p>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: upload panel (picker + preview + progress)
  // -------------------------------------------------------------------------
  if (panelOpen) {
    return (
      <div className="mt-2.5 space-y-2.5 p-3 bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 animate-in fade-in duration-150">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-primary-600" />
            Upload Meal Photo
          </span>
          <button
            onClick={() => { clearSelection(); setPanelOpen(false); }}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* File picker area */}
        {!previewSrc ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition cursor-pointer group"
          >
            <ImageOff className="w-6 h-6 group-hover:text-primary-500 transition" />
            <span className="text-[11px] font-medium group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
              Click to select photo
            </span>
            <span className="text-[10px]">JPEG, PNG, WebP, GIF • max {MAX_SIZE_MB} MB</span>
          </button>
        ) : (
          /* Preview */
          <div className="relative">
            <img
              src={previewSrc}
              alt="Preview"
              className="w-full h-36 object-cover rounded-xl border border-gray-200 dark:border-slate-700 shadow-xs"
            />
            <button
              type="button"
              onClick={clearSelection}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hidden native input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Optional note */}
        {previewSrc && (
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note (optional)"
            maxLength={200}
            className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        )}

        {/* Upload progress bar */}
        {uploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400">
              <span>Uploading…</span>
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
        {error && (
          <p className="text-[10px] text-danger-600 dark:text-danger-400 flex items-center gap-1">
            <X className="w-3 h-3 shrink-0" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { clearSelection(); setPanelOpen(false); }}
            className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-40 cursor-pointer shadow-xs"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: default "Upload Evidence" trigger button
  // -------------------------------------------------------------------------
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 rounded-xl transition cursor-pointer"
        title={`Upload a photo of your prepared ${mealType}`}
      >
        <Camera className="w-3.5 h-3.5" />
        Upload Evidence
      </button>
    </div>
  );
}
