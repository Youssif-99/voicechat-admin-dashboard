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

  const { data: agencies, pages } = await agenciesApi.list({
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

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-gradient-to-br from-base-bg via-base-bg to-base-surface/30 min-h-screen">
        {/* ── Enhanced Stats Overview ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-400 mb-1">{agencies.length}</div>
            <div className="text-sm text-text-muted">إجمالي الوكالات</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm border border-green-500/20 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-green-400 mb-1">
              {agencies.filter(a => a.status === "APPROVED").length}
            </div>
            <div className="text-sm text-text-muted">وكالات نشطة</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm border border-yellow-500/20 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {agencies.filter(a => a.status === "PENDING").length}
            </div>
            <div className="text-sm text-text-muted">قيد المراجعة</div>
          </div>

          <div className="bg-gradient-to-br from-gold/10 to-gold/5 backdrop-blur-sm border border-gold/20 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-gold/20 rounded-xl">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-gold mb-1">
              ${agencies.reduce((sum, a) => sum + a.totalEarnings, 0).toFixed(2)}
            </div>
            <div className="text-sm text-text-muted">إجمالي الأرباح</div>
          </div>
        </div>

        {/* ── Modern Status Tabs & Actions Bar ────────────────────── */}
        <div className="bg-base-surface/50 backdrop-blur-md border border-base-border/50 rounded-2xl p-4 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((t) => (
                <a
                  key={t.label}
                  href={t.key ? `/agencies?status=${t.key}` : "/agencies"}
                  className={`text-sm px-4 py-2.5 rounded-xl font-medium border-2 transition-all duration-300 ${
                    statusFilter === t.key
                      ? "bg-gradient-to-r from-gold to-yellow-500 text-base-bg border-gold shadow-lg shadow-gold/30 scale-105"
                      : "text-text-muted border-base-border/50 hover:text-text-primary hover:border-gold/40 hover:bg-base-surface2/50"
                  }`}
                >
                  {t.label}
                </a>
              ))}
            </div>

            {/* ── Enhanced Create Request Form ───────────────────────── */}
            {canManage && (
              <details className="relative">
                <summary className="cursor-pointer text-sm bg-gradient-to-r from-gold to-yellow-500 text-base-bg font-bold rounded-xl px-5 py-2.5 list-none shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    طلب وكالة جديد
                  </span>
                </summary>
                <form
                  action={createAgencyRequest}
                  className="absolute left-0 mt-2 w-80 bg-base-surface/95 backdrop-blur-xl border border-base-border rounded-2xl shadow-2xl p-5 space-y-3 z-20"
                >
                  <div className="text-sm font-bold text-text-primary mb-4 pb-3 border-b border-base-border">إضافة طلب وكالة جديد</div>
                  <input name="name" required placeholder="اسم الوكالة" className="w-full rounded-xl bg-base-surface2 border border-base-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  <input name="ownerName" required placeholder="اسم صاحب الوكالة" className="w-full rounded-xl bg-base-surface2 border border-base-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  <input name="phone" required dir="ltr" placeholder="رقم الهاتف" className="w-full rounded-xl bg-base-surface2 border border-base-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  <input name="email" dir="ltr" placeholder="البريد (اختياري)" className="w-full rounded-xl bg-base-surface2 border border-base-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all" />
                  <textarea name="notes" placeholder="ملاحظات (اختياري)" className="w-full rounded-xl bg-base-surface2 border border-base-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all min-h-[80px]" />
                  <button type="submit" className="w-full bg-gradient-to-r from-gold to-yellow-500 text-base-bg font-bold rounded-xl py-2.5 text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                    إضافة الطلب
                  </button>
                </form>
              </details>
            )}
          </div>
        </div>

        {/* ── Enhanced Table with Glass Effect ──────────────────────── */}
        <div className="bg-base-surface/50 backdrop-blur-md border border-base-border/50 rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gradient-to-r from-base-surface2/50 to-base-surface2/30 backdrop-blur-sm border-b-2 border-gold/20">
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">الوكالة</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">المالك</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">الهاتف</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">المضيفون</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">المستوى</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">العمولة</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">الأرباح</th>
                  <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">الحالة</th>
                  {canManage && <th className="text-right font-bold px-6 py-4 text-text-primary text-xs uppercase tracking-wider">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {agencies.map((a, idx) => (
                  <tr key={a.id} className={`border-b border-base-border/30 transition-all duration-300 hover:bg-base-surface2/30 ${idx % 2 === 0 ? 'bg-base-surface/20' : 'bg-transparent'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gold/20 to-yellow-500/20 rounded-xl flex items-center justify-center">
                          <span className="text-gold font-bold">{a.name.charAt(0)}</span>
                        </div>
                        <span className="text-text-primary font-semibold">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-muted">{a.ownerName}</td>
                    <td className="px-6 py-4">
                      <span className="text-text-muted font-mono text-xs bg-base-surface2/50 px-2 py-1 rounded-lg" dir="ltr">{a.phone}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg font-bold text-xs">
                        {a.hostsCount ?? 0}
                      </span>
                    </td>

                    {/* Enhanced Level Selector */}
                    <td className="px-6 py-4">
                      {canManage ? (
                        <form action={updateAgencyLevel} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          <select name="level" defaultValue={a.level}
                            className="bg-base-surface2/80 backdrop-blur-sm border border-base-border rounded-lg text-xs px-3 py-1.5 text-text-primary font-medium focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all">
                            <option value="عادي">🥉 عادي</option>
                            <option value="فضي">🥈 فضي</option>
                            <option value="ذهبي">🥇 ذهبي</option>
                            <option value="ماسي">💎 ماسي</option>
                          </select>
                          <input type="hidden" name="commissionRate" value={a.commissionRate} />
                          <button type="submit" className="text-[11px] text-gold hover:text-yellow-400 font-medium underline decoration-dotted transition-colors">
                            حفظ
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-text-muted px-2 py-1 bg-base-surface2/50 rounded-lg">{a.level}</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg font-mono text-xs font-bold">
                        {(a.commissionRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 bg-gold/20 text-gold px-2 py-1 rounded-lg font-mono text-xs font-bold">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                        {a.totalEarnings.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={a.status} />
                    </td>

                    {/* Enhanced Actions */}
                    {canManage && (
                      <td className="px-6 py-4">
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
                    <td colSpan={canManage ? 9 : 8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-base-surface2/50 rounded-2xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <div className="text-text-muted text-sm">لا توجد وكالات في هذا التصنيف</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Enhanced Pagination ─────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex gap-2 justify-center">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/agencies?${statusFilter ? `status=${statusFilter}&` : ""}page=${p}`}
                className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-300 ${
                  p === page 
                    ? "bg-gradient-to-r from-gold to-yellow-500 text-base-bg shadow-lg shadow-gold/30 scale-110" 
                    : "bg-base-surface2/50 text-text-muted hover:bg-base-surface2 hover:scale-105"
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
