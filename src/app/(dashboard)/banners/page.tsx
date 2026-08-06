import { getSession } from "@/lib/auth";
import { bannersApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { createBanner, updateBanner, deleteBanner, toggleBanner, reorderBanners } from "./actions";

export const dynamic = "force-dynamic";

export default async function BannersPage() {
  const session = await getSession();
  const banners = await bannersApi.list().catch(() => []);

  return (
    <>
      <Header title="البنرات" subtitle="إدارة بنرات الشاشة الرئيسية في التطبيق" adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        {/* ── Add banner form ──────────────────────────────────────── */}
        <details className="bg-base-surface border border-base-border rounded-card shadow-card">
          <summary className="cursor-pointer px-6 py-4 font-display font-bold text-text-primary list-none">
            + إضافة بنر جديد
          </summary>
          <form action={createBanner} className="px-6 pb-6 grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-text-muted">العنوان</label>
              <input name="title" required placeholder="عنوان البنر" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted">رابط الصورة</label>
              <input name="imageUrl" required dir="ltr" placeholder="https://..." className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted">الرابط عند الضغط (اختياري)</label>
              <input name="linkUrl" dir="ltr" placeholder="https://... أو screen://..." className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted">الشاشة المستهدفة</label>
              <select name="screen" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                <option value="">— كل الشاشات —</option>
                <option value="home">الرئيسية</option>
                <option value="rooms">الغرف</option>
                <option value="store">المتجر</option>
                <option value="vip">VIP</option>
                <option value="wallet">المحفظة</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted">تاريخ البداية (اختياري)</label>
              <input name="startAt" type="datetime-local" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted">تاريخ الانتهاء (اختياري)</label>
              <input name="endAt" type="datetime-local" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="bg-gold text-base-bg font-bold rounded-lg px-6 py-2 text-sm">إضافة البنر</button>
            </div>
          </form>
        </details>

        {/* ── Banners list ─────────────────────────────────────────── */}
        <div className="space-y-3">
          {banners.length === 0 && (
            <div className="bg-base-surface border border-base-border rounded-card p-10 text-center text-text-muted">
              لا توجد بنرات — أضف أول بنر من الأعلى
            </div>
          )}
          {banners
            .sort((a, b) => a.position - b.position)
            .map((b) => (
            <div key={b.id} className={`bg-base-surface border rounded-card shadow-card overflow-hidden flex gap-0 ${b.enabled ? "border-base-border" : "border-base-border/40 opacity-60"}`}>
              {/* Preview */}
              <div className="w-40 shrink-0 bg-base-surface2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>

              {/* Info */}
              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-text-primary text-sm">{b.title}</p>
                    {b.screen && <span className="text-xs text-info bg-info/10 rounded-full px-2 py-0.5 mt-1 inline-block">{b.screen}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${b.enabled ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                      {b.enabled ? "نشط" : "معطّل"}
                    </span>
                    <span className="text-xs text-text-muted font-mono">#{b.position}</span>
                  </div>
                </div>

                {b.linkUrl && (
                  <p className="text-xs text-text-muted font-mono truncate" dir="ltr">{b.linkUrl}</p>
                )}

                {(b.startAt || b.endAt) && (
                  <p className="text-xs text-text-muted mt-1">
                    {b.startAt && `من ${new Date(b.startAt).toLocaleDateString("ar-EG")}`}
                    {b.endAt && ` حتى ${new Date(b.endAt).toLocaleDateString("ar-EG")}`}
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  <form action={toggleBanner}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="enabled" value={String(!b.enabled)} />
                    <ActionButton variant={b.enabled ? "danger" : "success"}>
                      {b.enabled ? "تعطيل" : "تفعيل"}
                    </ActionButton>
                  </form>
                  <form action={deleteBanner}>
                    <input type="hidden" name="id" value={b.id} />
                    <ActionButton variant="danger" confirmMessage="حذف هذا البنر؟">حذف</ActionButton>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
