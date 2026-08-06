"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import type { Icon, IconVersion, IconAuditLog } from "@prisma/client";
import {
  createIconAction,
  updateIconAction,
  deleteIconAction,
  restoreIconAction,
  setEnabledAction,
  rollbackIconAction,
  invalidateCacheAction,
  bulkUploadAction,
  seedDefaultIconsAction,
} from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function SubmitBtn({
  children,
  variant = "gold",
  title,
}: {
  children: React.ReactNode;
  variant?: "gold" | "danger" | "success" | "neutral" | "info";
  title?: string;
}) {
  const { pending } = useFormStatus();
  const cls: Record<string, string> = {
    gold:    "bg-gold text-base-bg font-bold hover:bg-gold/90",
    danger:  "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
    success: "bg-success/10 text-success border border-success/30 hover:bg-success/20",
    neutral: "bg-base-surface2 text-text-primary border border-base-border hover:border-gold/40",
    info:    "bg-info/10 text-info border border-info/30 hover:bg-info/20",
  };
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      className={`text-xs rounded-lg px-3 py-1.5 transition disabled:opacity-50 ${cls[variant] ?? cls.gold}`}
    >
      {pending ? (
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          جارٍ...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// File preview hook
function useFilePreview() {
  const [preview, setPreview] = useState<string | null>(null);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) { setPreview(null); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }
  return { preview, onFile, clear: () => setPreview(null) };
}

// Icon preview box
function PreviewBox({ src, label }: { src?: string | null; label: string }) {
  if (!src) return null;
  return (
    <div className="flex flex-col items-center gap-1 mt-1">
      <p className="text-xs text-text-muted">{label}</p>
      <div className="w-14 h-14 rounded-lg border border-base-border bg-base-surface2 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
}

// Shared file input row
function FileInput({
  name,
  accept,
  label,
  currentUrl,
  onChange,
  preview,
}: {
  name: string;
  accept: string;
  label: string;
  currentUrl?: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  preview: string | null;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-text-muted">{label}</label>
      <input
        name={name}
        type="file"
        accept={accept}
        onChange={onChange}
        className="w-full text-xs text-text-muted file:mr-2 file:rounded file:border-0 file:bg-base-surface2 file:px-2 file:py-1 file:text-text-primary cursor-pointer"
      />
      <div className="flex gap-3">
        {currentUrl && <PreviewBox src={currentUrl} label="الحالي" />}
        {preview    && <PreviewBox src={preview}    label="الجديد" />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create icon form
// ─────────────────────────────────────────────────────────────────────────────

export function CreateIconForm({ categories }: { categories: Record<string, string> }) {
  const svg = useFilePreview();
  const png = useFilePreview();

  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-5 max-w-2xl">
      <h3 className="font-display font-bold text-text-primary text-lg">إضافة أيقونة جديدة</h3>
      <form action={createIconAction} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted" htmlFor="create-key">المفتاح (key) *</label>
            <input id="create-key" name="key" required dir="ltr" placeholder="nav.home"
              pattern="[a-z0-9_.]+"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
            <p className="text-xs text-text-muted/70">أحرف صغيرة، أرقام، نقطة، شرطة سفلية فقط</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted" htmlFor="create-name">الاسم المعروض *</label>
            <input id="create-name" name="displayName" required placeholder="الرئيسية"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted" htmlFor="create-cat">التصنيف *</label>
            <select id="create-cat" name="category" required
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold/60">
              {Object.entries(categories).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted" htmlFor="create-type">نوع الملف</label>
            <select id="create-type" name="type"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold/60">
              <option value="svg">SVG فقط</option>
              <option value="png">PNG فقط</option>
              <option value="both">SVG + PNG</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <FileInput name="svg" accept=".svg,image/svg+xml" label="ملف SVG"
            onChange={svg.onFile} preview={svg.preview} />
          <FileInput name="png" accept=".png,image/png"    label="ملف PNG"
            onChange={png.onFile} preview={png.preview} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-text-muted" htmlFor="create-note">ملاحظة التغيير (اختياري)</label>
          <input id="create-note" name="changeNote" maxLength={300}
            placeholder="سبب الإضافة..."
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
        </div>
        <SubmitBtn>حفظ الأيقونة</SubmitBtn>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit icon inline form
// ─────────────────────────────────────────────────────────────────────────────

function EditIconForm({
  icon,
  categories,
  onClose,
}: {
  icon: Icon;
  categories: Record<string, string>;
  onClose: () => void;
}) {
  const svg = useFilePreview();
  const png = useFilePreview();
  return (
    <form
      action={updateIconAction}
      className="space-y-3 mt-3 p-4 bg-base-bg border border-gold/20 rounded-xl"
    >
      <input type="hidden" name="id" value={icon.id} />
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-muted">الاسم المعروض</label>
          <input name="displayName" defaultValue={icon.displayName}
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 focus:outline-none focus:border-gold/60" />
        </div>
        <div>
          <label className="text-xs text-text-muted">التصنيف</label>
          <select name="category" defaultValue={icon.category}
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 focus:outline-none focus:border-gold/60">
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted">نوع الملف</label>
          <select name="type" defaultValue={icon.type}
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 focus:outline-none focus:border-gold/60">
            <option value="svg">SVG</option>
            <option value="png">PNG</option>
            <option value="both">SVG + PNG</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted">ملاحظة التغيير</label>
          <input name="changeNote" maxLength={300} placeholder="سبب التعديل..."
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <FileInput name="svg" accept=".svg,image/svg+xml" label="استبدال SVG"
          currentUrl={icon.svgUrl} onChange={svg.onFile} preview={svg.preview} />
        <FileInput name="png" accept=".png,image/png" label="استبدال PNG"
          currentUrl={icon.pngUrl} onChange={png.onFile} preview={png.preview} />
      </div>
      <div className="flex gap-2 pt-1">
        <SubmitBtn>حفظ التعديلات</SubmitBtn>
        <button type="button" onClick={onClose}
          className="text-xs rounded-lg px-3 py-1.5 bg-base-surface2 text-text-muted border border-base-border hover:border-gold/40 transition">
          إلغاء
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Version history panel
// ─────────────────────────────────────────────────────────────────────────────

function VersionHistory({
  iconId,
  versions,
  currentVersion,
}: {
  iconId: string;
  versions: IconVersion[];
  currentVersion: number;
}) {
  if (versions.length === 0) {
    return (
      <p className="text-xs text-text-muted py-2 px-1">
        لا يوجد تاريخ إصدارات لهذه الأيقونة بعد
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-1 max-h-56 overflow-y-auto pr-1">
      <p className="text-xs font-semibold text-text-muted mb-2">
        تاريخ الإصدارات — الحالي:
        <span className="text-gold font-mono ml-1">v{currentVersion}</span>
      </p>
      {versions.map((v) => (
        <div
          key={v.id}
          className={`flex items-center justify-between text-xs p-2 rounded-lg border ${
            v.version === currentVersion
              ? "border-gold/30 bg-gold/5"
              : "border-base-border/60 bg-base-bg"
          }`}
        >
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
            <span className="text-gold font-mono font-semibold">v{v.version}</span>
            <span className="text-text-muted">
              {new Date(v.createdAt).toLocaleString("ar-EG", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            {v.updatedByName && (
              <span className="text-text-muted/70">بواسطة: {v.updatedByName}</span>
            )}
            {v.changeNote && (
              <span className="text-text-muted/70 italic">"{v.changeNote}"</span>
            )}
            <div className="flex gap-1 mt-0.5">
              {v.svgUrl && (
                <a href={v.svgUrl} target="_blank" rel="noreferrer"
                  className="text-info hover:underline text-xs">SVG ↗</a>
              )}
              {v.pngUrl && (
                <a href={v.pngUrl} target="_blank" rel="noreferrer"
                  className="text-info hover:underline text-xs">PNG ↗</a>
              )}
            </div>
          </div>
          {v.version !== currentVersion && (
            <form action={rollbackIconAction}>
              <input type="hidden" name="id" value={iconId} />
              <input type="hidden" name="targetVersion" value={v.version} />
              <SubmitBtn variant="neutral">استرجاع</SubmitBtn>
            </form>
          )}
          {v.version === currentVersion && (
            <span className="text-xs text-gold/60 font-mono">حالي</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category stats grid
// ─────────────────────────────────────────────────────────────────────────────

export function CategoryStatsGrid({
  stats,
  categories,
}: {
  stats: { category: string; total: number; enabled: number; withFile: number }[];
  categories: Record<string, string>;
}) {
  return (
    <details className="group">
      <summary className="text-xs text-text-muted cursor-pointer hover:text-text-primary list-none flex items-center gap-1 select-none mb-2">
        <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
        إحصائيات التصنيفات ({stats.length} تصنيف)
      </summary>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pb-2">
        {stats.map((s) => (
          <div
            key={s.category}
            className="bg-base-surface2 border border-base-border rounded-xl p-3 text-xs"
          >
            <p className="text-text-muted truncate mb-1">
              {categories[s.category] ?? s.category}
            </p>
            <div className="flex gap-2 font-mono">
              <span className="text-text-primary">{s.total}</span>
              <span className="text-success">{s.enabled} نشط</span>
              <span className={s.withFile < s.total ? "text-danger" : "text-success"}>
                {s.withFile} ملف
              </span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single icon row
// ─────────────────────────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  bottom_nav: "شريط التنقل", vip_svip: "VIP/SVIP", live_rooms: "الغرف الحية",
  chat: "الدردشة", gifts: "الهدايا", social: "الاجتماعيات", economy: "الاقتصاد",
  profile: "الملف الشخصي", badges: "الشارات", states: "حالات الواجهة",
  dialogs: "مربعات الحوار", buttons: "الأزرار", toolbar: "شريط الأدوات",
  drawer: "القائمة الجانبية", agency: "الوكالات", store: "المتجر",
  leaderboard: "المتصدرون",
};

function IconRow({ icon, versions }: { icon: Icon; versions?: IconVersion[] }) {
  const [expanded,     setExpanded]     = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const isDeleted = !!icon.deletedAt;
  const hasFile   = !!(icon.svgUrl || icon.pngUrl);
  const previewSrc = icon.svgUrl ?? icon.pngUrl ?? null;

  return (
    <tr
      className={`border-b border-base-border/60 last:border-0 align-top transition-colors ${
        isDeleted ? "opacity-40" : "hover:bg-base-surface2/30"
      }`}
    >
      {/* Preview */}
      <td className="px-4 py-3">
        <div className="w-10 h-10 rounded-lg border border-base-border bg-base-surface2 flex items-center justify-center overflow-hidden">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt={icon.displayName} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-text-muted/40 text-lg" title="لا يوجد ملف مرفوع">◻</span>
          )}
        </div>
        {!hasFile && (
          <span className="block text-center text-xs text-amber-400/80 mt-0.5" title="يستخدم الأيقون الافتراضي">fallback</span>
        )}
      </td>

      {/* Info */}
      <td className="px-4 py-3">
        <p className="text-text-primary font-medium text-sm">{icon.displayName}</p>
        <p className="text-text-muted text-xs font-mono" dir="ltr">{icon.key}</p>
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
        {CAT_LABELS[icon.category] ?? icon.category}
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-info bg-info/10 border border-info/20 rounded px-1.5 py-0.5">
          {icon.type}
        </span>
      </td>

      {/* Version — click to toggle history */}
      <td className="px-4 py-3">
        <button
          onClick={() => setShowVersions((v) => !v)}
          className="text-xs font-mono text-gold hover:text-gold/70 underline decoration-dotted"
          title="عرض تاريخ الإصدارات"
          aria-expanded={showVersions}
        >
          v{icon.version}
        </button>
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {isDeleted ? (
          <span className="text-xs text-danger border border-danger/30 rounded-full px-2 py-0.5 bg-danger/5">محذوف</span>
        ) : icon.enabled ? (
          <span className="text-xs text-success border border-success/30 rounded-full px-2 py-0.5 bg-success/5">نشط</span>
        ) : (
          <span className="text-xs text-text-muted border border-base-border rounded-full px-2 py-0.5">معطّل</span>
        )}
      </td>

      {/* Updated at */}
      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
        {new Date(icon.updatedAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5 items-start">
          {!isDeleted && (
            <>
              <button
                onClick={() => { setExpanded((v) => !v); setShowVersions(false); }}
                className="text-xs rounded-lg px-2.5 py-1 bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition"
                aria-expanded={expanded}
              >
                {expanded ? "إغلاق" : "تعديل"}
              </button>
              <form action={setEnabledAction}>
                <input type="hidden" name="id" value={icon.id} />
                <input type="hidden" name="enabled" value={icon.enabled ? "false" : "true"} />
                <SubmitBtn variant="neutral">{icon.enabled ? "تعطيل" : "تفعيل"}</SubmitBtn>
              </form>
              <form
                action={deleteIconAction}
                onSubmit={(e) => {
                  if (!confirm(`هل تريد حذف أيقونة "${icon.displayName}"؟ يمكن استعادتها لاحقًا.`))
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={icon.id} />
                <SubmitBtn variant="danger">حذف</SubmitBtn>
              </form>
            </>
          )}
          {isDeleted && (
            <form action={restoreIconAction}>
              <input type="hidden" name="id" value={icon.id} />
              <SubmitBtn variant="success">استعادة</SubmitBtn>
            </form>
          )}
        </div>

        {/* Inline edit form */}
        {expanded && !isDeleted && (
          <EditIconForm
            icon={icon}
            categories={CAT_LABELS}
            onClose={() => setExpanded(false)}
          />
        )}

        {/* Version history */}
        {showVersions && (
          <VersionHistory
            iconId={icon.id}
            versions={versions ?? []}
            currentVersion={icon.version}
          />
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon table
// ─────────────────────────────────────────────────────────────────────────────

export function IconTable({
  icons,
}: {
  icons: (Icon & { versions?: IconVersion[] })[];
}) {
  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
      <table className="w-full text-sm min-w-[960px]">
        <thead>
          <tr className="border-b border-base-border text-text-muted text-xs">
            <th className="text-right font-medium px-4 py-3 w-16">معاينة</th>
            <th className="text-right font-medium px-4 py-3">المعلومات</th>
            <th className="text-right font-medium px-4 py-3">التصنيف</th>
            <th className="text-right font-medium px-4 py-3 w-20">النوع</th>
            <th className="text-right font-medium px-4 py-3 w-20">الإصدار</th>
            <th className="text-right font-medium px-4 py-3 w-24">الحالة</th>
            <th className="text-right font-medium px-4 py-3 w-32">آخر تعديل</th>
            <th className="text-right font-medium px-4 py-3">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {icons.map((icon) => (
            <IconRow key={icon.id} icon={icon} versions={icon.versions} />
          ))}
          {icons.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-12 text-center text-text-muted">
                لا توجد أيقونات تطابق الفلاتر المحددة
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache invalidate + seed defaults buttons
// ─────────────────────────────────────────────────────────────────────────────

export function CacheInvalidateButton() {
  return (
    <form
      action={invalidateCacheAction}
      onSubmit={(e) => {
        if (!confirm("سيتم إبطال كاش جميع المستخدمين وسيقوم التطبيق بإعادة تحميل الأيقونات عند الطلب التالي. تأكيد؟"))
          e.preventDefault();
      }}
    >
      <SubmitBtn variant="neutral">
        ↺ مسح الكاش وإعادة النشر
      </SubmitBtn>
    </form>
  );
}

export function SeedDefaultsButton() {
  return (
    <form
      action={seedDefaultIconsAction}
      onSubmit={(e) => {
        if (!confirm("سيتم إنشاء سجلات لكل الأيقونات المعرَّفة في الكتالوج (يتخطى الموجود). تأكيد؟"))
          e.preventDefault();
      }}
    >
      <SubmitBtn variant="info">
        ⊕ بذر الأيقونات الافتراضية
      </SubmitBtn>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk upload form
// ─────────────────────────────────────────────────────────────────────────────

export function BulkUploadForm({ categories }: { categories: Record<string, string> }) {
  const [rows, setRows] = useState([
    { key: "", displayName: "", category: "bottom_nav", type: "svg" as "svg" | "png" | "both" },
  ]);
  const [status, setStatus] = useState<{
    ok: boolean;
    message: string;
    errors?: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addRow = () =>
    setRows((r) => [...r, { key: "", displayName: "", category: "bottom_nav", type: "svg" }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const fd = new FormData(e.currentTarget);
      const meta = rows.map((_, i) => ({
        key:         String(fd.get(`row_key_${i}`) ?? ""),
        displayName: String(fd.get(`row_name_${i}`) ?? ""),
        category:    String(fd.get(`row_cat_${i}`)  ?? ""),
        type:        String(fd.get(`row_type_${i}`) ?? "svg") as "svg" | "png" | "both",
      }));

      const validRows = meta.filter((m) => m.key.trim() && m.displayName.trim());
      if (validRows.length === 0) {
        setStatus({ ok: false, message: "أدخل على الأقل صفًا واحدًا صالحًا" });
        return;
      }

      const bulkFd = new FormData();
      bulkFd.set("meta", JSON.stringify(validRows));
      rows.forEach((_, i) => {
        const svgF = fd.get(`row_svg_${i}`) as File | null;
        const pngF = fd.get(`row_png_${i}`) as File | null;
        const key  = meta[i]?.key;
        if (key) {
          if (svgF && svgF.size > 0) bulkFd.set(`svg_${key}`, svgF);
          if (pngF && pngF.size > 0) bulkFd.set(`png_${key}`, pngF);
        }
      });

      await bulkUploadAction(bulkFd);
      setStatus({
        ok:      true,
        message: `تم الرفع بنجاح (${validRows.length} أيقونة). ستظهر في صفحة الأيقونات.`,
      });
      setRows([{ key: "", displayName: "", category: "bottom_nav", type: "svg" }]);
    } catch (err) {
      setStatus({
        ok:      false,
        message: `فشل الرفع: ${(err as Error).message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-4 max-w-5xl">
      <h3 className="font-display font-bold text-text-primary text-lg">رفع جماعي للأيقونات</h3>
      <p className="text-sm text-text-muted">
        أضف صفوفًا، حدد ملفات لكل صف، ثم ارفع الكل دفعة واحدة. الحد الأقصى 100 أيقونة.
      </p>

      {status && (
        <div className={`p-3 rounded-lg border text-sm ${
          status.ok
            ? "bg-success/10 border-success/30 text-success"
            : "bg-danger/10 border-danger/30 text-danger"
        }`}>
          {status.message}
          {status.errors && status.errors.length > 0 && (
            <ul className="mt-1 text-xs list-disc list-inside opacity-80">
              {status.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          {rows.map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 bg-base-surface2 rounded-xl border border-base-border items-end"
            >
              <input name={`row_key_${i}`} required dir="ltr" placeholder="key.name"
                className="rounded-lg bg-base-bg border border-base-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/60" />
              <input name={`row_name_${i}`} required placeholder="الاسم المعروض"
                className="rounded-lg bg-base-bg border border-base-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/60" />
              <select name={`row_cat_${i}`}
                className="rounded-lg bg-base-bg border border-base-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/60">
                {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select name={`row_type_${i}`}
                className="rounded-lg bg-base-bg border border-base-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold/60">
                <option value="svg">SVG</option>
                <option value="png">PNG</option>
                <option value="both">كلاهما</option>
              </select>
              <input name={`row_svg_${i}`} type="file" accept=".svg,image/svg+xml"
                className="text-xs text-text-muted cursor-pointer" />
              <div className="flex gap-1 items-center">
                <input name={`row_png_${i}`} type="file" accept=".png,image/png"
                  className="text-xs text-text-muted cursor-pointer flex-1" />
                <button type="button" onClick={() => removeRow(i)}
                  className="text-danger text-sm hover:opacity-70 ml-1 shrink-0" aria-label="حذف الصف">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={addRow}
            className="text-xs rounded-lg px-3 py-1.5 bg-base-surface2 text-gold border border-gold/30 hover:bg-gold/10 transition">
            + إضافة صف
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-xs rounded-lg px-3 py-1.5 bg-gold text-base-bg font-bold hover:bg-gold/90 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                جارٍ الرفع...
              </span>
            ) : (
              `رفع الكل (${rows.filter((_, i) => true).length})`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log table — enriched with icon key
// ─────────────────────────────────────────────────────────────────────────────

type EnrichedAuditLog = IconAuditLog & { iconKey?: string; iconDisplayName?: string };

const ACTION_STYLES: Record<string, string> = {
  CREATE:      "bg-success/10 text-success border-success/30",
  UPDATE:      "bg-gold/10 text-gold border-gold/30",
  DELETE:      "bg-danger/10 text-danger border-danger/30",
  RESTORE:     "bg-info/10 text-info border-info/30",
  ENABLE:      "bg-success/10 text-success border-success/30",
  DISABLE:     "bg-danger/10 text-danger border-danger/30",
  ROLLBACK:    "bg-gold/10 text-gold border-gold/30",
  BULK_UPLOAD: "bg-info/10 text-info border-info/30",
  CACHE_CLEAR: "bg-danger/10 text-danger border-danger/30",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "إنشاء", UPDATE: "تعديل", DELETE: "حذف", RESTORE: "استعادة",
  ENABLE: "تفعيل", DISABLE: "تعطيل", ROLLBACK: "استرجاع",
  BULK_UPLOAD: "رفع جماعي", CACHE_CLEAR: "مسح الكاش",
};

export function AuditLogTable({ logs }: { logs: EnrichedAuditLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-base-border flex items-center justify-between">
        <h3 className="font-semibold text-text-primary text-sm">سجل المراجعة</h3>
        <span className="text-xs text-text-muted">{logs.length} إدخال</span>
      </div>
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="border-b border-base-border text-text-muted text-xs">
            <th className="text-right font-medium px-5 py-3 w-36">الوقت</th>
            <th className="text-right font-medium px-5 py-3 w-28">الإجراء</th>
            <th className="text-right font-medium px-5 py-3">المشرف</th>
            <th className="text-right font-medium px-5 py-3">الأيقونة</th>
            <th className="text-right font-medium px-5 py-3">تفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            let metadata: Record<string, unknown> | null = null;
            try { if (log.metadata) metadata = JSON.parse(log.metadata); } catch { /* ignore */ }
            const isOpen = expanded === log.id;

            return (
              <tr
                key={log.id}
                className="border-b border-base-border/60 last:border-0 hover:bg-base-surface2/30 transition-colors cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : log.id)}
              >
                <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("ar-EG", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs border rounded-full px-2 py-0.5 ${
                      ACTION_STYLES[log.action] ?? "bg-base-surface2 text-text-muted border-base-border"
                    }`}
                  >
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <p className="text-text-primary text-xs font-medium">{log.adminName}</p>
                  <p className="text-text-muted text-xs" dir="ltr">{log.adminEmail}</p>
                </td>
                <td className="px-5 py-3 text-xs">
                  {log.iconDisplayName ? (
                    <span className="text-text-primary">{log.iconDisplayName}</span>
                  ) : null}
                  {log.iconKey ? (
                    <span className="block font-mono text-text-muted/70" dir="ltr">{log.iconKey}</span>
                  ) : (
                    <span className="text-text-muted/40">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-text-muted font-mono">
                  {isOpen && metadata ? (
                    <pre className="whitespace-pre-wrap text-xs text-text-muted max-w-xs">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  ) : (
                    <span className="truncate max-w-xs block">
                      {log.metadata ? log.metadata.slice(0, 80) : "—"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-text-muted">
                لا يوجد سجل مراجعة بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
