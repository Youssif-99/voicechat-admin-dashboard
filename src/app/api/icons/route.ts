/**
 * GET /api/icons
 *
 * Public endpoint consumed by the Flutter app.
 * Returns all enabled, non-deleted icons with ETag support.
 *
 * Caching:
 *   - ETag based on IconCatalogVersion.etag
 *   - 304 Not Modified when client ETag matches
 *   - Cache-Control: public, max-age=60, stale-while-revalidate=300
 *
 * Rate limiting: 120 req/min per IP (Flutter polls every 15 min — very safe margin)
 */

import { NextRequest, NextResponse } from "next/server";
import { IconRepository } from "@/lib/icon-repository";
import { rateLimit, getIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Rate limit — Flutter polls every 15 min, so 120/min is extremely generous
  const ip     = getIp(req.headers);
  const result = rateLimit(ip, { max: 120, windowMs: 60_000 });
  if (!result.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        "Retry-After":       String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Limit": "120",
        "X-RateLimit-Reset": String(result.resetAt),
      },
    });
  }

  try {
    const catalog = await IconRepository.getCatalogVersion();
    const etag    = catalog ? `"${catalog.etag}"` : `"init"`;

    // ETag conditional request — Flutter sends If-None-Match
    const clientETag = req.headers.get("if-none-match");
    if (clientETag && clientETag === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag:            etag,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }

    const icons = await IconRepository.listPublic();

    const payload = {
      etag:      catalog?.etag ?? "init",
      version:   catalog?.version ?? 0,
      updatedAt: new Date().toISOString(),
      icons:     icons.map((icon) => ({
        id:          icon.id,
        key:         icon.key,
        displayName: icon.displayName,
        category:    icon.category,
        type:        icon.type,
        svgUrl:      icon.svgUrl,
        pngUrl:      icon.pngUrl,
        svgHash:     icon.svgHash,
        pngHash:     icon.pngHash,
        version:     icon.version,
        updatedAt:   icon.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        ETag:                           etag,
        "Cache-Control":                "public, max-age=60, stale-while-revalidate=300",
        "Vary":                         "Accept-Encoding",
        "X-RateLimit-Remaining":        String(result.remaining),
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  } catch (err) {
    console.error("[GET /api/icons]", err);
    return NextResponse.json({ error: "فشل جلب الأيقونات" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "If-None-Match, Accept",
    },
  });
}
