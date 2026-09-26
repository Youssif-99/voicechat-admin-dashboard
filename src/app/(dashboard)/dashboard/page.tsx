import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { statsApi, ApiError } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { denied?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch dashboard stats from Express
  let stats;
  let statsError: { isNetwork: boolean; message: string } | null = null;
  try {
    stats = await statsApi.dashboard();
  } catch (err) {
    stats = null;
    if (err instanceof ApiError) {
      statsError = {
        isNetwork: err.status === 0,
        message:   err.message,
      };
    } else {
      statsError = { isNetwork: false, message: String(err) };
    }
  }

  return (
    <>
      <Header
        title="نظرة عامة"
        subtitle="ملخص أداء التطبيق"
        adminName={session.name}
      />

      {searchParams.denied === "1" && (
        <div className="mx-8 mt-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
          ليس لديك صلاحية الوصول لتلك الصفحة.
        </div>
      )}

      {!stats ? (
        <div className="p-8">
          <div className="bg-base-surface border border-base-border rounded-card p-6 text-center text-text-muted">
            {statsError?.isNetwork ? (
              <>
                <p className="text-lg font-bold mb-2 text-danger">تعذّر الاتصال بالخادم</p>
                <p className="text-sm">
                  تأكد من تشغيل Express backend على{" "}
                  <span dir="ltr">{process.env.EXPRESS_API_URL || "http://localhost:3000"}</span>
                </p>
              </>
            ) : statsError?.message.includes("401") || statsError?.message.includes("انتهت") ? (
              <>
                <p className="text-lg font-bold mb-2 text-warning">انتهت صلاحية الجلسة</p>
                <p className="text-sm">
                  يرجى{" "}
                  <a href="/login" className="text-gold underline">تسجيل الدخول مرة أخرى</a>
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold mb-2">تعذّر تحميل البيانات</p>
                <p className="text-sm text-text-muted/70">{statsError?.message || "خطأ غير متوقع"}</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 space-y-8">
          {/* ── Stat cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="إجمالي المستخدمين"
              value={(stats.totalUsers ?? 0).toLocaleString("en-US")}
              accent="info"
            />
            <StatCard
              label="الوكالات النشطة"
              value={(stats.activeAgencies ?? 0).toLocaleString("en-US")}
              accent="success"
            />
            <StatCard
              label="طلبات معلّقة"
              value={(stats.pendingAgencies ?? 0).toLocaleString("en-US")}
              hint="بحاجة لمراجعتك"
              accent="gold"
            />
            <StatCard
              label="مستخدمون محظورون"
              value={(stats.bannedUsers ?? 0).toLocaleString("en-US")}
              accent="danger"
            />
            <StatCard
              label="إجمالي الغرف"
              value={(stats.totalRooms ?? 0).toLocaleString("en-US")}
              accent="info"
            />
          </div>

          {/* Open reports alert */}
          {(stats.openReports ?? 0) > 0 && (
            <div className="bg-danger/5 border border-danger/20 rounded-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-danger">
                  {stats.openReports} بلاغات مفتوحة
                </p>
                <p className="text-xs text-text-muted mt-0.5">تحتاج إلى مراجعة</p>
              </div>
              <a
                href="/reports?status=OPEN"
                className="text-xs bg-danger text-white rounded-lg px-3 py-1.5 hover:bg-danger/90 transition"
              >
                مراجعة البلاغات
              </a>
            </div>
          )}

          {/* ── Revenue ────────────────────────────────────────────── */}
          <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6">
            <p className="text-sm text-text-muted">إجمالي الإيرادات</p>
            <p className="font-mono text-4xl font-bold text-gold mt-2">
              ${(stats.totalRevenue ?? 0).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          {/* ── Recent payments ────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6">
              <h3 className="font-display font-bold text-text-primary mb-4">
                أحدث المعاملات المالية
              </h3>
              <div className="space-y-3">
                {(stats.recentPayments ?? []).length === 0 && (
                  <p className="text-sm text-text-muted">لا توجد معاملات بعد</p>
                )}
                {(stats.recentPayments ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm border-b border-base-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      {/* Backend returns user.username — displayName may be null */}
                      <p className="text-text-primary">
                        {p.user?.displayName ?? p.user?.username ?? "—"}
                      </p>
                      <p className="text-text-muted text-xs">{p.type ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-gold">
                        ${(p.amountEGP ?? 0).toFixed(2)}
                      </p>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6">
              <h3 className="font-display font-bold text-text-primary mb-4">
                أحدث طلبات الوكالات
              </h3>
              <div className="space-y-3">
                {(stats.recentAgencies ?? []).length === 0 && (
                  <p className="text-sm text-text-muted">لا توجد طلبات بعد</p>
                )}
                {(stats.recentAgencies ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-sm border-b border-base-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-text-primary">{a.name ?? "—"}</p>
                      <p className="text-text-muted text-xs">{a.ownerName ?? "—"}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
