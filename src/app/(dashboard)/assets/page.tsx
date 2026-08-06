import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AssetRepository } from "@/lib/asset-repository";
import { Header } from "@/components/Header";
import { ASSET_CATEGORIES, ASSET_DEFINITIONS } from "@/lib/asset-definitions";
import {
  AssetGrid, CreateAssetForm, CacheInvalidateAssetButton,
  SeedDefaultAssetsButton, AssetAuditLogTable, AssetCategoryStats,
} from "./components";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: {
    q?: string; category?: string; tab?: string;
    page?: string; showDeleted?: string; isActive?: string;
    sortBy?: string; sortDir?: string;
  };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  const tab          = searchParams.tab ?? "assets";
  const q            = searchParams.q?.trim();
  const category     = searchParams.category;
  const page         = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const showDeleted  = searchParams.showDeleted === "true";
  const activeFilter = searchParams.isActive === "true" ? true : searchParams.isActive === "false" ? false : undefined;
  const sortBy       = (searchParams.sortBy  ?? "updatedAt") as "name" | "category" | "updatedAt" | "version";
  const sortDir      = (searchParams.sortDir ?? "desc")      as "asc" | "desc";
  const PAGE_SIZE    = 24;

  const [{ assets, total }, catalog, auditLogs, categoryStats] = await Promise.all([
    tab === "assets" || tab === "defaults"
      ? AssetRepository.listAdmin({ search: q, category, isActive: activeFilter,
          includeDeleted: showDeleted, page, pageSize: PAGE_SIZE, sortBy, sortDir })
      : Promise.resolve({ assets: [], total: 0 }),

    AssetRepository.getCatalogVersion(),

    tab === "audit"
      ? AssetRepository.getAuditLogs(undefined, 150)
      : Promise.resolve([]),

    tab === "assets" || tab === "defaults"
      ? AssetRepository.getCategoryStats()
      : Promise.resolve([]),
  ]);

  const pages          = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalDefined   = ASSET_DEFINITIONS.length;
  const missingUploads = assets.filter(a => !a.imageUrl).length;
  const totalActive    = assets.filter(a => a.isActive && !a.deletedAt).length;

  return (
    <>
      <Header
        title="إدارة أصول التطبيق"
        subtitle="تحكم في جميع أيقونات وصور التطبيق — تحديث فوري لكل المستخدمين دون إعادة بناء"
        adminName={session.name}
      />

      <div className="p-6 space-y-5">

        {/* ── Stats row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "معرَّف في الكتالوج", value: totalDefined,   color: "gold"    },
            { label: "في قاعدة البيانات",  value: total,           color: "info"    },
            { label: "نشطة (هذه الصفحة)", value: totalActive,     color: "success" },
            { label: "بدون ملف",           value: missingUploads,  color: missingUploads > 0 ? "danger" : "success" },
          ].map(s => (
            <div key={s.label} className="bg-base-surface border border-base-border rounded-card shadow-card p-4">
              <p className="text-xs text-text-muted">{s.label}</p>
              <p className={`font-mono text-2xl mt-1 text-${s.color}`}>{s.value}</p>
            </div>
          ))}
          <div className="bg-base-surface border border-base-border rounded-card shadow-card p-4">
            <p className="text-xs text-text-muted">إصدار الكتالوج</p>
            <p className="font-mono text-lg text-gold mt-1">v{catalog?.version ?? 0}</p>
            <p className="font-mono text-xs text-text-muted truncate">{catalog?.etag?.slice(0, 12) ?? "—"}</p>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-base-border overflow-x-auto">
          {[
            { id: "assets",   label: "الأصول",             badge: total          },
            { id: "create",   label: "إضافة أصل",          badge: null           },
            { id: "defaults", label: "بدون ملف",           badge: missingUploads },
            { id: "audit",    label: "سجل المراجعة",       badge: null           },
          ].map(t => (
            <a key={t.id} href={`?tab=${t.id}`}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition ${
                tab === t.id
                  ? "bg-base-surface border border-b-transparent border-base-border text-gold -mb-px"
                  : "text-text-muted hover:text-text-primary"
              }`}>
              {t.label}
              {t.badge !== null && t.badge !== undefined && t.badge > 0 && (
                <span className={`text-xs font-mono rounded-full px-1.5 py-0.5 ${t.id === "defaults" ? "bg-danger/20 text-danger" : "bg-gold/20 text-gold"}`}>
                  {t.badge}
                </span>
              )}
            </a>
          ))}
        </div>

        {/* ═══ TAB: ASSETS ═══════════════════════════════════════════ */}
        {tab === "assets" && (
          <div className="space-y-4">
            {/* Filters */}
            <form className="flex flex-wrap gap-2 items-center" action="/assets">
              <input type="hidden" name="tab" value="assets" />
              <input name="q" defaultValue={q}
                placeholder="بحث بالاسم أو المفتاح..."
                className="w-56 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60" />
              <select name="category" defaultValue={category ?? ""}
                className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                <option value="">كل التصنيفات</option>
                {Object.entries(ASSET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select name="isActive" defaultValue={searchParams.isActive ?? ""}
                className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                <option value="">كل الحالات</option>
                <option value="true">نشطة فقط</option>
                <option value="false">معطّلة فقط</option>
              </select>
              <select name="sortBy" defaultValue={sortBy}
                className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                <option value="updatedAt">آخر تعديل</option>
                <option value="name">الاسم</option>
                <option value="category">التصنيف</option>
                <option value="version">الإصدار</option>
              </select>
              <select name="sortDir" defaultValue={sortDir}
                className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
                <option value="desc">تنازلي</option>
                <option value="asc">تصاعدي</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input type="checkbox" name="showDeleted" value="true" defaultChecked={showDeleted} className="accent-gold rounded" />
                عرض المحذوفة
              </label>
              <button type="submit" className="text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2 hover:bg-gold/90 transition">بحث</button>
              {(q || category || searchParams.isActive || showDeleted) && (
                <a href="?tab=assets" className="text-xs text-text-muted hover:text-danger underline">مسح الفلاتر</a>
              )}
            </form>

            {categoryStats.length > 0 && <AssetCategoryStats stats={categoryStats} categories={ASSET_CATEGORIES} />}

            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">{total} أصل — صفحة {page} من {pages}</p>
              <div className="flex gap-2">
                <SeedDefaultAssetsButton />
                <CacheInvalidateAssetButton />
              </div>
            </div>

            <AssetGrid assets={assets} categories={ASSET_CATEGORIES} />

            {/* Pagination */}
            {pages > 1 && (
              <nav className="flex items-center gap-1.5 justify-center pt-2" aria-label="pagination">
                {page > 1 && (
                  <a href={`?tab=assets${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${category}` : ""}&page=${page - 1}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm bg-base-surface2 text-text-muted hover:text-text-primary">‹</a>
                )}
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  const p = pages <= 7 ? i + 1 : i + Math.max(1, page - 3);
                  if (p > pages) return null;
                  return (
                    <a key={p} href={`?tab=assets${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${category}` : ""}&page=${p}`}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted hover:text-text-primary"}`}
                      aria-current={p === page ? "page" : undefined}>{p}</a>
                  );
                })}
                {page < pages && (
                  <a href={`?tab=assets${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${category}` : ""}&page=${page + 1}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm bg-base-surface2 text-text-muted hover:text-text-primary">›</a>
                )}
              </nav>
            )}
          </div>
        )}

        {/* ═══ TAB: CREATE ════════════════════════════════════════════ */}
        {tab === "create" && <CreateAssetForm categories={ASSET_CATEGORIES} />}

        {/* ═══ TAB: DEFAULTS (missing files) ══════════════════════════ */}
        {tab === "defaults" && (
          <div className="bg-base-surface border border-base-border rounded-card shadow-card p-5 space-y-4">
            <h3 className="font-display font-bold text-text-primary">الأصول بدون ملف مرفوع</h3>
            <p className="text-sm text-text-muted">
              هذه الأصول موجودة في قاعدة البيانات لكن ليس لها ملف مرفوع بعد.
              Flutter يعرض الأيقون المضمّن (fallback) تلقائيًا حتى يتم الرفع.
            </p>
            <div className="flex items-center gap-3">
              <SeedDefaultAssetsButton />
              <p className="text-xs text-text-muted">إنشاء سجلات لكل الأصول المعرَّفة (آمن — يتخطى الموجود)</p>
            </div>
            {missingUploads > 0 ? (
              <AssetGrid assets={assets.filter(a => !a.imageUrl)} categories={ASSET_CATEGORIES} />
            ) : (
              <div className="flex items-center gap-2 text-success text-sm">
                <span>✓</span><span>جميع الأصول في هذه الصفحة لها ملفات مرفوعة</span>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: AUDIT ═════════════════════════════════════════════ */}
        {tab === "audit" && <AssetAuditLogTable logs={auditLogs} />}

      </div>
    </>
  );
}
