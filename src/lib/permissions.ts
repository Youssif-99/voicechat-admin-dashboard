/**
 * Server-side permission utilities.
 * Import in server components / server actions only.
 */

import { getSession } from "./auth";
import { canDo, hasPermission } from "./auth";
import type { Permission, AdminRole } from "./auth";

export { canDo, hasPermission };
export type { Permission, AdminRole };

/** Returns the current session's role, or null if not authenticated. */
export async function getCurrentRole(): Promise<AdminRole | null> {
  const session = await getSession();
  return session?.role ?? null;
}

/**
 * Returns true when the current admin can perform the given permission.
 * Safe to call in server components — returns false if not authenticated.
 */
export async function currentUserCan(permission: Permission): Promise<boolean> {
  const role = await getCurrentRole();
  if (!role) return false;
  return canDo(role, permission);
}

/** Sidebar nav items with their minimum role */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  minRole: AdminRole;
  badge?: string;
};

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",     label: "نظرة عامة",            icon: "◈",  minRole: "SUPPORT"    },
  { href: "/agencies",      label: "الوكالات",              icon: "🛡",  minRole: "SUPPORT"    },
  { href: "/users",         label: "المستخدمون",            icon: "◍",  minRole: "SUPPORT"    },
  { href: "/rooms",         label: "الغرف",                 icon: "◌",  minRole: "SUPPORT"    },
  { href: "/reports",       label: "البلاغات",              icon: "⚑",  minRole: "SUPPORT"    },
  { href: "/moments",       label: "اللحظات",               icon: "◉",  minRole: "MODERATOR"  },
  { href: "/payments",      label: "المدفوعات",             icon: "◎",  minRole: "ADMIN"      },
  { href: "/wallet",        label: "المحافظ",               icon: "◑",  minRole: "ADMIN"      },
  { href: "/vip",           label: "VIP / SVIP",            icon: "♛",  minRole: "ADMIN"      },
  { href: "/banners",       label: "البنرات",               icon: "▦",  minRole: "ADMIN"      },
  { href: "/notifications", label: "الإشعارات",             icon: "◐",  minRole: "ADMIN"      },
  { href: "/gifts",         label: "الهدايا",               icon: "◆",  minRole: "ADMIN"      },
  { href: "/store",         label: "المتجر",                icon: "◇",  minRole: "ADMIN"      },
  { href: "/icons",         label: "الأيقونات",             icon: "◧",  minRole: "SUPER_ADMIN"},
  { href: "/assets",        label: "أصول التطبيق",          icon: "◈",  minRole: "SUPER_ADMIN"},
  { href: "/settings",      label: "الإعدادات",             icon: "⚙",  minRole: "ADMIN"      },
  { href: "/admins",        label: "المشرفون",              icon: "⬡",  minRole: "SUPER_ADMIN"},
];

/** Filters nav items to only those the given role can access */
export function getNavItemsForRole(role: AdminRole): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => hasPermission(role, item.minRole));
}
