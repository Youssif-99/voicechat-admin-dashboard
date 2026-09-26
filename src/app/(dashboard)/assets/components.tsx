"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import type { AppAsset, AppAssetVersion, AppAssetAuditLog } from "@prisma/client";
import {
  createAssetAction, updateAssetAction, deleteAssetAction,
  restoreAssetAction, setAssetActiveAction, rollbackAssetAction,
  invalidateAssetCacheAction, seedDefaultAssetsAction,
} from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function SubmitBtn({ children, variant = "gold", title }: {
  children: React.ReactNode; variant?: "gold"|"danger"|"success"|"neutral"|"info"; title?: string;
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
    <button type="submit" disabled={pending} title={title}
      className={`text-xs rounded-lg px-3 py-1.5 transition disabled:opacity-50 ${cls[variant]}`}>
      {pending
        ? <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/>جارٍ...</span>
        : children}
    </button>
  );
}

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

// ── Live Preview Box ───────────────────────────────────────────────────────

function PreviewBox({ src, label, size = 56 }: { src?: string | null; label: string; size?: number }) {
  if (!src) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs text-text-muted">{label}</p>
      <div style={{ width: size, height: size }}
        className="rounded-lg border border-base-border bg-base-surface2 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
}

// ── File input with current + new preview ─────────────────────────────────

