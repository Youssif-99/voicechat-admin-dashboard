"use server";
/**
 * Auth Mutations — cookie-writing session helpers.
 *
 * THIS FILE IS "use server". Every export runs in a Server Action or
 * Route Handler context where cookies().set() / cookies().delete() are legal.
 *
 * NEVER import this file from:
 *   - Server Components  (page.tsx, layout.tsx)
 *   - Client Components  ("use client")
 *   - lib/api-client.ts
 *
 * Allowed callers:
 *   - src/app/login/actions.ts          (Server Action)
 *   - src/app/(dashboard)/actions.ts    (Server Action)
 *   - src/app/api/admin/session/route.ts (Route Handler)
 */

import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE_NAME, SESSION_VERSION, secretKey } from "./auth";

// ── Create session cookie ──────────────────────────────────────────────────

export type SessionPayload = import("./auth").SessionPayload;

export async function createSession(
  payload: Omit<SessionPayload, "v">
): Promise<void> {
  const token = await new SignJWT({ ...payload, v: SESSION_VERSION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

// ── Destroy session cookie ─────────────────────────────────────────────────

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// ── Token refresh (writes new cookie) ─────────────────────────────────────
/**
 * Called from the /api/admin/session Route Handler (not from Server Components).
 * Fetches a new accessToken from Express, updates the session cookie.
 * Returns the new accessToken, or null on failure.
 */
export async function refreshAndRotateSession(
  refreshToken: string
): Promise<string | null> {
  try {
    const expressUrl = process.env.EXPRESS_API_URL || "http://localhost:3000";
    const res = await fetch(`${expressUrl}/api/admin/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { accessToken?: string };
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
