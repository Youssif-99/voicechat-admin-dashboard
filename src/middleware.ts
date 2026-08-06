import { NextRequest, NextResponse } from "next/server";
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  hasPermission,
} from "@/lib/auth";
import type { AdminRole } from "@/lib/auth";

// ── Route access rules ─────────────────────────────────────────────────────
// Listed from most restrictive to least. First matching rule wins.

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage  = pathname === "/login";

  // Read session cookie
  const raw     = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await verifySessionToken(raw) : null;

  // ── Unauthenticated ────────────────────────────────────────────────────
  if (!session && !isLoginPage) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // ── Already logged in — skip login page ───────────────────────────────
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
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

  // ── Security headers on every response ───────────────────────────────
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
  // Exclude Next internals, static files, and the public icon API
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons/).*)"],
};
