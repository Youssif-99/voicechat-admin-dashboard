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
  { href: "/dashboard",     label: "نظرة عامة",            icon: "Dashboard",      minRole: "SUPPORT"    },
  { href: "/agencies",      label: "الوكالات",              icon: "Agencies",       minRole: "SUPPORT"    },
  { href: "/users",         label: "المستخدمون",            icon: "Users",          minRole: "SUPPORT"    },
  { href: "/rooms",         label: "الغرف",                 icon: "Rooms",          minRole: "SUPPORT"    },
  { href: "/reports",       label: "البلاغات",              icon: "Reports",        minRole: "SUPPORT"    },
  { href: "/moments",       label: "اللحظات",               icon: "Moments",        minRole: "MODERATOR"  },
  { href: "/payments",      label: "المدفوعات",             icon: "Payments",       minRole: "ADMIN"      },
  { href: "/wallet",        label: "المحافظ",               icon: "Wallet",         minRole: "ADMIN"      },
  { href: "/vip",           label: "VIP / SVIP",            icon: "Vip",            minRole: "ADMIN"      },
  { href: "/banners",       label: "البنرات",               icon: "Banners",        minRole: "ADMIN"      },
  { href: "/notifications", label: "الإشعارات",             icon: "Notifications",  minRole: "ADMIN"      },
  { href: "/gifts",         label: "الهدايا",               icon: "Gifts",          minRole: "ADMIN"      },
  { href: "/store",         label: "المتجر",                icon: "Store",          minRole: "ADMIN"      },
  { href: "/icons",         label: "الأيقونات",             icon: "Icons",          minRole: "SUPER_ADMIN"},
  { href: "/assets",        label: "أصول التطبيق",          icon: "Assets",         minRole: "SUPER_ADMIN"},
  { href: "/settings",      label: "الإعدادات",             icon: "Settings",       minRole: "ADMIN"      },
  { href: "/admins",        label: "المشرفون",              icon: "Admins",         minRole: "SUPER_ADMIN"},
];

/** Filters nav items to only those the given role can access */
export function getNavItemsForRole(role: AdminRole): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => hasPermission(role, item.minRole));
}
