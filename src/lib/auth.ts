/**
 * Auth — Dashboard session management.
 *
 * The dashboard no longer authenticates against its own DB.
 * Instead:
 *   1. Login calls Express POST /api/admin/auth/login
 *   2. Express returns { accessToken, refreshToken, admin }
 *   3. We store both tokens + admin info in a signed httpOnly cookie
 *   4. Every API call reads the accessToken from session
 *   5. On 401 we call Express POST /api/admin/auth/refresh transparently
 *
 * The local Prisma Admin table is NO LONGER used for authentication.
 * Prisma is only used for the Icon management system.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_VERSION = "v2"; // bump when payload shape changes

const secretKey = () =>
  new TextEncoder().encode(
    process.env.SESSION_SECRET || "dev-secret-change-in-production"
  );

// ── Role definitions ───────────────────────────────────────────────────────

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "SUPPORT";

export const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 75,
  MODERATOR: 50,
  SUPPORT: 25,
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

// ── Create / destroy session ───────────────────────────────────────────────

export async function createSession(payload: Omit<SessionPayload, "v">): Promise<void> {
  const token = await new SignJWT({ ...payload, v: SESSION_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function destroySession(): Promise<void> {
  cookies().delete(COOKIE_NAME);
}

// ── Read session ───────────────────────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
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

// ── Token refresh ──────────────────────────────────────────────────────────

/**
 * Uses the stored refresh token to get a new accessToken from Express.
 * Updates the session cookie with the new token.
 * Returns the new accessToken, or null on failure.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const expressUrl = process.env.EXPRESS_API_URL || "http://localhost:4000";
    const res = await fetch(`${expressUrl}/api/admin/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { accessToken: string };
    if (!data.accessToken) return null;

    // Patch the session cookie with the fresh access token
    const current = await getSession();
    if (current) {
      await createSession({ ...current, accessToken: data.accessToken });
    }

    return data.accessToken;
  } catch {
    return null;
  }
}

// ── Permission guards (for use in server actions / API routes) ────────────

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
// Maps each dashboard capability to the minimum required role.

export const PERMISSIONS = {
  // User management
  VIEW_USERS:       "SUPPORT"    as AdminRole,
  BAN_USERS:        "MODERATOR"  as AdminRole,
  EDIT_USERS:       "MODERATOR"  as AdminRole,
  SET_VIP:          "ADMIN"      as AdminRole,

  // Room management
  VIEW_ROOMS:       "SUPPORT"    as AdminRole,
  BAN_ROOMS:        "MODERATOR"  as AdminRole,
  DELETE_ROOMS:     "ADMIN"      as AdminRole,

  // Agency management
  VIEW_AGENCIES:    "SUPPORT"    as AdminRole,
  APPROVE_AGENCIES: "ADMIN"      as AdminRole,
  MANAGE_AGENCIES:  "ADMIN"      as AdminRole,

  // Content moderation
  VIEW_MOMENTS:     "SUPPORT"    as AdminRole,
  MODERATE_MOMENTS: "MODERATOR"  as AdminRole,

  // Reports
  VIEW_REPORTS:     "SUPPORT"    as AdminRole,
  RESOLVE_REPORTS:  "MODERATOR"  as AdminRole,

  // Payments
  VIEW_PAYMENTS:    "ADMIN"      as AdminRole,
  REFUND_PAYMENTS:  "ADMIN"      as AdminRole,

  // Icons
  VIEW_ICONS:       "ADMIN"      as AdminRole,
  MANAGE_ICONS:     "SUPER_ADMIN" as AdminRole,

  // Assets (app branding / remote icons)
  VIEW_ASSETS:      "ADMIN"      as AdminRole,
  MANAGE_ASSETS:    "SUPER_ADMIN" as AdminRole,

  // Notifications
  SEND_NOTIFICATIONS: "ADMIN"   as AdminRole,

  // Banners
  MANAGE_BANNERS:   "ADMIN"      as AdminRole,

  // Store / Gifts
  MANAGE_STORE:     "ADMIN"      as AdminRole,
  MANAGE_GIFTS:     "ADMIN"      as AdminRole,

  // Settings
  VIEW_SETTINGS:    "ADMIN"      as AdminRole,
  EDIT_SETTINGS:    "SUPER_ADMIN" as AdminRole,

  // Admins
  MANAGE_ADMINS:    "SUPER_ADMIN" as AdminRole,

  // Wallet
  VIEW_WALLET:      "ADMIN"      as AdminRole,
  ADJUST_WALLET:    "SUPER_ADMIN" as AdminRole,
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canDo(role: AdminRole, permission: Permission): boolean {
  return hasPermission(role, PERMISSIONS[permission]);
}

// ── Legacy compat exports ──────────────────────────────────────────────────
// Keep these so existing icon-management code that imports from auth doesn't break.

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/** @deprecated Use requireRole() instead */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 10);
}

/** @deprecated Use requireRole() instead */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(password, hash);
}
