import { getSession } from "@/lib/auth";
import { paymentsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  COIN_PURCHASE:    "شراء عملات",
  VIP_SUBSCRIPTION: "اشتراك VIP",
  SVIP_SUBSCRIPTION:"اشتراك SVIP",
  GIFT:             "هدية",
  AGENT_COMMISSION: "عمولة وكيل",
  FRAME_PURCHASE:   "شراء إطار",
  ENTRANCE_PURCHASE:"شراء دخولية",
  WITHDRAW:         "سحب",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; page?: string };
}) {
  const session    = await getSession();
  const typeFilter = searchParams.type;
  const statusFilt = searchParams.status;
  const page       = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const [paymentsResult, statsResult] = await Promise.all([
    paymentsApi.list({ type: typeFilter, status: statusFilt, page, pageSize: 50 })
      .catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 50 })),
    paymentsApi.stats()
      .catch(() => ({ grandTotal: 0, byType: {}, byStatus: {}, recentCount: 0 })),
  ]);

  const { data: payments, total, pages } = paymentsResult;
  const stats = statsResult;

  return (
    <>
      <Header
        title="المدفوعات والأرباح"
        subtitle="سجل كل المعاملات المالية داخل التطبيق"
        adminName={session?.name || ""}
      />

      <div className="p-8 space-y-6">
        {/* ── Stats grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            label="إجمالي الإيرادات"
            value={`$${(stats.grandTotal || 0).toFixed(0)}`}
            accent="gold"
          />
          {Object.entries(TYPE_LABELS).slice(0, 6).map(([key, label]) => (
            <StatCard
              key={key}
              label={label}
              value={`$${(((stats.byType as Record<string, number>)?.[key]) || 0).toFixed(0)}`}
              accent="info"
            />
          ))}
        </div>

        {/* ── Type filter tabs ────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          <a href="/payments" className={`text-sm px-3 py-1.5 rounded-lg border transition ${!typeFilter ? "bg-gold/10 text-gold border-gold/30" : "text-text-muted border-base-border hover:text-text-primary"}`}>الكل</a>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <a key={key} href={`/payments?type=${key}`}
              className={`text-sm px-3 py-1.5 rounded-lg border transition ${typeFilter === key ? "bg-gold/10 text-gold border-gold/30" : "text-text-muted border-base-border hover:text-text-primary"}`}>
              {label}
            </a>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-base-border text-text-muted text-xs">
                <th className="text-right font-medium px-5 py-3">المستخدم</th>
                <th className="text-right font-medium px-5 py-3">النوع</th>
                <th className="text-right font-medium px-5 py-3">الوصف</th>
                <th className="text-right font-medium px-5 py-3">المبلغ</th>
                <th className="text-right font-medium px-5 py-3">الحالة</th>
                <th className="text-right font-medium px-5 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-base-border/60 last:border-0">
                  <td className="px-5 py-3 text-text-primary">{p.user.displayName}</td>
                  <td className="px-5 py-3 text-text-muted text-xs">{TYPE_LABELS[p.type] || p.type}</td>
                  <td className="px-5 py-3 text-text-muted">{p.description || "—"}</td>
                  <td className="px-5 py-3 font-mono text-gold">${p.amount.toFixed(2)}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-text-muted text-xs">
                    {new Date(p.createdAt).toLocaleString("ar-EG")}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-text-muted">لا توجد معاملات</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <a key={p} href={`/payments?${typeFilter ? `type=${typeFilter}&` : ""}page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted"}`}>{p}</a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
