"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import type { GiftRecord } from "@/lib/api-client";
import { createGift, updateGift, deleteGift, toggleGiftEnabled } from "./actions";

interface GiftsManagerProps {
  initialGifts: GiftRecord[];
}

export function GiftsManager({ initialGifts }: GiftsManagerProps) {
  const [gifts, setGifts] = useState<GiftRecord[]>(initialGifts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  
  // Selected gift for dedicated Live Preview
  const [previewGift, setPreviewGift] = useState<GiftRecord | null>(
    initialGifts.find((g) => g.animationUrl) || initialGifts[0] || null
  );

  // Edit modal state
  const [editingGift, setEditingGift] = useState<GiftRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setGifts(initialGifts);
    if (!previewGift && initialGifts.length > 0) {
      setPreviewGift(initialGifts[0]);
    }
  }, [initialGifts]);

  // Categories list
  const categories = Array.from(new Set(gifts.map((g) => g.category || "regular")));

  // Filtered gifts
  const filteredGifts = gifts.filter((gift) => {
    const matchesSearch =
      !searchQuery ||
      gift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (gift.nameAr && gift.nameAr.includes(searchQuery)) ||
      gift.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || gift.category === selectedCategory;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && gift.enabled) ||
      (statusFilter === "disabled" && !gift.enabled);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleToggle = (gift: GiftRecord) => {
    const nextState = !gift.enabled;
    // Optimistic update
    setGifts((prev) =>
      prev.map((g) => (g.id === gift.id ? { ...g, enabled: nextState, isActive: nextState } : g))
    );
    if (previewGift?.id === gift.id) {
      setPreviewGift((prev) => prev ? { ...prev, enabled: nextState, isActive: nextState } : null);
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", gift.id);
      fd.append("enabled", String(nextState));
      await toggleGiftEnabled(fd);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("هل أنت متأكد من تعطيل/حذف هذه الهدية؟")) return;
    setGifts((prev) => prev.filter((g) => g.id !== id));
    if (previewGift?.id === id) {
      setPreviewGift(null);
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", id);
      await deleteGift(fd);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Top Summary & Filter Bar ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-base-surface border border-base-border rounded-2xl p-5 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
            🎁
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">إجمالي الهدايا</p>
            <p className="text-2xl font-display font-bold text-text-primary">{gifts.length}</p>
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-2xl p-5 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
            ✨
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">الهدايا المفعلة</p>
            <p className="text-2xl font-display font-bold text-emerald-400">
              {gifts.filter((g) => g.enabled).length}
            </p>
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-2xl p-5 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
            🎬
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium">هدايا متحركة (Animated)</p>
            <p className="text-2xl font-display font-bold text-purple-400">
              {gifts.filter((g) => Boolean(g.animationUrl)).length}
            </p>
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-2xl p-5 shadow-card flex items-center justify-between">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full h-full py-3 px-4 bg-gradient-to-r from-gold to-amber-500 hover:from-amber-400 hover:to-gold text-base-bg font-display font-bold rounded-xl shadow-lg shadow-gold/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <span className="text-xl">+</span> إضافة هدية متحركة جديدة
          </button>
        </div>
      </div>

      {/* ── Main Layout: Live Preview on Side + Catalog on Right ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Sidebar: Dedicated Live Preview */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="bg-base-surface border border-base-border rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4 border-b border-base-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-display font-bold text-text-primary text-base">
                  المعاينة الحية (LIVE PREVIEW)
                </h3>
              </div>
              {previewGift && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-base-surface2 border border-base-border text-text-muted font-mono">
                  {previewGift.animationType?.toUpperCase() || (previewGift.animationUrl ? "LOTTIE" : "STATIC")}
                </span>
              )}
            </div>

            {previewGift ? (
              <LiveGiftPreviewSection gift={previewGift} onEdit={() => setEditingGift(previewGift)} />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-text-muted text-sm border border-dashed border-base-border rounded-2xl p-6 text-center">
                <span className="text-4xl mb-2">🎁</span>
                اختر هدية من القائمة لمعاينتها مباشرة
              </div>
            )}
          </div>
        </div>

        {/* Right: Search, Filter, and Gifts Grid */}
        <div className="lg:col-span-7 space-y-6">
          {/* Controls Bar */}
          <div className="bg-base-surface border border-base-border rounded-2xl p-4 shadow-card flex flex-wrap gap-3 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الاسم العربي، أو التصنيف..."
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-2.5 text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-base-surface2 border border-base-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-gold/50 cursor-pointer"
            >
              <option value="all">كل التصنيفات ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "disabled")}
              className="bg-base-surface2 border border-base-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-gold/50 cursor-pointer"
            >
              <option value="all">كل الحالات</option>
              <option value="active">المفعلة فقط</option>
              <option value="disabled">المعطلة فقط</option>
            </select>
          </div>

          {/* Grid of Gifts */}
          {filteredGifts.length === 0 ? (
            <div className="bg-base-surface border border-base-border rounded-2xl p-12 text-center text-text-muted">
              لا توجد هدايا مطابقة لمعايير البحث.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredGifts.map((gift) => {
                const isSelected = previewGift?.id === gift.id;
                return (
                  <div
                    key={gift.id}
                    onClick={() => setPreviewGift(gift)}
                    className={`group relative bg-base-surface border rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-gold ring-2 ring-gold/20 shadow-xl shadow-gold/5 bg-gold/5"
                        : gift.enabled
                        ? "border-base-border hover:border-gold/40 shadow-card"
                        : "border-base-border/40 opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between text-[11px] gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-base-surface2 border border-base-border text-text-muted font-medium">
                        {gift.category}
                      </span>
                      <div className="flex items-center gap-1">
                        {gift.isLegendary && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            ★ أسطوري
                          </span>
                        )}
                        {gift.isVipOnly && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                            VIP
                          </span>
                        )}
                        {gift.animationUrl && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                            🎬 متحرك
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail / Icon */}
                    <div className="h-24 rounded-xl bg-base-surface2/60 flex items-center justify-center p-2 relative overflow-hidden group-hover:bg-base-surface2 transition-colors">
                      {gift.imageUrl || gift.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={gift.imageUrl || gift.thumbnailUrl}
                          alt={gift.name}
                          className="max-h-20 max-w-full object-contain transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <span className="text-4xl">🎁</span>
                      )}

                      {isSelected && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-gold text-base-bg text-[10px] font-bold">
                          المعاينة الحالية
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div>
                      <p className="font-display font-bold text-text-primary text-sm truncate">
                        {gift.nameAr || gift.name}
                      </p>
                      {gift.nameAr && gift.nameAr !== gift.name && (
                        <p className="text-xs text-text-muted truncate">{gift.name}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm font-bold text-gold font-mono flex items-center gap-1">
                          🪙 {gift.coinValue || gift.coinPrice}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            gift.enabled
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {gift.enabled ? "مفعل" : "معطل"}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-base-border/60 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setPreviewGift(gift)}
                        title="معاينة"
                        className="flex-1 py-1 px-2 rounded-lg bg-base-surface2 hover:bg-gold/10 hover:text-gold text-text-muted text-xs font-medium border border-base-border transition-colors flex items-center justify-center gap-1"
                      >
                        👁️ معاينة
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingGift(gift)}
                        title="تعديل الهدية"
                        className="py-1 px-2.5 rounded-lg bg-base-surface2 hover:bg-sky-500/10 hover:text-sky-400 text-text-muted text-xs font-medium border border-base-border transition-colors"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(gift)}
                        title={gift.enabled ? "تعطيل الهدية" : "تفعيل الهدية"}
                        className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                          gift.enabled
                            ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        {gift.enabled ? "إيقاف" : "تشغيل"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(gift.id)}
                        title="حذف"
                        className="py-1 px-2 rounded-lg bg-base-surface2 hover:bg-rose-500/10 text-text-muted hover:text-rose-400 text-xs font-medium border border-base-border transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Create Modal ─────────────────────────────────────────── */}
      {isCreateOpen && (
        <GiftFormModal
          mode="create"
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
          }}
        />
      )}

      {/* ── Edit Modal ───────────────────────────────────────────── */}
      {editingGift && (
        <GiftFormModal
          mode="edit"
          gift={editingGift}
          onClose={() => setEditingGift(null)}
          onSuccess={() => {
            setEditingGift(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedicated Live Preview Section
// ─────────────────────────────────────────────────────────────────────────────
function LiveGiftPreviewSection({
  gift,
  onEdit,
}: {
  gift: GiftRecord;
  onEdit: () => void;
}) {
  const [replayKey, setReplayKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animContainerRef = useRef<HTMLDivElement>(null);

  const animationUrl = gift.animationUrl?.trim() || "";
  const isLottie =
    animationUrl.endsWith(".json") ||
    gift.animationType === "lottie" ||
    (!animationUrl.endsWith(".riv") &&
      !animationUrl.endsWith(".gif") &&
      !animationUrl.endsWith(".webp") &&
      !animationUrl.endsWith(".png") &&
      animationUrl.length > 0);

  // Play Lottie using lottie-web
  useEffect(() => {
    if (!animContainerRef.current) return;
    if (!animationUrl || !isLottie) {
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    let animInstance: any = null;

    let isCancelled = false;

    import("lottie-web")
      .then((lottieModule) => {
        if (isCancelled || !animContainerRef.current) return;
        const lottie = lottieModule.default || lottieModule;
        animContainerRef.current.innerHTML = "";

        animInstance = lottie.loadAnimation({
          container: animContainerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: animationUrl,
        });

        animInstance.addEventListener("DOMLoaded", () => {
          if (!isCancelled) setLoading(false);
        });

        animInstance.addEventListener("data_failed", () => {
          if (!isCancelled) {
            setLoading(false);
            setError("تعذر تحميل ملف الأنيميشن (404 أو رابط غير صالح)");
          }
        });

        animInstance.addEventListener("error", (e: any) => {
          if (!isCancelled) {
            setLoading(false);
            setError("خطأ في تنسيق ملف Lottie JSON");
          }
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          setLoading(false);
          setError("فشل تحميل مشغل Lottie: " + err.message);
        }
      });

    return () => {
      isCancelled = true;
      if (animInstance) {
        try {
          animInstance.destroy();
        } catch {}
      }
    };
  }, [animationUrl, replayKey, isLottie]);

  const handleReplay = () => {
    setReplayKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* ── Room Overlay Simulation Frame ──────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden border border-purple-500/30 bg-gradient-to-b from-[#160b29] to-[#0d0517] p-6 shadow-2xl">
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-radial from-purple-600/20 via-transparent to-transparent pointer-events-none" />

        {/* Sender Header */}
        <div className="relative z-10 flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full border border-gold/40 bg-purple-950 flex items-center justify-center text-lg shadow-md">
            👑
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-white">المستخدم (سارة)</p>
            <p className="text-[11px] text-purple-200/70">أرسل هدية إلى الغرفة</p>
          </div>
        </div>

        {/* Animation Playback Area */}
        <div className="relative z-10 h-52 flex items-center justify-center my-2">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base-surface/40 backdrop-blur-xs rounded-2xl">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-text-muted">جاري تحميل الأنيميشن...</span>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs text-center max-w-[260px]">
              <span className="text-2xl mb-1">⚠️</span>
              <p className="font-bold">تعذر تشغيل الأنيميشن</p>
              <p className="text-[11px] opacity-80 mt-1">{error}</p>
            </div>
          ) : animationUrl && isLottie ? (
            <div
              key={replayKey}
              ref={animContainerRef}
              className="w-48 h-48 flex items-center justify-center"
              style={{ transform: `scale(${gift.scale || 1.0})` }}
            />
          ) : animationUrl && !isLottie ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={replayKey}
              src={animationUrl}
              alt={gift.name}
              className="max-h-44 max-w-full object-contain animate-bounce"
              style={{ transform: `scale(${gift.scale || 1.0})` }}
              onError={() => setError("تعذر تحميل ملف الصورة المتحركة")}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              {gift.imageUrl || gift.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={gift.imageUrl || gift.thumbnailUrl}
                  alt={gift.name}
                  className="w-32 h-32 object-contain"
                />
              ) : (
                <span className="text-6xl">🎁</span>
              )}
              <span className="text-xs text-text-muted">لا يوجد ملف أنيميشن مخصص (عرض ثابت)</span>
            </div>
          )}
        </div>

        {/* Gift Name & Coin Badge */}
        <div className="relative z-10 flex flex-col items-center gap-2 text-center mt-2">
          <p className="text-lg font-display font-extrabold text-white tracking-wide">
            {gift.nameAr || gift.name}
          </p>
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gold/15 border border-gold/40 text-gold font-bold text-sm shadow-md">
            <span>🪙</span>
            <span>{gift.coinValue || gift.coinPrice} عملة</span>
          </div>
        </div>
      </div>

      {/* ── Playback Controls & Specs ────────────────────────────── */}
      <div className="bg-base-surface2 border border-base-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReplay}
              className="px-4 py-2 rounded-xl bg-gold text-base-bg font-bold text-xs hover:bg-amber-400 transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-gold/10"
            >
              <span>🔄</span> إعادة التشغيل (Replay)
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="px-3 py-2 rounded-xl bg-base-surface border border-base-border text-text-primary font-medium text-xs hover:border-gold/40 transition-colors"
            >
              ✏️ تعديل الإعدادات
            </button>
          </div>
          <span className="text-xs text-text-muted font-mono">
            المدة: {gift.durationMs || 3000}ms
          </span>
        </div>

        {/* Technical Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-base-border/50">
          <div>
            <span className="text-text-muted">النوع: </span>
            <span className="text-text-primary font-mono">{gift.animationType || "lottie"}</span>
          </div>
          <div>
            <span className="text-text-muted">المقياس (Scale): </span>
            <span className="text-text-primary font-mono">{gift.scale || 1.0}x</span>
          </div>
          <div>
            <span className="text-text-muted">الكومبو: </span>
            <span className="text-text-primary font-mono">x{gift.comboCount || 3}</span>
          </div>
          <div>
            <span className="text-text-muted">الحالة: </span>
            <span className={`font-bold ${gift.enabled ? "text-emerald-400" : "text-rose-400"}`}>
              {gift.enabled ? "مفعلة بالصوتية" : "معطلة"}
            </span>
          </div>
        </div>

        {animationUrl && (
          <div className="pt-2 text-[11px] text-text-muted truncate">
            <span className="font-mono text-purple-400">URL: </span>
            <a
              href={animationUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline text-text-muted hover:text-text-primary"
            >
              {animationUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit Gift Modal with Live In-Modal Preview
// ─────────────────────────────────────────────────────────────────────────────
function GiftFormModal({
  mode,
  gift,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  gift?: GiftRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(gift?.name || "");
  const [nameAr, setNameAr] = useState(gift?.nameAr || gift?.name || "");
  const [category, setCategory] = useState(gift?.category || "regular");
  const [coinValue, setCoinValue] = useState(gift?.coinValue || gift?.coinPrice || 100);
  const [animationUrl, setAnimationUrl] = useState(gift?.animationUrl || "");
  const [imageUrl, setImageUrl] = useState(gift?.imageUrl || gift?.thumbnailUrl || "");
  const [isVipOnly, setIsVipOnly] = useState(Boolean(gift?.isVipOnly));
  const [isLegendary, setIsLegendary] = useState(Boolean(gift?.isLegendary));
  const [comboCount, setComboCount] = useState(gift?.comboCount || 3);
  const [durationMs, setDurationMs] = useState(gift?.durationMs || 3000);
  const [scale, setScale] = useState(gift?.scale || 1.0);
  const [sortOrder, setSortOrder] = useState(gift?.sortOrder || 0);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set("isVipOnly", String(isVipOnly));
    formData.set("isLegendary", String(isLegendary));

    try {
      if (mode === "create") {
        await createGift(formData);
      } else if (gift) {
        formData.set("id", gift.id);
        await updateGift(formData);
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "فشلت عملية الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-base-surface border border-base-border rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">{mode === "create" ? "✨" : "✏️"}</span>
            <h3 className="font-display font-bold text-text-primary text-lg">
              {mode === "create" ? "إضافة هدية متحركة جديدة" : `تعديل الهدية: ${gift?.nameAr || gift?.name}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-base-surface border border-base-border flex items-center justify-center text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Arabic Name */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                الاسم بالعربية <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="nameAr"
                required
                value={nameAr}
                onChange={(e) => {
                  setNameAr(e.target.value);
                  if (!name) setName(e.target.value);
                }}
                placeholder="مثال: وردة الحب، تاج الملوك"
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-gold/50 focus:outline-none"
              />
            </div>

            {/* English / Code Name */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                الاسم بالإنجليزية <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                dir="ltr"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Crown, Golden Rose"
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-gold/50 focus:outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">التصنيف</label>
              <input
                type="text"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="regular, luxury, romantic, vip..."
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-gold/50 focus:outline-none"
              />
            </div>

            {/* Price in Coins */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                السعر بالعملات (Coins) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                name="coinValue"
                min="1"
                required
                value={coinValue}
                onChange={(e) => setCoinValue(Number(e.target.value))}
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary font-mono focus:border-gold/50 focus:outline-none"
              />
            </div>
          </div>

          {/* ── Animation Assets Section ─────────────────────────── */}
          <div className="bg-base-surface2/60 border border-base-border rounded-2xl p-4 space-y-4">
            <h4 className="font-display font-bold text-text-primary text-sm flex items-center gap-2">
              <span>🎬</span> أصول الأنيميشن والصورة
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Animation Asset URL or Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-muted">
                  رابط ملف الأنيميشن (Lottie .json / Rive / WebP / GIF)
                </label>
                <input
                  type="url"
                  name="animationUrl"
                  dir="ltr"
                  value={animationUrl}
                  onChange={(e) => setAnimationUrl(e.target.value)}
                  placeholder="https://.../gift-animation.json"
                  className="w-full bg-base-surface border border-base-border rounded-xl px-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-muted/40 focus:border-gold/50 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">أو ارفع ملف:</span>
                  <input
                    type="file"
                    name="animationFile"
                    accept=".json,.riv,.webp,.gif,.png"
                    className="text-xs text-text-muted file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-base-surface file:text-xs file:text-text-primary file:border-base-border file:cursor-pointer"
                  />
                </div>
              </div>

              {/* Thumbnail Image URL or Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-muted">
                  رابط صورة المعاينة المصغرة (Thumbnail)
                </label>
                <input
                  type="url"
                  name="imageUrl"
                  dir="ltr"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://.../thumbnail.webp"
                  className="w-full bg-base-surface border border-base-border rounded-xl px-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-muted/40 focus:border-gold/50 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">أو ارفع صورة:</span>
                  <input
                    type="file"
                    name="thumbnailFile"
                    accept="image/*"
                    className="text-xs text-text-muted file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-base-surface file:text-xs file:text-text-primary file:border-base-border file:cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Animation Config & Badges ────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                مدة العرض (Duration ms)
              </label>
              <input
                type="number"
                name="durationMs"
                step="100"
                min="1000"
                max="10000"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3 py-2 text-sm text-text-primary font-mono focus:border-gold/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                المقياس (Scale Factor)
              </label>
              <input
                type="number"
                name="scale"
                step="0.1"
                min="0.5"
                max="2.5"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3 py-2 text-sm text-text-primary font-mono focus:border-gold/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                حد الكومبو (Combo Count)
              </label>
              <input
                type="number"
                name="comboCount"
                min="1"
                max="20"
                value={comboCount}
                onChange={(e) => setComboCount(Number(e.target.value))}
                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3 py-2 text-sm text-text-primary font-mono focus:border-gold/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-primary">
              <input
                type="checkbox"
                checked={isVipOnly}
                onChange={(e) => setIsVipOnly(e.target.checked)}
                className="w-4 h-4 rounded text-gold focus:ring-gold bg-base-surface2 border-base-border"
              />
              خاص بأعضاء VIP فقط
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-primary">
              <input
                type="checkbox"
                checked={isLegendary}
                onChange={(e) => setIsLegendary(e.target.checked)}
                className="w-4 h-4 rounded text-gold focus:ring-gold bg-base-surface2 border-base-border"
              />
              هدية أسطورية (Legendary Effect)
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-base-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-base-border text-text-muted hover:text-text-primary text-xs font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gold text-base-bg font-display font-bold text-xs hover:bg-amber-400 transition-all shadow-lg shadow-gold/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : mode === "create" ? "إنشاء الهدية" : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}