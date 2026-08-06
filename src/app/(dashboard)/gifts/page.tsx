import { getSession } from "@/lib/auth";
import { giftsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { createGift, deleteGift, toggleGiftEnabled } from "./actions";

export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const session = await getSession();
  const gifts   = await giftsApi.list().catch(() => []);

  const byCategory = gifts.reduce<Record<string, Array<typeof gifts[0]>>>((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  }, {});

  return (
    <>
      <Header title="الهدايا" subtitle="إدارة كتالوج الهدايا الافتراضية" adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        {/* ── Add form ─────────────────────────────────────────────── */}
        <details className="bg-base-surface border border-base-border rounded-card shadow-card">
          <summary className="cursor-pointer px-6 py-4 font-display font-bold text-text-primary list-none">+ إضافة هدية جديدة</summary>
          <form action={createGift} className="px-6 pb-6 grid md:grid-cols-3 gap-4">
            <input name="name" required placeholder="اسم الهدية" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="category" required placeholder="التصنيف (مثال: basic, vip)" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="coinValue" type="number" min="1" required placeholder="قيمة العملات" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="iconKey" dir="ltr" placeholder="مفتاح الأيقونة (مثال: gift.rose)" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="imageUrl" dir="ltr" placeholder="رابط صورة الهدية" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="animationUrl" dir="ltr" placeholder="رابط الأنيميشن (اختياري)" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <button type="submit" className="md:col-span-3 bg-gold text-base-bg font-bold rounded-lg py-2 text-sm">إضافة الهدية</button>
          </form>
        </details>

        {/* ── Gifts by category ────────────────────────────────────── */}
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <h3 className="font-display font-bold text-text-primary mb-3 capitalize">{cat}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {items
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((g) => (
                <div key={g.id} className={`bg-base-surface border rounded-card p-3 flex flex-col items-center gap-2 ${g.enabled ? "border-base-border" : "border-base-border/40 opacity-60"}`}>
                  {g.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.imageUrl} alt={g.name} className="w-12 h-12 object-contain" />
                  ) : (
                    <div className="w-12 h-12 bg-base-surface2 rounded-lg flex items-center justify-center text-2xl">
                      🎁
                    </div>
                  )}
                  <p className="text-xs font-medium text-text-primary text-center">{g.name}</p>
                  <p className="text-xs font-mono text-gold">{g.coinValue} 💰</p>
                  {g.iconKey && <p className="text-[10px] text-text-muted font-mono" dir="ltr">{g.iconKey}</p>}
                  <div className="flex gap-1 w-full">
                    <form action={toggleGiftEnabled} className="flex-1">
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="enabled" value={String(!g.enabled)} />
                      <button type="submit" className={`w-full text-[10px] rounded px-1.5 py-1 border ${g.enabled ? "text-danger border-danger/30 hover:bg-danger/10" : "text-success border-success/30 hover:bg-success/10"}`}>
                        {g.enabled ? "تعطيل" : "تفعيل"}
                      </button>
                    </form>
                    <form action={deleteGift}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-[10px] text-danger border border-danger/30 rounded px-1.5 py-1 hover:bg-danger/10" onClick={(e) => { if (!confirm("حذف هذه الهدية؟")) e.preventDefault(); }}>
                        حذف
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {gifts.length === 0 && (
          <div className="text-center text-text-muted py-10">لا توجد هدايا — أضف أول هدية من الأعلى</div>
        )}
      </div>
    </>
  );
}
