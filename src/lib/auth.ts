/**
 * Auth — read-only session helpers.
 *
 * This file is safe to import from anywhere:
 *   - Server Components  (page.tsx, layout.tsx)
 *   - Server Actions
 *   - Route Handlers
 *   - Middleware
 *   - lib/api-client.ts
 *
 * It ONLY reads cookies (cookies().get()), which Next.js 14 allows in all
 * server contexts.
 *
 * Cookie WRITES (createSession, destroySession) live in auth-mutations.ts
 * which is marked "use server" and may only be called from Server Actions
 * or Route Handlers.
 */

import { jwtVerify } from "jose";
import { cookies } from "next/headers";

// ── Internal constants (exported so auth-mutations.ts can reuse them) ──────

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_VERSION     = "v2"; // bump when payload shape changes

export const secretKey = () =>
  new TextEncoder().encode(
    process.env.SESSION_SECRET || "dev-secret-change-in-production"
  );

// ── Role definitions ───────────────────────────────────────────────────────

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "SUPPORT";

export const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN:       75,
  MODERATOR:   50,
  SUPPORT:     25,
};

/** Returns true when `role` has at least `required` privilege level. */
export function hasPermission(role: AdminRole, required: AdminRole): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
}

// ── Session payload ────────────────────────────────────────────────────────

export type SessionPayload = {
  /** Session format version */
  v: string;
  /** Express-issued access JWT (Bearer token for API calls) */
  accessToken: string;
  /** Express-issued refresh token */
  refreshToken: string;
  /** Admin profile from Express */
  adminId: string;
  name: string;
  email: string;
  role: AdminRole;
};

// ── Read session ───────────────────────────────────────────────────────────

/**
 * Read and verify the session cookie.
 * Uses cookies().get() — safe in ALL server contexts (components, actions, routes).
 * Never mutates the cookie store.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    // Debug logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth] getSession:', {
        hasCookie: !!token,
        cookieName: SESSION_COOKIE_NAME,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
      });
    }
    
    if (!token) return null;
    return verifySessionToken(token);
  } catch (error) {
    console.error('[auth] getSession error:', error);
    return null;
  }
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const p = payload as unknown as SessionPayload;
    // Reject stale session formats
    if (p.v !== SESSION_VERSION) return null;
    return p;
  } catch {
    return null;
  }
}

// ── Permission guards ──────────────────────────────────────────────────────
// For use in Server Actions and Route Handlers.
// These only READ the session — no cookie mutations.

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("غير مصرح — يرجى تسجيل الدخول");
  }
  return session;
}

export async function requireRole(
  minimumRole: AdminRole
): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!hasPermission(session.role, minimumRole)) {
    throw new Error(
      `هذه العملية تتطلب صلاحية ${minimumRole} على الأقل. دورك الحالي: ${session.role}`
    );
  }
  return session;
}

export async function requireSuperAdmin(): Promise<SessionPayload> {
  return requireRole("SUPER_ADMIN");
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole("ADMIN");
}

export async function requireModerator(): Promise<SessionPayload> {
  return requireRole("MODERATOR");
}

// ── Permissions map ────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // User management
  VIEW_USERS:           "SUPPORT"     as AdminRole,
  BAN_USERS:            "MODERATOR"   as AdminRole,
  EDIT_USERS:           "MODERATOR"   as AdminRole,
  SET_VIP:              "ADMIN"       as AdminRole,

  // Room management
  VIEW_ROOMS:           "SUPPORT"     as AdminRole,
  BAN_ROOMS:            "MODERATOR"   as AdminRole,
  DELETE_ROOMS:         "ADMIN"       as AdminRole,

  // Agency management
  VIEW_AGENCIES:        "SUPPORT"     as AdminRole,
  APPROVE_AGENCIES:     "ADMIN"       as AdminRole,
  MANAGE_AGENCIES:      "ADMIN"       as AdminRole,

  // Content moderation
  VIEW_MOMENTS:         "SUPPORT"     as AdminRole,
  MODERATE_MOMENTS:     "MODERATOR"   as AdminRole,

  // Reports
  VIEW_REPORTS:         "SUPPORT"     as AdminRole,
  RESOLVE_REPORTS:      "MODERATOR"   as AdminRole,

  // Payments
  VIEW_PAYMENTS:        "ADMIN"       as AdminRole,
  REFUND_PAYMENTS:      "ADMIN"       as AdminRole,

  // Icons
  VIEW_ICONS:           "ADMIN"       as AdminRole,
  MANAGE_ICONS:         "SUPER_ADMIN" as AdminRole,

  // Assets
  VIEW_ASSETS:          "ADMIN"       as AdminRole,
  MANAGE_ASSETS:        "SUPER_ADMIN" as AdminRole,

  // Notifications
  SEND_NOTIFICATIONS:   "ADMIN"       as AdminRole,

  // Banners
  MANAGE_BANNERS:       "ADMIN"       as AdminRole,

  // Store / Gifts
  MANAGE_STORE:         "ADMIN"       as AdminRole,
  MANAGE_GIFTS:         "ADMIN"       as AdminRole,

  // Settings
  VIEW_SETTINGS:        "ADMIN"       as AdminRole,
  EDIT_SETTINGS:        "SUPER_ADMIN" as AdminRole,

  // Admins
  MANAGE_ADMINS:        "SUPER_ADMIN" as AdminRole,

  // Wallet
  VIEW_WALLET:          "ADMIN"       as AdminRole,
  ADJUST_WALLET:        "SUPER_ADMIN" as AdminRole,
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canDo(role: AdminRole, permission: Permission): boolean {
  return hasPermission(role, PERMISSIONS[permission]);
}
