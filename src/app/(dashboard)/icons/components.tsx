"use client";

/**
 * Icon Management Components — Aligned with app_icons backend schema
 *
 * Schema: app_icons table with url, storagePath, version, etag, isActive, isPublished, isPending, defaultUrl
 * 
 * الأنواع المقبولة : SVG · PNG · WEBP · JPG  (حتى 2 MB)
 * التحقق: client-side قبل الإرسال، server-side في Backend API
 */

import { useRef, useState, useTransition } from "react";
import type { AppIcon } from "@/lib/icon-repository";
import {
  uploadIconAction,
  deleteIconAction,
  restoreToDefaultAction,
  publishPendingAction,
} from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// PublishButton — Publish all pending icons
// ─────────────────────────────────────────────────────────────────────────────

export function PublishButton({ pendingCount }: { pendingCount: number }) {
  const [isPublishing, startPublish] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handlePublish() {
    if (!confirm(`هل تريد نشر ${pendingCount} أيقونة؟\n\nسيتم نشر جميع التغييرات للمستخدمين فوراً.`)) {
      return;
    }

    setErrorMsg(null);

    startPublish(async () => {
      try {
        const result = await publishPendingAction();
        if (!result.success) {
          setErrorMsg(result.error);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "فشل النشر");
      }
    });
  }

  return (
    <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-warning">لديك {pendingCount} أيقونة قيد النشر</p>
          <p className="text-sm text-text-muted mt-1">
            You have {pendingCount} icon(s) waiting to be published
          </p>
        </div>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing}
          className="px-6 py-2.5 bg-warning text-base-bg font-bold rounded-xl hover:bg-warning/90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {isPublishing ? (
            <>
              <span className="w-4 h-4 border-2 border-base-bg border-t-transparent rounded-full animate-spin" />
              جارٍ النشر...
            </>
          ) : (
            <>نشر الآن / Publish Now</>
          )}
        </button>
      </div>
      {errorMsg && (
        <p
          role="alert"
          className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2 mt-3"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB (matches backend)

const ALLOWED_EXTENSIONS = /\.(svg|png|webp|jpg|jpeg)$/i;
const ALLOWED_MIME_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/webp",
  "image/jpeg",
  "image/jpg",
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IconSlot = {
  key: string;
  label: string;
  category: string;
  /** null = no DB record for this key yet */
  icon: AppIcon | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Client-side validation
// ─────────────────────────────────────────────────────────────────────────────

function validateFile(file: File): string | null {
  // 1. File size
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return `حجم الملف (${mb} MB) يتجاوز الحد المسموح (2 MB)`;
  }

  // 2. MIME type and extension
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.type);
  const extOk = ALLOWED_EXTENSIONS.test(file.name);

  if (!mimeOk && !extOk) {
    return "نوع الملف غير مدعوم. الأنواع المقبولة: SVG، PNG، WEBP، JPG";
  }

  return null; // valid
}

// ─────────────────────────────────────────────────────────────────────────────
// IconCard — single icon card
// ─────────────────────────────────────────────────────────────────────────────

function IconCard({ slot }: { slot: IconSlot }) {
  const { key, label, category, icon } = slot;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isRestoring, startRestore] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDeleted = icon ? !icon.isActive : false;
  const isCustom = icon ? (icon.url !== icon.defaultUrl) : false;
  const isPending = icon?.isPending ?? false;

  // Display URL: preview → custom icon → default icon → null
  const displaySrc = previewUrl ?? (isCustom && icon?.url ? icon.url : null);

  // ── File picker ──────────────────────────────────────────────

  function openFilePicker() {
    setErrorMsg(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // reset for re-selection
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
  }

  function clearPending() {
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setErrorMsg(null);
  }

  // ── Save ─────────────────────────────────────────────────────

  function handleSave() {
    if (!pendingFile) return;

    const validationError = validateFile(pendingFile);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setErrorMsg(null);

    startSave(async () => {
      try {
        const fd = new FormData();
        fd.append("key", key);
        fd.append("displayName", label);
        fd.append("category", category);
        fd.append("file", pendingFile, pendingFile.name);
        
        // Provide defaultUrl - use existing or create a placeholder
        const defaultUrl = icon?.defaultUrl || `https://via.placeholder.com/64?text=${encodeURIComponent(key)}`;
        fd.append("defaultUrl", defaultUrl);

        const result = await uploadIconAction(fd);

        if (!result.success) {
          setErrorMsg(result.error);
          return;
        }

        clearPending();
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "فشل الحفظ، حاول مرة أخرى"
        );
      }
    });
  }

  // ── Delete ───────────────────────────────────────────────────

  function handleDelete() {
    if (!icon) return;
    if (!confirm(`هل تريد حذف أيقونة "${label}"؟`)) return;
    setErrorMsg(null);

    startDelete(async () => {
      try {
        const fd = new FormData();
        fd.append("id", icon.id);
        const result = await deleteIconAction(fd);
        if (!result.success) setErrorMsg(result.error);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "فشل الحذف");
      }
    });
  }

  // ── Restore to Default ───────────────────────────────────────

  function handleRestore() {
    if (!icon) return;
    if (!confirm(`هل تريد استعادة الأيقونة الافتراضية لـ "${label}"؟`)) return;
    setErrorMsg(null);

    startRestore(async () => {
      try {
        const fd = new FormData();
        fd.append("id", icon.id);
        const result = await restoreToDefaultAction(fd);
        if (!result.success) setErrorMsg(result.error);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "فشل الاسترجاع");
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className={`bg-base-surface border rounded-2xl shadow-card p-5 flex flex-col gap-4 transition-opacity ${
        isDeleted ? "border-danger/30 opacity-60" : isPending ? "border-warning/50" : "border-base-border"
      }`}
    >
      {/* Icon name */}
      <div>
        <p className="font-display font-bold text-text-primary text-base leading-tight">
          {label}
        </p>
        <p className="text-xs font-mono text-text-muted mt-0.5" dir="ltr">
          {key}
        </p>
        <div className="flex gap-2 mt-1.5">
          {isDeleted && (
            <span className="inline-block text-xs text-danger border border-danger/30 bg-danger/5 rounded-full px-2 py-0.5">
              محذوف
            </span>
          )}
          {isPending && !isDeleted && (
            <span className="inline-block text-xs text-warning border border-warning/30 bg-warning/5 rounded-full px-2 py-0.5">
              قيد النشر
            </span>
          )}
          {isCustom && !isDeleted && !isPending && (
            <span className="inline-block text-xs text-success border border-success/30 bg-success/5 rounded-full px-2 py-0.5">
              مخصصة
            </span>
          )}
          {!isCustom && !isDeleted && !isPending && icon && (
            <span className="inline-block text-xs text-gold border border-gold/30 bg-gold/5 rounded-full px-2 py-0.5">
              افتراضية
            </span>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-base-border bg-base-surface2 flex items-center justify-center overflow-hidden">
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt={label}
              className="w-full h-full object-contain p-2"
            />
          ) : (
            <span className="text-text-muted/30 text-4xl select-none">◻</span>
          )}
        </div>

        {/* Empty state */}
        {!displaySrc && !isCustom && (
          <p className="text-xs text-text-muted/60 text-center">
            استخدام الأيقونة الافتراضية
          </p>
        )}

        {/* Preview badge */}
        {previewUrl && (
          <p className="text-xs text-gold font-medium">
            معاينة — لم يتم الحفظ بعد
          </p>
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <p
          role="alert"
          className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2 text-center"
        >
          {errorMsg}
        </p>
      )}

      {/* Action buttons */}
      {!isDeleted ? (
        <div className="flex flex-col gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Upload / Replace - ALWAYS SHOW THIS BUTTON */}
          {!pendingFile && (
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isSaving || isDeleting || isRestoring}
              className="w-full rounded-xl border-2 border-gold bg-gold/10 text-gold text-sm font-bold py-3 hover:bg-gold/20 hover:border-gold transition disabled:opacity-40"
            >
              {isCustom ? "استبدال الأيقونة / Replace Icon" : "رفع أيقونة مخصصة / Upload Icon"}
            </button>
          )}

          {/* Save */}
          {pendingFile && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-xl bg-gold text-base-bg font-bold text-sm py-2.5 hover:bg-gold/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-base-bg border-t-transparent rounded-full animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : (
                <>
                  حفظ / Save
                  <span className="text-xs opacity-70 font-normal">
                    ({(pendingFile.size / 1024).toFixed(0)} KB)
                  </span>
                </>
              )}
            </button>
          )}

          {/* Cancel preview */}
          {pendingFile && (
            <button
              type="button"
              onClick={clearPending}
              disabled={isSaving}
              className="w-full rounded-xl border border-base-border text-text-muted text-xs py-2 hover:border-danger/40 hover:text-danger transition disabled:opacity-40"
            >
              إلغاء المعاينة / Cancel
            </button>
          )}

          {/* Restore to default */}
          {isCustom && !pendingFile && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring}
              className="w-full rounded-xl border border-gold/30 text-gold text-xs py-2 bg-gold/5 hover:bg-gold/10 transition disabled:opacity-50"
            >
              {isRestoring ? "جارٍ الاسترجاع..." : "استعادة الافتراضية / Restore Default"}
            </button>
          )}

          {/* Delete */}
          {icon && !pendingFile && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full rounded-xl border border-danger/30 text-danger text-xs py-2 bg-danger/5 hover:bg-danger/10 transition disabled:opacity-50"
            >
              {isDeleting ? "جارٍ الحذف..." : "حذف / Delete"}
            </button>
          )}
        </div>
      ) : (
        /* Restore deleted icon */
        <button
          type="button"
          onClick={handleRestore}
          disabled={isRestoring}
          className="w-full rounded-xl border border-success/30 text-success text-sm py-2.5 bg-success/5 hover:bg-success/10 transition disabled:opacity-50"
        >
          {isRestoring ? "جارٍ الاسترجاع..." : "استرجاع / Restore"}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureSection — Section for a feature group of icons
// ─────────────────────────────────────────────────────────────────────────────

export function FeatureSection({
  feature,
  icons,
}: {
  feature: string;
  icons: IconSlot[];
}) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="border-b border-base-border pb-3">
        <h2 className="text-lg font-bold text-text-primary">{feature}</h2>
        <p className="text-sm text-text-muted mt-1">
          {icons.length} {icons.length === 1 ? "أيقونة" : "أيقونات"} / {icons.length} {icons.length === 1 ? "icon" : "icons"}
        </p>
      </div>

      {/* Icon Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {icons.map((slot) => (
          <IconCard key={slot.key} slot={slot} />
        ))}
      </div>
    </div>
  );
}