function FileInput({ name, label, currentUrl, onChange, preview }: {
  name: string; label: string;
  currentUrl?: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  preview: string | null;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-text-muted">{label}</label>
      <input name={name} type="file" accept=".svg,.png,.webp,.jpg,.jpeg,image/*"
        onChange={onChange}
        className="w-full text-xs text-text-muted file:mr-2 file:rounded file:border-0 file:bg-base-surface2 file:px-2 file:py-1 file:text-text-primary cursor-pointer" />
      <p className="text-xs text-text-muted/60">PNG · SVG · WEBP · JPG — حد 5 MB</p>
      {(currentUrl || preview) && (
        <div className="flex gap-4 flex-wrap">
          {currentUrl && <PreviewBox src={currentUrl} label="الحالي" />}
          {preview    && <PreviewBox src={preview}    label="الجديد (معاينة)" />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Asset Form
// ─────────────────────────────────────────────────────────────────────────────

export function CreateAssetForm({ categories }: { categories: Record<string, string> }) {
  const file = useFilePreview();
  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-5 max-w-2xl">
      <h3 className="font-display font-bold text-text-primary text-lg">إضافة أصل جديد</h3>
      <form action={createAssetAction} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">المفتاح (key) *</label>
            <input name="key" required dir="ltr" placeholder="home_icon"
              pattern="[a-z0-9_]+"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
            <p className="text-xs text-text-muted/70">أحرف صغيرة، أرقام، شرطة سفلية فقط</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">الاسم *</label>
            <input name="name" required placeholder="أيقونة الرئيسية"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">التصنيف *</label>
            <select name="category" required
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold/60">
              {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">ملاحظة التغيير</label>
            <input name="changeNote" maxLength={300} placeholder="سبب الإضافة..."
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
          </div>
        </div>
        <FileInput name="file" label="ملف الأصل (PNG / SVG / WEBP / JPG)"
          onChange={file.onFile} preview={file.preview} />
        <SubmitBtn>حفظ الأصل</SubmitBtn>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Asset Inline Form
// ─────────────────────────────────────────────────────────────────────────────

function EditAssetForm({ asset, categories, onClose }: {
  asset: AppAsset; categories: Record<string, string>; onClose: () => void;
}) {
  const file = useFilePreview();
  return (
    <form action={updateAssetAction}
      className="space-y-3 mt-3 p-4 bg-base-bg border border-gold/20 rounded-xl">
      <input type="hidden" name="id" value={asset.id} />
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-muted">الاسم</label>
          <input name="name" defaultValue={asset.name}
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 focus:outline-none focus:border-gold/60" />
        </div>
        <div>
          <label className="text-xs text-text-muted">التصنيف</label>
          <select name="category" defaultValue={asset.category}
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 focus:outline-none focus:border-gold/60">
            {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-text-muted">ملاحظة التغيير</label>
          <input name="changeNote" maxLength={300} placeholder="سبب التعديل..."
            className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary mt-1 placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
        </div>
      </div>
      <FileInput name="file" label="استبدال الملف (اختياري)"
        currentUrl={asset.imageUrl} onChange={file.onFile} preview={file.preview} />
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
// Version History Panel
// ─────────────────────────────────────────────────────────────────────────────

function VersionHistory({ assetId, versions, currentVersion }: {
  assetId: string; versions: AppAssetVersion[]; currentVersion: number;
}) {
  if (versions.length === 0)
    return <p className="text-xs text-text-muted py-2 px-1">لا يوجد تاريخ إصدارات</p>;
  return (
    <div className="mt-2 space-y-1 max-h-56 overflow-y-auto pr-1">
      <p className="text-xs font-semibold text-text-muted mb-2">
        الإصدار الحالي: <span className="text-gold font-mono">v{currentVersion}</span>
      </p>
      {versions.map((v) => (
        <div key={v.id}
          className={`flex items-center justify-between text-xs p-2 rounded-lg border ${v.version === currentVersion ? "border-gold/30 bg-gold/5" : "border-base-border/60 bg-base-bg"}`}>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
            <span className="text-gold font-mono font-semibold">v{v.version}</span>
            <span className="text-text-muted">{new Date(v.createdAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</span>
            {v.updatedByName && <span className="text-text-muted/70">بواسطة: {v.updatedByName}</span>}
            {v.changeNote && <span className="text-text-muted/70 italic">"{v.changeNote}"</span>}
            {v.imageUrl && (
              <a href={v.imageUrl} target="_blank" rel="noreferrer" className="text-info hover:underline text-xs">↗ ملف</a>
            )}
          </div>
          {v.version !== currentVersion && (
            <form action={rollbackAssetAction}>
              <input type="hidden" name="id" value={assetId} />
              <input type="hidden" name="targetVersion" value={v.version} />
              <SubmitBtn variant="neutral">استرجاع</SubmitBtn>
            </form>
          )}
          {v.version === currentVersion && <span className="text-xs text-gold/60 font-mono">حالي</span>}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset Grid Card (Grid View)
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({ asset, versions, categories }: {
  asset: AppAsset; versions?: AppAssetVersion[]; categories: Record<string, string>;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const isDeleted = !!asset.deletedAt;
  const hasFile   = !!asset.imageUrl;
  const previewSrc = asset.thumbnailUrl ?? asset.imageUrl ?? null;

  return (
    <div className={`bg-base-surface border border-base-border rounded-card shadow-card p-4 space-y-3 transition ${isDeleted ? "opacity-40" : ""}`}>
      {/* Preview */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-16 h-16 rounded-xl border border-base-border bg-base-surface2 flex items-center justify-center overflow-hidden flex-shrink-0">
          {previewSrc
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={previewSrc} alt={asset.name} className="max-w-full max-h-full object-contain" />
            : <span className="text-text-muted/30 text-2xl">◻</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{asset.name}</p>
          <p className="text-xs font-mono text-text-muted truncate" dir="ltr">{asset.key}</p>
          <p className="text-xs text-text-muted mt-0.5">{categories[asset.category] ?? asset.category}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {asset.mimeType && (
              <span className="text-xs font-mono text-info bg-info/10 border border-info/20 rounded px-1.5 py-0.5">
                {asset.mimeType.split("/")[1]?.toUpperCase()}
              </span>
            )}
            <button onClick={() => setShowVersions(v => !v)}
              className="text-xs font-mono text-gold hover:text-gold/70 underline decoration-dotted"
              aria-expanded={showVersions}>v{asset.version}</button>
            {isDeleted
              ? <span className="text-xs text-danger border border-danger/30 rounded-full px-2 py-0.5 bg-danger/5">محذوف</span>
              : asset.isActive
                ? <span className="text-xs text-success border border-success/30 rounded-full px-2 py-0.5 bg-success/5">نشط</span>
                : <span className="text-xs text-text-muted border border-base-border rounded-full px-2 py-0.5">معطّل</span>}
            {!hasFile && <span className="text-xs text-amber-400/80 border border-amber-400/20 rounded-full px-2 py-0.5 bg-amber-400/5">بدون ملف</span>}
          </div>
        </div>
      </div>

      {/* Dimensions */}
      {asset.width && asset.height ? (
        <p className="text-xs text-text-muted/60 font-mono">{asset.width}×{asset.height}px · {asset.sizeBytes ? `${(asset.sizeBytes / 1024).toFixed(1)} KB` : ""}</p>
      ) : null}

      {/* Updated at */}
      <p className="text-xs text-text-muted/60">
        آخر تعديل: {new Date(asset.updatedAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
      </p>

      {/* Actions */}
      <div className="flex gap-1.5 flex-wrap pt-1">
        {!isDeleted && (
          <>
            <button onClick={() => { setExpanded(v => !v); setShowVersions(false); }}
              className="text-xs rounded-lg px-2.5 py-1 bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition"
              aria-expanded={expanded}>
              {expanded ? "إغلاق" : "تعديل"}
            </button>
            <form action={setAssetActiveAction}>
              <input type="hidden" name="id" value={asset.id} />
              <input type="hidden" name="isActive" value={asset.isActive ? "false" : "true"} />
              <SubmitBtn variant="neutral">{asset.isActive ? "تعطيل" : "تفعيل"}</SubmitBtn>
            </form>
            <form action={deleteAssetAction}
              onSubmit={e => { if (!confirm(`حذف "${asset.name}"؟ يمكن استعادته لاحقًا.`)) e.preventDefault(); }}>
              <input type="hidden" name="id" value={asset.id} />
              <SubmitBtn variant="danger">حذف</SubmitBtn>
            </form>
          </>
        )}
        {isDeleted && (
          <form action={restoreAssetAction}>
            <input type="hidden" name="id" value={asset.id} />
            <SubmitBtn variant="success">استعادة</SubmitBtn>
          </form>
        )}
      </div>

      {expanded && !isDeleted && (
        <EditAssetForm asset={asset} categories={categories} onClose={() => setExpanded(false)} />
      )}
      {showVersions && (
        <VersionHistory assetId={asset.id} versions={versions ?? []} currentVersion={asset.version} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset Grid (public export)
// ─────────────────────────────────────────────────────────────────────────────

export function AssetGrid({ assets, categories }: {
  assets: (AppAsset & { versions?: AppAssetVersion[] })[];
  categories: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {assets.map(a => (
        <AssetCard key={a.id} asset={a} versions={a.versions} categories={categories} />
      ))}
      {assets.length === 0 && (
        <div className="col-span-full py-16 text-center text-text-muted">
          لا توجد أصول تطابق الفلاتر المحددة
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Stats Grid
// ─────────────────────────────────────────────────────────────────────────────

export function AssetCategoryStats({ stats, categories }: {
  stats: { category: string; total: number; active: number; withFile: number }[];
  categories: Record<string, string>;
}) {
  return (
    <details className="group">
      <summary className="text-xs text-text-muted cursor-pointer hover:text-text-primary list-none flex items-center gap-1 select-none mb-2">
        <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
        إحصائيات التصنيفات ({stats.length} تصنيف)
      </summary>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pb-2">
        {stats.map(s => (
          <div key={s.category} className="bg-base-surface2 border border-base-border rounded-xl p-3 text-xs">
            <p className="text-text-muted truncate mb-1">{categories[s.category] ?? s.category}</p>
            <div className="flex gap-2 font-mono">
              <span className="text-text-primary">{s.total}</span>
              <span className="text-success">{s.active} نشط</span>
              <span className={s.withFile < s.total ? "text-danger" : "text-success"}>{s.withFile} ملف</span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar Buttons
// ─────────────────────────────────────────────────────────────────────────────

export function CacheInvalidateAssetButton() {
  return (
    <form action={invalidateAssetCacheAction}
      onSubmit={e => { if (!confirm("سيتم إبطال كاش جميع المستخدمين. تأكيد؟")) e.preventDefault(); }}>
      <SubmitBtn variant="neutral">↺ مسح الكاش</SubmitBtn>
    </form>
  );
}

export function SeedDefaultAssetsButton() {
  return (
    <form action={seedDefaultAssetsAction}
      onSubmit={e => { if (!confirm("بذر الأصول الافتراضية؟ الموجود لن يُلمس.")) e.preventDefault(); }}>
      <SubmitBtn variant="info">⊕ بذر الافتراضية</SubmitBtn>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Table
// ─────────────────────────────────────────────────────────────────────────────

type EnrichedAssetAuditLog = AppAssetAuditLog & { assetKey?: string; assetName?: string };

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-success/10 text-success border-success/30",
  UPDATE: "bg-gold/10 text-gold border-gold/30",
  DELETE: "bg-danger/10 text-danger border-danger/30",
  RESTORE: "bg-info/10 text-info border-info/30",
  ENABLE: "bg-success/10 text-success border-success/30",
  DISABLE: "bg-danger/10 text-danger border-danger/30",
  ROLLBACK: "bg-gold/10 text-gold border-gold/30",
  SEED: "bg-info/10 text-info border-info/30",
  CACHE_CLEAR: "bg-danger/10 text-danger border-danger/30",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "إنشاء", UPDATE: "تعديل", DELETE: "حذف", RESTORE: "استعادة",
  ENABLE: "تفعيل", DISABLE: "تعطيل", ROLLBACK: "استرجاع",
  SEED: "بذر", CACHE_CLEAR: "مسح الكاش",
};

export function AssetAuditLogTable({ logs }: { logs: EnrichedAssetAuditLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
      <div className="px-5 py-3 border-b border-base-border flex items-center justify-between">
        <h3 className="font-semibold text-text-primary text-sm">سجل المراجعة</h3>
        <span className="text-xs text-text-muted">{logs.length} إدخال</span>
      </div>
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-base-border text-text-muted text-xs">
            <th className="text-right font-medium px-5 py-3 w-36">الوقت</th>
            <th className="text-right font-medium px-5 py-3 w-28">الإجراء</th>
            <th className="text-right font-medium px-5 py-3">المشرف</th>
            <th className="text-right font-medium px-5 py-3">الأصل</th>
            <th className="text-right font-medium px-5 py-3">تفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            let meta: Record<string, unknown> | null = null;
            try { if (log.metadata) meta = JSON.parse(log.metadata); } catch { /* ignore */ }
            const isOpen = expanded === log.id;
            return (
              <tr key={log.id}
                className="border-b border-base-border/60 last:border-0 hover:bg-base-surface2/30 transition-colors cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : log.id)}>
                <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${ACTION_STYLES[log.action] ?? "bg-base-surface2 text-text-muted border-base-border"}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <p className="text-text-primary text-xs font-medium">{log.adminName}</p>
                  <p className="text-text-muted text-xs" dir="ltr">{log.adminEmail}</p>
                </td>
                <td className="px-5 py-3 text-xs">
                  {log.assetName && <span className="text-text-primary">{log.assetName}</span>}
                  {log.assetKey  && <span className="block font-mono text-text-muted/70" dir="ltr">{log.assetKey}</span>}
                  {!log.assetKey && <span className="text-text-muted/40">—</span>}
                </td>
                <td className="px-5 py-3 text-xs text-text-muted font-mono">
                  {isOpen && meta
                    ? <pre className="whitespace-pre-wrap text-xs text-text-muted max-w-xs">{JSON.stringify(meta, null, 2)}</pre>
                    : <span className="truncate max-w-xs block">{log.metadata ? log.metadata.slice(0, 80) : "—"}</span>}
                </td>
              </tr>
            );
          })}
          {logs.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-12 text-center text-text-muted">لا يوجد سجل مراجعة بعد</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
