import Link from "next/link";
import { getNavItemsForRole } from "@/lib/permissions";
import type { AdminRole } from "@/lib/auth";
import { logoutAction } from "@/app/(dashboard)/actions";

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "سوبر أدمن",
  ADMIN:       "أدمن",
  MODERATOR:   "مشرف محتوى",
  SUPPORT:     "دعم فني",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  SUPER_ADMIN: "text-gold",
  ADMIN:       "text-info",
  MODERATOR:   "text-success",
  SUPPORT:     "text-text-muted",
};

export function Sidebar({
  role,
  adminName,
}: {
  role: AdminRole;
  adminName?: string;
}) {
  const navItems = getNavItemsForRole(role);

  return (
    <aside className="w-64 shrink-0 bg-base-surface border-l border-base-border flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* ── Logo / Brand ──────────────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-base-border">
        <div className="seat-ring w-14 mb-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className={`seat-dot ${i < 14 ? "filled" : ""}`} />
          ))}
        </div>
        <h1 className="font-display font-extrabold text-base text-text-primary leading-tight">
          لوحة تحكم
          <br />
          التطبيق
        </h1>
        {adminName && (
          <p className="text-xs text-text-muted mt-1 truncate">{adminName}</p>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-base-surface2 transition text-sm font-medium group"
          >
            <span className="text-gold text-base w-5 text-center shrink-0">
              {item.icon}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="text-xs bg-danger/20 text-danger rounded-full px-1.5 py-0.5 font-mono">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* ── Role + logout ─────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t border-base-border space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">الصلاحية:</span>
          <span className={`text-xs font-medium ${ROLE_COLORS[role]}`}>
            {ROLE_LABELS[role]}
          </span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full text-xs text-left text-text-muted hover:text-danger transition py-1"
          >
            تسجيل الخروج ↗
          </button>
        </form>
      </div>
    </aside>
  );
}
