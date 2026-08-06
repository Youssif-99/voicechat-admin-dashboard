import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { Header } from "@/components/Header";
import { ICON_CATEGORIES, ICON_DEFINITIONS } from "@/lib/icon-groups";
import {
  IconTable,
  CreateIconForm,
  BulkUploadForm,
  CacheInvalidateButton,
  AuditLogTable,
  CategoryStatsGrid,
  SeedDefaultsButton,
} from "./components";

export const dynamic = "force-dynamic";

export default async function IconsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    category?: string;
    tab?: string;
    page?: string;
    showDeleted?: string;
    enabled?: string;
  };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  const tab         = searchParams.tab ?? "icons";
  const q           = searchParams.q?.trim();
  const category    = searchParams.category;
  const page        = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const showDeleted = searchParams.showDeleted === "true";
  const enabledFilter =
    searchParams.enabled === "true"
      ? true
      : searchParams.enabled === "false"
      ? false
      : undefined;

  const PAGE_SIZE = 30;

  // Parallel data fetch — only load what the active tab needs
  const [{ icons, total }, catalog, auditLogs, categoryStats] = await Promise.all([
    tab === "icons" || tab === "defaults"
      ? IconRepository.listAdmin({
          search:         q,
          category,
          enabled:        enabledFilter,
          includeDeleted: showDeleted,
          page,
          pageSize:       PAGE_SIZE,
        })
      : Promise.resolve({ icons: [], total: 0 }),

    IconRepository.getCatalogVersion(),

    tab === "audit"
      ? IconRepository.getAuditLogsEnriched(undefined, 150)
      : Promise.resolve([]),

    tab === "icons" || tab === "defaults"
      ? IconRepository.getCategoryStats()
      : Promise.resolve([]),
  ]);

  const pages        = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalDefined = ICON_DEFINITIONS.length;

  // Icons that exist in DB but have no file uploaded yet (Flutter uses bundled fallback)
  const missingUploads = icons.filter((i) => !i.svgUrl && !i.pngUrl).length;
  const totalEnabled  = icons.filter((i) => i.enabled && !i.deletedAt).length;

  return (
    <>
      <Header
        title="إدارة الأيقونات"
        subtitle="تحكم كامل في أيقونات التطبيق — رفع، استبدال، تعطيل، استرجاع، تدقيق"
        adminName={session.name}
      />

      <div className="p-6 space-y-5">

        {/* ── Top stats ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="معرَّف في الكتالوج" value={totalDefined} color="gold" />
          <StatCard label="في قاعدة البيانات"  value={total}        color="info" />
          <StatCard label="نشطة (هذه الصفحة)" value={totalEnabled} color="success" />
          <StatCard
            label="بدون ملف مرفوع"
            value={missingUploads}
            color={missingUploads > 0 ? "danger" : "success"}
            hint="تستخدم الأيقون الافتراضي المضمّن"
          />
          <div className="bg-base-surface border border-base-border rounded-card shadow-card p-4 col-span-1">
            <p className="text-xs text-text-muted">إصدار الكتالوج</p>
            <p className="font-mono text-lg text-gold mt-1">v{catalog?.version ?? 0}</p>
            <p className="font-mono text-xs text-text-muted truncate">{catalog?.etag?.slice(0, 12) ?? "—"}</p>
          </div>
        </div>

        {/* ── Tab navigation ──────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-base-border overflow-x-auto">
          {[
            { id: "icons",    label: "الأيقونات",       badge: total  },
            { id: "create",   label: "إضافة أيقونة",   badge: null   },
            { id: "bulk",     label: "رفع جماعي",       badge: null   },
            { id: "defaults", label: "الأيقونات الافتراضية", badge: missingUploads },
            { id: "audit",    label: "سجل المراجعة",    badge: null   },
          ].map((t) => (
            <a
              key={t.id}
              href={`?tab=${t.id}`}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition ${
                tab === t.id
                  ? "bg-base-surface border border-b-transparent border-base-border text-gold -mb-px"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t.label}
              {t.badge !== null && t.badge !== undefined && t.badge > 0 && (
                <span className={`text-xs font-mono rounded-full px-1.5 py-0.5 ${
                  t.id === "defaults" ? "bg-danger/20 text-danger" : "bg-gold/20 text-gold"
                }`}>
                  {t.badge}
                </span>
              )}
            </a>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB: ICONS
        ═══════════════════════════════════════════════════════════ */}
        {tab === "icons" && (
          <div className="space-y-4">
            {/* Filters bar */}
            <form className="flex flex-wrap gap-2 items-center" action="/icons">
              <input type="hidden" name="tab" value="icons" />
              <input
                name="q"
                defaultValue={q}
                placeholder="بحث بالاسم أو المفتاح أو التصنيف..."
                className="w-64 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/60"
              />
              <select
                name="category"
                defaultValue={category ?? ""}
                className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary"
              >
                <option value="">كل التصنيفات</option>
                {Object.entries(ICON_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                name="enabled"
                defaultValue={searchParams.enabled ?? ""}
                className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary"
              >
                <option value="">كل الحالات</option>
                <option value="true">نشطة فقط</option>
                <option value="false">معطّلة فقط</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  name="showDeleted"
                  value="true"
                  defaultChecked={showDeleted}
                  className="accent-gold rounded"
                />
                عرض المحذوفة
              </label>
              <button
                type="submit"
                className="text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2 hover:bg-gold/90 transition"
              >
                بحث
              </button>
              {(q || category || searchParams.enabled || showDeleted) && (
                <a href="?tab=icons" className="text-xs text-text-muted hover:text-danger underline">
                  مسح الفلاتر
                </a>
              )}
            </form>

            {/* Category stats */}
            {categoryStats.length > 0 && (
              <CategoryStatsGrid stats={categoryStats} categories={ICON_CATEGORIES} />
            )}

            {/* Toolbar: cache invalidate + count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {total} أيقونة{total !== 1 ? "" : ""} — صفحة {page} من {pages}
              </p>
              <CacheInvalidateButton />
            </div>

            {/* Icon table */}
            <IconTable icons={icons} />

            {/* Pagination */}
            {pages > 1 && (
              <nav className="flex items-center gap-1.5 justify-center pt-2" aria-label="pagination">
                {page > 1 && (
                  <a
                    href={`?tab=icons${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${category}` : ""}&page=${page - 1}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm bg-base-surface2 text-text-muted hover:text-text-primary"
                    aria-label="الصفحة السابقة"
                  >
                    ‹
                  </a>
                )}
                {Array.from({ length: Math.min(pages, 10) }, (_, i) => {
                  const p = pages <= 10 ? i + 1 : i + Math.max(1, page - 4);
                  if (p > pages) return null;
                  return (
                    <a
                      key={p}
                      href={`?tab=icons${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${category}` : ""}&page=${p}`}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                        p === page
                          ? "bg-gold text-base-bg font-bold"
                          : "bg-base-surface2 text-text-muted hover:text-text-primary"
                      }`}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </a>
                  );
                })}
                {page < pages && (
                  <a
                    href={`?tab=icons${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${category}` : ""}&page=${page + 1}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm bg-base-surface2 text-text-muted hover:text-text-primary"
                    aria-label="الصفحة التالية"
                  >
                    ›
                  </a>
                )}
              </nav>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: CREATE
        ═══════════════════════════════════════════════════════════ */}
        {tab === "create" && <CreateIconForm categories={ICON_CATEGORIES} />}

        {/* ═══════════════════════════════════════════════════════════
            TAB: BULK
        ═══════════════════════════════════════════════════════════ */}
        {tab === "bulk" && <BulkUploadForm categories={ICON_CATEGORIES} />}

        {/* ═══════════════════════════════════════════════════════════
            TAB: DEFAULTS — icons missing file uploads
        ═══════════════════════════════════════════════════════════ */}
        {tab === "defaults" && (
          <div className="space-y-4">
            <div className="bg-base-surface border border-base-border rounded-card shadow-card p-5">
              <h3 className="font-display font-bold text-text-primary mb-1">
                الأيقونات بدون ملف مرفوع
              </h3>
              <p className="text-sm text-text-muted mb-4">
                الأيقونات التالية موجودة في قاعدة البيانات لكن ليس لها ملف مرفوع بعد.
                يقوم تطبيق Flutter بعرض الأيقونة الافتراضية المضمّنة في التطبيق كـ fallback تلقائي.
              </p>
              {/* Seed defaults button — creates DB records for all defined keys */}
              <div className="flex items-center gap-3 mb-5">
                <SeedDefaultsButton />
                <p className="text-xs text-text-muted">
                  إنشاء سجلات لكل الأيقونات المعرَّفة في الكتالوج (آمن — يتخطى الموجود)
                </p>
              </div>

              {missingUploads > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-base-border text-text-muted text-xs">
                        <th className="text-right font-medium px-4 py-3">المفتاح</th>
                        <th className="text-right font-medium px-4 py-3">الاسم</th>
                        <th className="text-right font-medium px-4 py-3">التصنيف</th>
                        <th className="text-right font-medium px-4 py-3">الحالة</th>
                        <th className="text-right font-medium px-4 py-3">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {icons
                        .filter((i) => !i.svgUrl && !i.pngUrl)
                        .map((icon) => (
                          <tr key={icon.id} className="border-b border-base-border/60 last:border-0">
                            <td className="px-4 py-3 font-mono text-xs text-text-muted" dir="ltr">
                              {icon.key}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-primary">{icon.displayName}</td>
                            <td className="px-4 py-3 text-xs text-text-muted">
                              {ICON_CATEGORIES[icon.category] ?? icon.category}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-warning border border-warning/30 rounded-full px-2 py-0.5 bg-warning/5">
                                fallback مضمّن
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={`?tab=icons&q=${encodeURIComponent(icon.key)}`}
                                className="text-xs text-gold hover:underline"
                              >
                                رفع ملف
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-success text-sm">
                  <span>✓</span>
                  <span>جميع الأيقونات في هذه الصفحة لها ملفات مرفوعة</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: AUDIT
        ═══════════════════════════════════════════════════════════ */}
        {tab === "audit" && <AuditLogTable logs={auditLogs} />}

      </div>
    </>
  );
}

// ── Inline stat card (server component, no import needed) ─────────────────

function StatCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: "gold" | "info" | "success" | "danger";
  hint?: string;
}) {
  const colors = {
    gold:    "text-gold",
    info:    "text-info",
    success: "text-success",
    danger:  "text-danger",
  };
  return (
    <div className="bg-base-surface border border-base-border rounded-card shadow-card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`font-mono text-2xl mt-1 ${colors[color]}`}>{value}</p>
      {hint && <p className="text-xs text-text-muted/70 mt-0.5">{hint}</p>}
    </div>
  );
}
