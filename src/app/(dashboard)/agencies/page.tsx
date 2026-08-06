import { getSession } from "@/lib/auth";
import { agenciesApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButton } from "@/components/ActionButton";
import {
  approveAgency,
  rejectAgency,
  suspendAgency,
  banAgency,
  restoreAgency,
  updateAgencyLevel,
  createAgencyRequest,
} from "./actions";
import { canDo } from "@/lib/permissions";
import type { AdminRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: undefined,    label: "الكل"          },
  { key: "PENDING",    label: "قيد المراجعة"  },
  { key: "APPROVED",   label: "مقبولة"        },
  { key: "REJECTED",   label: "مرفوضة"        },
  { key: "SUSPENDED",  label: "موقوفة"        },
  { key: "BANNED",     label: "محظورة"        },
];

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const session      = await getSession();
  const role         = (session?.role ?? "SUPPORT") as AdminRole;
  const canManage    = canDo(role, "APPROVE_AGENCIES");
  const statusFilter = searchParams.status;
  const page         = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const { data: agencies, total, pages } = await agenciesApi.list({
    status:   statusFilter,
    page,
    pageSize: 50,
  }).catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 50 }));

  return (
    <>
      <Header
        title="الوكالات"
        subtitle="مراجعة طلبات الوكالات والتحكم في مستوى كل وكالة"
        adminName={session?.name || ""}
      />

      <div className="p-8 space-y-6">
        {/* ── Status tabs ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <a
                key={t.label}
                href={t.key ? `/agencies?status=${t.key}` : "/agencies"}
                className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                  statusFilter === t.key
                    ? "bg-gold/10 text-gold border-gold/30"
                    : "text-text-muted border-base-border hover:text-text-primary"
                }`}
              >
                {t.label}
              </a>
            ))}
          </div>

          {/* ── Create request form ───────────────────────────────── */}
          {canManage && (
            <details className="relative">
              <summary className="cursor-pointer text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2 list-none">
                + طلب وكالة جديد
              </summary>
              <form
                action={createAgencyRequest}
                className="absolute left-0 mt-2 w-80 bg-base-surface border border-base-border rounded-card shadow-card p-4 space-y-3 z-20"
              >
                <input name="name"      required placeholder="اسم الوكالة"           className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                <input name="ownerName" required placeholder="اسم صاحب الوكالة"      className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                <input name="phone"     required dir="ltr" placeholder="رقم الهاتف"  className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                <input name="email"     dir="ltr" placeholder="البريد (اختياري)"     className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                <textarea name="notes"  placeholder="ملاحظات (اختياري)"              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
                <button type="submit" className="w-full bg-gold text-base-bg font-bold rounded-lg py-2 text-sm">إضافة الطلب</button>
              </form>
            </details>
          )}
        </div>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-base-border text-text-muted text-xs">
                <th className="text-right font-medium px-5 py-3">الوكالة</th>
                <th className="text-right font-medium px-5 py-3">المالك</th>
                <th className="text-right font-medium px-5 py-3">الهاتف</th>
                <th className="text-right font-medium px-5 py-3">المضيفون</th>
                <th className="text-right font-medium px-5 py-3">المستوى</th>
                <th className="text-right font-medium px-5 py-3">العمولة</th>
                <th className="text-right font-medium px-5 py-3">الأرباح</th>
                <th className="text-right font-medium px-5 py-3">الحالة</th>
                {canManage && <th className="text-right font-medium px-5 py-3">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.id} className="border-b border-base-border/60 last:border-0">
                  <td className="px-5 py-4 text-text-primary font-medium">{a.name}</td>
                  <td className="px-5 py-4 text-text-muted">{a.ownerName}</td>
                  <td className="px-5 py-4 text-text-muted font-mono" dir="ltr">{a.phone}</td>
                  <td className="px-5 py-4 text-text-muted font-mono">{a.hostsCount ?? 0}</td>

                  {/* Level / commission */}
                  <td className="px-5 py-4">
                    {canManage ? (
                      <form action={updateAgencyLevel} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={a.id} />
                        <select name="level" defaultValue={a.level}
                          className="bg-base-surface2 border border-base-border rounded-md text-xs px-2 py-1 text-text-primary">
                          <option value="عادي">عادي</option>
                          <option value="فضي">فضي</option>
                          <option value="ذهبي">ذهبي</option>
                          <option value="ماسي">ماسي</option>
                        </select>
                        <input type="hidden" name="commissionRate" value={a.commissionRate} />
                        <button type="submit" className="text-[11px] text-gold underline decoration-dotted">حفظ</button>
                      </form>
                    ) : (
                      <span className="text-xs text-text-muted">{a.level}</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-text-muted font-mono">
                    {(a.commissionRate * 100).toFixed(0)}%
                  </td>
                  <td className="px-5 py-4 font-mono text-gold">
                    ${a.totalEarnings.toFixed(2)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={a.status} />
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.status === "PENDING" && (
                          <>
                            <form action={approveAgency}>
                              <input type="hidden" name="id" value={a.id} />
                              <ActionButton variant="success">قبول</ActionButton>
                            </form>
                            <form action={rejectAgency}>
                              <input type="hidden" name="id" value={a.id} />
                              <ActionButton variant="danger">رفض</ActionButton>
                            </form>
                          </>
                        )}
                        {a.status === "APPROVED" && (
                          <>
                            <form action={suspendAgency}>
                              <input type="hidden" name="id" value={a.id} />
                              <ActionButton variant="danger" confirmMessage="إيقاف الوكالة؟">إيقاف</ActionButton>
                            </form>
                            <form action={banAgency}>
                              <input type="hidden" name="id" value={a.id} />
                              <ActionButton variant="danger" confirmMessage="حظر الوكالة نهائياً؟">حظر</ActionButton>
                            </form>
                          </>
                        )}
                        {(a.status === "SUSPENDED" || a.status === "REJECTED") && (
                          <form action={restoreAgency}>
                            <input type="hidden" name="id" value={a.id} />
                            <ActionButton variant="success">إعادة تفعيل</ActionButton>
                          </form>
                        )}
                        {a.status === "BANNED" && (
                          <form action={restoreAgency}>
                            <input type="hidden" name="id" value={a.id} />
                            <ActionButton variant="success" confirmMessage="رفع الحظر؟">رفع الحظر</ActionButton>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {agencies.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="px-5 py-10 text-center text-text-muted">
                    لا توجد وكالات في هذا التصنيف
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/agencies?${statusFilter ? `status=${statusFilter}&` : ""}page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                  p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted"
                }`}
              >
                {p}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
