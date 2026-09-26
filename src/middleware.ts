import { NextRequest, NextResponse } from "next/server";
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  hasPermission,
} from "@/lib/auth";
import type { AdminRole } from "@/lib/auth";

// ── Route access rules ─────────────────────────────────────────────────────

const ROUTE_RULES: Array<{ pattern: RegExp; minRole: AdminRole }> = [
  { pattern: /^\/icons/,         minRole: "SUPER_ADMIN" },
  { pattern: /^\/admins/,        minRole: "SUPER_ADMIN" },
  { pattern: /^\/settings/,      minRole: "ADMIN"       },
  { pattern: /^\/payments/,      minRole: "ADMIN"       },
  { pattern: /^\/banners/,       minRole: "ADMIN"       },
  { pattern: /^\/store/,         minRole: "ADMIN"       },
  { pattern: /^\/gifts/,         minRole: "ADMIN"       },
  { pattern: /^\/vip/,           minRole: "ADMIN"       },
  { pattern: /^\/wallet/,        minRole: "ADMIN"       },
  { pattern: /^\/notifications/, minRole: "ADMIN"       },
  { pattern: /^\/moments/,       minRole: "MODERATOR"   },
  { pattern: /^\/reports/,       minRole: "SUPPORT"     },
  { pattern: /^\/users/,         minRole: "SUPPORT"     },
  { pattern: /^\/rooms/,         minRole: "SUPPORT"     },
  { pattern: /^\/agencies/,      minRole: "SUPPORT"     },
  { pattern: /^\/dashboard/,     minRole: "SUPPORT"     },
];

// ── How many seconds before JWT expiry to proactively rotate ──────────────
// Access tokens live 15 min (900 s). Rotate when less than 3 min remain.
const REFRESH_THRESHOLD_SECONDS = 180;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  
  // ── CRITICAL: Exclude session rotation endpoint from middleware ────────
  // The session rotation endpoint (/api/admin/session) MUST NOT be intercepted
  // by the token expiry logic, or it creates an infinite redirect loop.
  if (pathname === "/api/admin/session") {
    console.log('[middleware] Skipping token check for session rotation endpoint');
    return NextResponse.next();
  }

  // ── Skip middleware for Server Action requests ─────────────────────────
  // Next.js Server Actions POST to the same URL as the page with the special
  // "Next-Action" header. The middleware must NOT redirect these requests —
  // the action runs server-side and handles its own auth/redirect logic.
  // Without this check, submitting the login form causes the middleware to
  // intercept the POST and redirect to /dashboard (if a stale session cookie
  // exists) or /login (if unauthenticated), so the action never executes.
  if (req.method === "POST" && req.headers.get("Next-Action")) {
    return NextResponse.next();
  }

  // Read session cookie
  const raw     = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await verifySessionToken(raw) : null;

  // ── Unauthenticated → login ────────────────────────────────────────────
  if (!session && !isLoginPage) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // ── Already logged in → skip login page ───────────────────────────────
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── Proactive token rotation ───────────────────────────────────────────
  // CRITICAL FIX: Check the Express accessToken expiry, NOT the session wrapper!
  // The session cookie wraps an Express JWT that expires in 15min, while the
  // session wrapper expires in 7d. We must validate the INNER token.
  if (session) {
    // Decode the Express accessToken (without verification — we just need exp claim)
    try {
      const tokenParts = session.accessToken.split('.');
      if (tokenParts.length === 3) {
        // Edge Runtime compatible base64 decode
        const base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = base64Payload + '==='.substring(0, (4 - (base64Payload.length % 4)) % 4);
        const payloadJson = atob(paddedPayload);
        const payload = JSON.parse(payloadJson);
        
        const expiry = (payload.exp ?? 0) * 1000; // ms
        const msLeft = expiry - Date.now();
        const secLeft = msLeft / 1000;

        if (secLeft <= 0) {
          // Express token has expired — rotate via Route Handler
          console.log('[middleware] Token expired (', Math.floor(secLeft), 's), redirecting to session rotation from:', pathname);
          const rotateUrl = new URL("/api/admin/session", req.url);
          rotateUrl.searchParams.set("from", pathname);
          return NextResponse.redirect(rotateUrl);
        }

        if (secLeft > 0 && secLeft < REFRESH_THRESHOLD_SECONDS) {
          // Token is valid but near expiry — rotate it via Route Handler
          console.log('[middleware] Token near expiry (', Math.floor(secLeft), 's remaining), redirecting to session rotation from:', pathname);
          const rotateUrl = new URL("/api/admin/session", req.url);
          rotateUrl.searchParams.set("from", pathname);
          return NextResponse.redirect(rotateUrl);
        }
      }
    } catch (err) {
      // If we can't decode the token, it's invalid — go to login
      console.error('[middleware] Failed to decode accessToken:', err);
      const url = new URL("/login", req.url);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── Role-based access control ──────────────────────────────────────────
  if (session) {
    for (const rule of ROUTE_RULES) {
      if (rule.pattern.test(pathname)) {
        if (!hasPermission(session.role, rule.minRole)) {
          const url = new URL("/dashboard", req.url);
          url.searchParams.set("denied", "1");
          return NextResponse.redirect(url);
        }
        break;
      }
    }
  }

  // ── Security headers on every response ────────────────────────────────
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options",  "nosniff");
  res.headers.set("X-Frame-Options",         "DENY");
  res.headers.set("X-XSS-Protection",        "1; mode=block");
  res.headers.set("Referrer-Policy",         "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  return res;
}

export const config = {
  // Exclude Next internals, static files, and public/backend API routes.
  // 
  // Excluded routes:
  //   - _next/static, _next/image, favicon.ico — Next.js internals
  //   - icons/.*\\. — static icon files (e.g., /icons/nav-home.png)
  //   - api/icons, api/assets — Dashboard public APIs
  //   - api/auth, api/users, api/rooms, etc. — Backend APIs (proxied via rewrites)
  // 
  // The middleware ONLY runs on:
  //   - Dashboard pages: /login, /dashboard, /icons, /admins, etc.
  //   - Dashboard admin APIs: /api/admin/*
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|health|icons/.*\\.|api/icons|api/assets|api/auth|api/users|api/rooms|api/banners|api/gifts|api/coins|api/wallet|api/rankings|api/vip|api/shop|api/rewards|api/notifications|api/follow|api/posts|api/loyalty|api/chat|api/settings|api/agents|api/hosts|api/agent|api/payment|api/moderation|api/recordings|api/agency-types|api/financial|api/hierarchy|api/recharge).*)"
  ],
};
