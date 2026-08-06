import { getSession } from "@/lib/auth";
import { usersApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButton } from "@/components/ActionButton";
import { banUser, unbanUser, updateUserProfile, setUserVip } from "./actions";
import { canDo } from "@/lib/permissions";
import type { AdminRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BAN_LABELS: Record<string, string> = {
  DAY_1:     "يوم واحد",
  DAY_3:     "3 أيام",
  WEEK_1:    "أسبوع",
  PERMANENT: "دائم",
  NETWORK:   "حظر شبكة",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const session   = await getSession();
  const role      = (session?.role ?? "SUPPORT") as AdminRole;
  const canBan    = canDo(role, "BAN_USERS");
  const canEdit   = canDo(role, "EDIT_USERS");
  const canSetVip = canDo(role, "SET_VIP");

  const q      = searchParams.q?.trim();
  const status = searchParams.status;
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const { data: users, total, pages } = await usersApi.list({
    q, status, page, pageSize: 50,
  }).catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 50 }));

  return (
    <>
      <Header
        title="إدارة المستخدمين"
        subtitle={`${total.toLocaleString("en-US")} مستخدم`}
        adminName={session?.name || ""}
      />

      <div className="p-8 space-y-6">
        {/* ── Search / filter bar ────────────────────────────────── */}
        <form className="flex flex-wrap gap-2 items-center" action="/users">
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم أو اليوزر أو الهاتف..."
            className="w-64 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50"
          />
          <select
            name="status"
            defaultValue={status || ""}
            className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary"
          >
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="BANNED">محظور</option>
            <option value="SUSPENDED">موقوف</option>
          </select>
          <button className="text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2">بحث</button>
          {(q || status) && (
            <a href="/users" className="text-xs text-text-muted hover:text-danger underline">مسح</a>
          )}
        </form>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-base-border text-text-muted text-xs">
                <th className="text-right font-medium px-5 py-3">المستخدم</th>
                <th className="text-right font-medium px-5 py-3">الهاتف</th>
                <th className="text-right font-medium px-5 py-3">الوكالة</th>
                <th className="text-right font-medium px-5 py-3">VIP</th>
                <th className="text-right font-medium px-5 py-3">الرصيد</th>
                <th className="text-right font-medium px-5 py-3">الحالة</th>
                {(canBan || canEdit || canSetVip) && (
                  <th className="text-right font-medium px-5 py-3">إجراءات</th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-base-border/60 last:border-0 align-top">
                  <td className="px-5 py-4">
                    <p className="text-text-primary font-medium">{u.displayName}</p>
                    <p className="text-text-muted text-xs" dir="ltr">@{u.username}</p>
                  </td>
                  <td className="px-5 py-4 text-text-muted font-mono" dir="ltr">
                    {u.phone || "—"}
                  </td>
                  <td className="px-5 py-4 text-text-muted">{u.agency?.name || "—"}</td>
                  <td className="px-5 py-4">
                    {u.vipLevel > 0 ? (
                      <span className="text-gold font-mono text-xs">VIP {u.vipLevel}</span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-text-primary">
                    {u.coins.toLocaleString("en-US")}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={u.status} />
                    {u.status === "BANNED" && u.banType && (
                      <p className="text-[11px] text-text-muted mt-1">
                        {BAN_LABELS[u.banType] || u.banType}
                        {u.banExpiresAt &&
                          ` — حتى ${new Date(u.banExpiresAt).toLocaleDateString("ar-EG")}`}
                      </p>
                    )}
                    {u.banReason && (
                      <p className="text-[10px] text-text-muted/70 mt-0.5">{u.banReason}</p>
                    )}
                  </td>
                  {(canBan || canEdit || canSetVip) && (
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2 max-w-xs">
                        {/* Ban / Unban */}
                        {canBan && (
                          u.status === "ACTIVE" ? (
                            <details className="relative">
                              <summary className="cursor-pointer list-none text-xs font-medium border rounded-lg px-3 py-1.5 bg-danger/10 text-danger border-danger/30 hover:bg-danger/20">حظر</summary>
                              <form action={banUser} className="absolute z-20 mt-2 w-56 bg-base-surface2 border border-base-border rounded-lg p-3 space-y-2 shadow-card">
                                <input type="hidden" name="id" value={u.id} />
                                <select name="banType" required className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary">
                                  <option value="DAY_1">حظر يوم</option>
                                  <option value="DAY_3">حظر 3 أيام</option>
                                  <option value="WEEK_1">حظر أسبوع</option>
                                  <option value="PERMANENT">حظر دائم</option>
                                  <option value="NETWORK">حظر شبكة</option>
                                </select>
                                <input name="banReason" placeholder="السبب (اختياري)" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary placeholder:text-text-muted/50" />
                                <ActionButton variant="danger">تأكيد الحظر</ActionButton>
                              </form>
                            </details>
                          ) : (
                            <form action={unbanUser}>
                              <input type="hidden" name="id" value={u.id} />
                              <ActionButton variant="success">رفع الحظر</ActionButton>
                            </form>
                          )
                        )}

                        {/* Edit profile */}
                        {canEdit && (
                          <details className="relative">
                            <summary className="cursor-pointer list-none text-xs font-medium border rounded-lg px-3 py-1.5 bg-base-surface2 text-text-primary border-base-border hover:bg-base-border">تعديل</summary>
                            <form action={updateUserProfile} className="absolute z-20 mt-2 w-56 bg-base-surface2 border border-base-border rounded-lg p-3 space-y-2 shadow-card">
                              <input type="hidden" name="id" value={u.id} />
                              <input name="displayName" defaultValue={u.displayName} placeholder="الاسم" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary" />
                              <input name="avatarUrl" defaultValue={u.avatarUrl || ""} placeholder="رابط الصورة" dir="ltr" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary placeholder:text-text-muted/50" />
                              <ActionButton variant="gold">حفظ</ActionButton>
                            </form>
                          </details>
                        )}

                        {/* Set VIP */}
                        {canSetVip && (
                          <details className="relative">
                            <summary className="cursor-pointer list-none text-xs font-medium border rounded-lg px-3 py-1.5 bg-base-surface2 text-gold border-gold/30 hover:bg-gold/10">VIP</summary>
                            <form action={setUserVip} className="absolute z-20 mt-2 w-40 bg-base-surface2 border border-base-border rounded-lg p-3 space-y-2 shadow-card">
                              <input type="hidden" name="id" value={u.id} />
                              <select name="vipLevel" defaultValue={u.vipLevel} className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary">
                                <option value="0">لا VIP</option>
                                {[1,2,3,4,5,6,7,8].map(l => (
                                  <option key={l} value={l}>VIP {l}</option>
                                ))}
                              </select>
                              <ActionButton variant="gold">حفظ</ActionButton>
                            </form>
                          </details>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-text-muted">
                    لا يوجد مستخدمون مطابقون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <a key={p} href={`/users?${q ? `q=${encodeURIComponent(q)}&` : ""}${status ? `status=${status}&` : ""}page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted hover:text-text-primary"}`}
              >{p}</a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
