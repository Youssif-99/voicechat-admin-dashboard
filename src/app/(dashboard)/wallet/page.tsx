import { getSession } from "@/lib/auth";
import { walletApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { adjustWallet } from "./actions";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const session = await getSession();
  const q    = searchParams.q?.trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const { data: wallets, total, pages } = await walletApi.list({ q, page })
    .catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 20 }));

  return (
    <>
      <Header title="المحافظ" subtitle={`${total.toLocaleString("en-US")} محفظة`} adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        <form className="flex gap-2" action="/wallet">
          <input name="q" defaultValue={q} placeholder="بحث باسم المستخدم..." className="w-64 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
          <button className="text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2">بحث</button>
          {q && <a href="/wallet" className="text-xs text-text-muted hover:text-danger underline self-center">مسح</a>}
        </form>

        <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-base-border text-text-muted text-xs">
                <th className="text-right font-medium px-5 py-3">المستخدم</th>
                <th className="text-right font-medium px-5 py-3">العملات</th>
                <th className="text-right font-medium px-5 py-3">الماس</th>
                <th className="text-right font-medium px-5 py-3">إجمالي الكسب</th>
                <th className="text-right font-medium px-5 py-3">إجمالي الإنفاق</th>
                <th className="text-right font-medium px-5 py-3">تعديل</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.userId} className="border-b border-base-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="text-text-primary">{w.user.displayName}</p>
                    <p className="text-text-muted text-xs" dir="ltr">@{w.user.username}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-gold">{w.coins.toLocaleString("en-US")}</td>
                  <td className="px-5 py-3 font-mono text-info">{(w.diamonds || 0).toLocaleString("en-US")}</td>
                  <td className="px-5 py-3 font-mono text-success">{w.totalEarned.toLocaleString("en-US")}</td>
                  <td className="px-5 py-3 font-mono text-danger">{w.totalSpent.toLocaleString("en-US")}</td>
                  <td className="px-5 py-3">
                    <details className="relative">
                      <summary className="cursor-pointer list-none text-xs font-medium border rounded-lg px-3 py-1.5 bg-base-surface2 text-text-primary border-base-border hover:bg-base-border">
                        تعديل الرصيد
                      </summary>
                      <form action={adjustWallet} className="absolute z-20 mt-2 right-0 w-56 bg-base-surface2 border border-base-border rounded-lg p-3 space-y-2 shadow-card">
                        <input type="hidden" name="userId" value={w.userId} />
                        <input type="number" name="amount" placeholder="المبلغ (+/-)" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary" />
                        <input name="reason" required placeholder="سبب التعديل" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary placeholder:text-text-muted/50" />
                        <button type="submit" className="w-full text-xs bg-gold text-base-bg font-bold rounded-md py-1.5">تطبيق</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
              {wallets.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-text-muted">لا توجد نتائج</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <a key={p} href={`/wallet?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted"}`}>{p}</a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
