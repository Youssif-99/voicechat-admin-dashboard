import { getSession } from "@/lib/auth";
import { reportsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButton } from "@/components/ActionButton";
import { canDo } from "@/lib/permissions";
import type { AdminRole } from "@/lib/auth";
import { resolveReport, dismissReport } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  USER:   "مستخدم",
  ROOM:   "غرفة",
  MOMENT: "لحظة",
  CHAT:   "دردشة",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string; page?: string };
}) {
  const session  = await getSession();
  const role     = (session?.role ?? "SUPPORT") as AdminRole;
  const canResolve = canDo(role, "RESOLVE_REPORTS");

  const status = searchParams.status || "OPEN";
  const type   = searchParams.type;
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const { data: reports, total, pages } = await reportsApi.list({
    status, type, page, pageSize: 30,
  }).catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 30 }));

  const TABS = [
    { key: "OPEN",         label: "مفتوحة"      },
    { key: "UNDER_REVIEW", label: "قيد المراجعة" },
    { key: "RESOLVED",     label: "محلولة"       },
    { key: "DISMISSED",    label: "مرفوضة"       },
  ];

  return (
    <>
      <Header title="البلاغات" subtitle={`${total.toLocaleString("en-US")} بلاغ`} adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <a key={t.key} href={`/reports?status=${t.key}${type ? `&type=${type}` : ""}`}
              className={`text-sm px-3 py-1.5 rounded-lg border transition ${status === t.key ? "bg-gold/10 text-gold border-gold/30" : "text-text-muted border-base-border hover:text-text-primary"}`}>
              {t.label}
            </a>
          ))}
          <div className="ml-auto flex gap-2">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <a key={k} href={`/reports?status=${status}&type=${k}`}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${type === k ? "bg-info/10 text-info border-info/30" : "text-text-muted border-base-border hover:text-text-primary"}`}>
                {v}
              </a>
            ))}
            {type && <a href={`/reports?status=${status}`} className="text-xs text-text-muted hover:text-danger underline self-center">مسح</a>}
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-base-border text-text-muted text-xs">
                <th className="text-right font-medium px-5 py-3">نوع البلاغ</th>
                <th className="text-right font-medium px-5 py-3">السبب</th>
                <th className="text-right font-medium px-5 py-3">المُبلِّغ</th>
                <th className="text-right font-medium px-5 py-3">الحالة</th>
                <th className="text-right font-medium px-5 py-3">التاريخ</th>
                {canResolve && <th className="text-right font-medium px-5 py-3">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-base-border/60 last:border-0 align-top">
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium text-info bg-info/10 rounded-full px-2 py-0.5">
                      {TYPE_LABELS[r.type] || r.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-primary max-w-xs">
                    <p className="font-medium text-xs">{r.reason}</p>
                    {r.description && <p className="text-text-muted text-xs mt-0.5 line-clamp-2">{r.description}</p>}
                  </td>
                  <td className="px-5 py-4 text-text-muted text-xs">
                    {r.reporter.displayName}
                    <span className="block" dir="ltr">@{r.reporter.username}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-4 text-text-muted text-xs">
                    {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                  </td>
                  {canResolve && (
                    <td className="px-5 py-4">
                      {(r.status === "OPEN" || r.status === "UNDER_REVIEW") && (
                        <div className="flex gap-2">
                          <form action={resolveReport}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="resolution" value="تم اتخاذ الإجراء المناسب" />
                            <ActionButton variant="success">حل</ActionButton>
                          </form>
                          <form action={dismissReport}>
                            <input type="hidden" name="id" value={r.id} />
                            <ActionButton variant="danger">رفض</ActionButton>
                          </form>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan={canResolve ? 6 : 5} className="px-5 py-10 text-center text-text-muted">لا توجد بلاغات</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <a key={p} href={`/reports?status=${status}&page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted"}`}>{p}</a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
