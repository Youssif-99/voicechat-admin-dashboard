import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { settingsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { saveSettings, flushSettingsCache } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const settings = await settingsApi.get().catch(() => null);

  return (
    <>
      <Header title="الإعدادات" subtitle="ضبط إعدادات التطبيق العامة" adminName={session.name} />

      <div className="p-8 space-y-6">
        {!settings ? (
          <div className="bg-base-surface border border-base-border rounded-card p-6 text-center text-text-muted">
            تعذّر تحميل الإعدادات — تأكد من اتصال Express
          </div>
        ) : (
          <form action={saveSettings} className="space-y-6">
            {/* ── General ─────────────────────────────────────────── */}
            <section className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-4">
              <h2 className="font-display font-bold text-text-primary">عام</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">اسم التطبيق</label>
                  <input name="appName" defaultValue={String(settings.appName ?? "")} className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">البريد الإلكتروني للدعم</label>
                  <input name="supportEmail" defaultValue={String(settings.supportEmail ?? "")} dir="ltr" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">رابط الشروط والأحكام</label>
                  <input name="termsUrl" defaultValue={String(settings.termsUrl ?? "")} dir="ltr" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">رابط سياسة الخصوصية</label>
                  <input name="privacyUrl" defaultValue={String(settings.privacyUrl ?? "")} dir="ltr" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="maintenanceMode" defaultChecked={Boolean(settings.maintenanceMode)} className="accent-danger rounded" />
                  <span className="text-sm text-text-primary">وضع الصيانة</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="registrationEnabled" defaultChecked={Boolean(settings.registrationEnabled)} className="accent-gold rounded" />
                  <span className="text-sm text-text-primary">السماح بالتسجيل الجديد</span>
                </label>
              </div>
            </section>

            {/* ── App versions ─────────────────────────────────────── */}
            <section className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-4">
              <h2 className="font-display font-bold text-text-primary">إصدارات التطبيق</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">الحد الأدنى لإصدار التطبيق</label>
                  <input name="minAppVersion" defaultValue={String(settings.minAppVersion ?? "1.0.0")} dir="ltr" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">إصدار التحديث الإجباري (اتركه فارغاً للتعطيل)</label>
                  <input name="forceUpdateVersion" defaultValue={String(settings.forceUpdateVersion ?? "")} dir="ltr" placeholder="مثال: 2.0.0" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                </div>
              </div>
            </section>

            {/* ── Economy ──────────────────────────────────────────── */}
            <section className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-4">
              <h2 className="font-display font-bold text-text-primary">الاقتصاد</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">سعر العملة مقابل الدولار</label>
                  <input name="coinToUsdRate" type="number" step="0.0001" defaultValue={Number(settings.coinToUsdRate ?? 0.01)} className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">نسبة عمولة الهدايا (0-1)</label>
                  <input name="giftCommissionRate" type="number" step="0.01" min="0" max="1" defaultValue={Number(settings.giftCommissionRate ?? 0.3)} className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">نسبة عمولة الوكالة الافتراضية (0-1)</label>
                  <input name="agencyCommissionDefault" type="number" step="0.01" min="0" max="1" defaultValue={Number(settings.agencyCommissionDefault ?? 0.3)} className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
                </div>
              </div>
            </section>

            {/* ── Rooms ────────────────────────────────────────────── */}
            <section className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-4">
              <h2 className="font-display font-bold text-text-primary">الغرف</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">الحد الأقصى للمقاعد</label>
                  <input name="maxRoomSeats" type="number" min="1" max="50" defaultValue={Number(settings.maxRoomSeats ?? 20)} className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted">نوع الغرفة الافتراضي</label>
                  <select name="defaultRoomType" defaultValue={String(settings.defaultRoomType ?? "PUBLIC")} className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                    <option value="PUBLIC">عامة</option>
                    <option value="PRIVATE">خاصة</option>
                  </select>
                </div>
              </div>
            </section>

            <div className="flex items-center gap-3">
              <button type="submit" className="bg-gold text-base-bg font-bold rounded-lg px-6 py-2.5 text-sm">
                حفظ الإعدادات
              </button>
              <form action={flushSettingsCache}>
                <button type="submit" className="text-sm text-text-muted border border-base-border rounded-lg px-4 py-2.5 hover:text-text-primary hover:border-gold/40 transition">
                  مسح الكاش
                </button>
              </form>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
