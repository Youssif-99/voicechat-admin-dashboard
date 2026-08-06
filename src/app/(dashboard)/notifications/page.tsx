import { getSession } from "@/lib/auth";
import { notificationsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { sendNotification } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  const { data: notifications } = await notificationsApi.list({ page: 1 })
    .catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 20 }));

  return (
    <>
      <Header title="الإشعارات" subtitle="إرسال إشعارات فورية لكل المستخدمين أو مجموعة محددة" adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        {/* ── Send form ─────────────────────────────────────────────── */}
        <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6">
          <h2 className="font-display font-bold text-text-primary mb-4">إرسال إشعار جديد</h2>
          <form action={sendNotification} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-text-muted">العنوان</label>
                <input name="title" required maxLength={50} placeholder="عنوان الإشعار" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted">المستهدفون</label>
                <select name="targetType" required className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                  <option value="ALL">كل المستخدمين</option>
                  <option value="USER">مستخدم واحد</option>
                  <option value="ROLE">أصحاب دور معين</option>
                  <option value="AGENCY">وكالة معينة</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text-muted">المحتوى</label>
              <textarea name="body" required maxLength={200} rows={3} placeholder="نص الإشعار (حتى 200 حرف)" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50"></textarea>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text-muted">معرّف المستهدف (اختياري — للمستخدم/الوكالة فقط)</label>
              <input name="targetId" dir="ltr" placeholder="user_xyz أو agency_xyz" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            </div>

            <button type="submit" className="bg-gold text-base-bg font-bold rounded-lg px-6 py-2.5 text-sm">إرسال الإشعار</button>
          </form>
        </div>

        {/* ── History ───────────────────────────────────────────────── */}
        <div>
          <h2 className="font-display font-bold text-text-primary mb-4">آخر الإشعارات المرسلة</h2>
          <div className="space-y-2">
            {notifications.length === 0 && (
              <p className="text-text-muted text-sm">لم يتم إرسال أي إشعارات بعد</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="bg-base-surface border border-base-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-text-primary text-sm">{n.title}</p>
                  <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${
                    n.status === "SENT" ? "bg-success/10 text-success" :
                    n.status === "SCHEDULED" ? "bg-gold/10 text-gold" :
                    n.status === "FAILED" ? "bg-danger/10 text-danger" :
                    "bg-base-surface2 text-text-muted"
                  }`}>{n.status}</span>
                </div>
                <p className="text-text-muted text-xs mb-2">{n.body}</p>
                <div className="flex gap-4 text-xs text-text-muted">
                  <span>المستهدفون: {n.targetType}</span>
                  {n.recipientsCount && <span>تم الإرسال لـ {n.recipientsCount} مستخدم</span>}
                  {n.sentAt && <span>{new Date(n.sentAt).toLocaleString("ar-EG")}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
