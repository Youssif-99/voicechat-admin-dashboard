import { getSession } from "@/lib/auth";
import { vipApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { grantVip, revokeVip } from "./actions";

export const dynamic = "force-dynamic";

export default async function VipPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getSession();
  const page    = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const [configs, usersResult] = await Promise.all([
    vipApi.listConfigs().catch(() => []),
    vipApi.listVipUsers({ page }).catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 20 })),
  ]);

  const { data: vipUsers, total, pages } = usersResult;

  return (
    <>
      <Header title="VIP / SVIP" subtitle="إدارة اشتراكات VIP وتكوين المستويات" adminName={session?.name || ""} />

      <div className="p-8 space-y-8">
        {/* ── VIP Configs ─────────────────────────────────────────── */}
        <div>
          <h2 className="font-display font-bold text-text-primary mb-4">مستويات VIP</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {configs.length === 0 && (
              <p className="text-text-muted col-span-full">لم يتم تحميل الإعدادات — تأكد من اتصال Express.</p>
            )}
            {configs.map((c) => (
              <div key={c.level} className={`bg-base-surface border rounded-card shadow-card p-5 ${c.enabled ? "border-base-border" : "border-base-border/40 opacity-60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gold">VIP {c.level}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${c.enabled ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                    {c.enabled ? "نشط" : "معطّل"}
                  </span>
                </div>
                <p className="text-text-primary font-medium text-sm">{c.name}</p>
                <p className="text-text-muted text-xs mt-1">
                  شهري: ${c.monthlyPrice}
                  {c.yearlyPrice && <span> · سنوي: ${c.yearlyPrice}</span>}
                </p>
                {c.benefits.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.benefits.slice(0, 3).map((b, i) => (
                      <li key={i} className="text-xs text-text-muted">• {b}</li>
                    ))}
                    {c.benefits.length > 3 && (
                      <li className="text-xs text-text-muted/60">+{c.benefits.length - 3} أخرى</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Grant VIP form ───────────────────────────────────────── */}
        <div className="bg-base-surface border border-base-border rounded-card shadow-card p-6">
          <h2 className="font-display font-bold text-text-primary mb-4">منح / إلغاء VIP</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <form action={grantVip} className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary">منح VIP</h3>
              <input name="userId" required placeholder="معرّف المستخدم" dir="ltr" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
              <div className="flex gap-2">
                <select name="level" className="flex-1 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                  {[1,2,3,4,5,6,7,8].map(l => <option key={l} value={l}>VIP {l}</option>)}
                </select>
                <input name="durationDays" type="number" min="1" placeholder="أيام" className="w-24 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
              </div>
              <button type="submit" className="w-full bg-gold text-base-bg font-bold rounded-lg py-2 text-sm">منح VIP</button>
            </form>

            <form action={revokeVip} className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary">إلغاء VIP</h3>
              <input name="userId" required placeholder="معرّف المستخدم" dir="ltr" className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
              <ActionButton variant="danger">إلغاء VIP</ActionButton>
            </form>
          </div>
        </div>

        {/* ── VIP users table ──────────────────────────────────────── */}
        <div>
          <h2 className="font-display font-bold text-text-primary mb-4">
            مستخدمو VIP ({total.toLocaleString("en-US")})
          </h2>
          <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-base-border text-text-muted text-xs">
                  <th className="text-right font-medium px-5 py-3">المستخدم</th>
                  <th className="text-right font-medium px-5 py-3">مستوى VIP</th>
                  <th className="text-right font-medium px-5 py-3">العملات</th>
                  <th className="text-right font-medium px-5 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {vipUsers.map((u) => (
                  <tr key={u.id} className="border-b border-base-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <p className="text-text-primary">{u.displayName}</p>
                      <p className="text-text-muted text-xs" dir="ltr">@{u.username}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gold font-bold font-mono">VIP {u.vipLevel}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-text-primary">{u.coins.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${u.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {u.status === "ACTIVE" ? "نشط" : "محظور"}
                      </span>
                    </td>
                  </tr>
                ))}
                {vipUsers.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-text-muted">لا يوجد مستخدمو VIP</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex gap-1 justify-center mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <a key={p} href={`/vip?page=${p}`}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted"}`}>{p}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
