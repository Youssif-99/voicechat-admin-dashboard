import { getSession } from "@/lib/auth";
import { storeApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { createStoreItem, deleteStoreItem, toggleItemEnabled } from "./actions";

export const dynamic = "force-dynamic";

const ITEM_TYPE_LABELS: Record<string, string> = {
  FRAME:       "إطار بروفايل",
  BUBBLE:      "فقاعة كلام",
  ENTRANCE:    "دخولية",
  COIN_BUNDLE: "باقة عملات",
  GIFT:        "هدية",
  BADGE:       "شارة",
};

export default async function StorePage() {
  const session = await getSession();
  const items   = await storeApi.list().catch(() => []);

  return (
    <>
      <Header title="المتجر" subtitle="إدارة المنتجات القابلة للشراء داخل التطبيق" adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        {/* ── Add item form ────────────────────────────────────────── */}
        <details className="bg-base-surface border border-base-border rounded-card shadow-card">
          <summary className="cursor-pointer px-6 py-4 font-display font-bold text-text-primary list-none">+ إضافة منتج جديد</summary>
          <form action={createStoreItem} className="px-6 pb-6 grid md:grid-cols-3 gap-4">
            <input name="name" required placeholder="اسم المنتج" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <select name="type" required className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
              {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input name="price" type="number" step="0.01" required placeholder="السعر" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <select name="currency" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
              <option value="COIN">عملة داخلية</option>
              <option value="USD">دولار</option>
            </select>
            <input name="imageUrl" placeholder="رابط الصورة" dir="ltr" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="iconKey" placeholder="مفتاح الأيقونة (اختياري)" dir="ltr" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <textarea name="description" placeholder="الوصف (اختياري)" className="md:col-span-3 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50"></textarea>
            <button type="submit" className="md:col-span-3 bg-gold text-base-bg font-bold rounded-lg py-2 text-sm">إضافة المنتج</button>
          </form>
        </details>

        {/* ── Items grid ───────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.length === 0 && (
            <p className="text-text-muted col-span-full text-center py-10">لا توجد منتجات</p>
          )}
          {items
            .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.sortOrder - b.sortOrder)
            .map((item) => (
            <div key={item.id} className={`bg-base-surface border rounded-card shadow-card p-4 ${item.enabled ? "border-base-border" : "border-base-border/40 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text-primary text-sm truncate">{item.name}</p>
                  <p className="text-xs text-text-muted">{ITEM_TYPE_LABELS[item.type] || item.type}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gold text-sm">{item.price} {item.currency === "COIN" ? "💰" : "$"}</p>
                  {item.featured && <span className="text-xs bg-gold/10 text-gold rounded-full px-2 py-0.5">مميز</span>}
                </div>
              </div>

              {item.description && (
                <p className="text-xs text-text-muted line-clamp-2 mb-3">{item.description}</p>
              )}

              <div className="flex gap-2">
                <form action={toggleItemEnabled}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="enabled" value={String(!item.enabled)} />
                  <ActionButton variant={item.enabled ? "danger" : "success"}>{item.enabled ? "تعطيل" : "تفعيل"}</ActionButton>
                </form>
                <form action={deleteStoreItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <ActionButton variant="danger" confirmMessage="حذف هذا المنتج؟">حذف</ActionButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
