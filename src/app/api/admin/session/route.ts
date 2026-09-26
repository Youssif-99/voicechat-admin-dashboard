/**
 * Route Handler: /api/admin/session
 *
 * Handles transparent access-token rotation.
 * Called by Next.js middleware when the access token is near expiry.
 *
 * This is the ONLY correct place to call refreshAndRotateSession() because:
 *   • Route Handlers run outside the Server Component render phase
 *   • cookies().set() is legal here
 *
 * Flow:
 *   Middleware detects token age → redirects to /api/admin/session?from=<path>
 *   → this handler rotates the token → redirects back to <path>
 *
 * POST /api/admin/session  — rotate token (returns JSON for programmatic use)
 * GET  /api/admin/session  — rotate + redirect back (used by middleware)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { refreshAndRotateSession, destroySession } from "@/lib/auth-mutations";

// ── POST — called programmatically to rotate token ────────────────────────
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }

  const newToken = await refreshAndRotateSession(session.refreshToken);
  if (!newToken) {
    await destroySession();
    return NextResponse.json({ ok: false, error: "refresh failed" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

// ── GET — called by middleware redirect; rotates then redirects back ───────
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "/dashboard";
  
  console.log('[session-rotation] GET request from:', from);

  const session = await getSession();
  if (!session) {
    console.log('[session-rotation] No session found, redirecting to login');
    return NextResponse.redirect(new URL("/login", req.url));
  }

  console.log('[session-rotation] Attempting to refresh token...');
  const newToken = await refreshAndRotateSession(session.refreshToken);
  if (!newToken) {
    console.log('[session-rotation] Refresh failed, destroying session and redirecting to login');
    await destroySession();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  console.log('[session-rotation] Token refreshed successfully, redirecting back to:', from);
  return NextResponse.redirect(new URL(from, req.url));
}
