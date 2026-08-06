/**
 * GET /api/assets
 *
 * Public endpoint consumed by the Flutter AssetService.
 * Returns all active, non-deleted AppAssets with ETag support.
 *
 * Caching:
 *   - ETag based on AppAssetCatalogVersion.etag
 *   - 304 Not Modified when client ETag matches (If-None-Match header)
 *   - Cache-Control: public, max-age=60, stale-while-revalidate=300
 *
 * Rate limiting: 120 req/min per IP
 * CORS: open — Flutter app is a native client, not a browser
 */

import { NextRequest, NextResponse } from "next/server";
import { AssetRepository } from "@/lib/asset-repository";
import { rateLimit, getIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip     = getIp(req.headers);
  const rl     = rateLimit(ip, { max: 120, windowMs: 60_000 });

  if (!rl.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        "Retry-After":       String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Limit": "120",
        "X-RateLimit-Reset": String(rl.resetAt),
      },
    });
  }

  try {
    const catalog = await AssetRepository.getCatalogVersion();
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

    const assets = await AssetRepository.listPublic();

    const payload = {
      etag:      catalog?.etag      ?? "init",
      version:   catalog?.version   ?? 0,
      updatedAt: new Date().toISOString(),
      assets: assets.map((a) => ({
        id:          a.id,
        key:         a.key,
        name:        a.name,
        category:    a.category,
        imageUrl:    a.imageUrl,
        thumbnailUrl:a.thumbnailUrl,
        mimeType:    a.mimeType,
        hash:        a.hash,
        width:       a.width,
        height:      a.height,
        version:     a.version,
        updatedAt:   a.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        ETag:                           etag,
        "Cache-Control":                "public, max-age=60, stale-while-revalidate=300",
        Vary:                           "Accept-Encoding",
        "X-RateLimit-Remaining":        String(rl.remaining),
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  } catch (err) {
    console.error("[GET /api/assets]", err);
    return NextResponse.json({ error: "فشل جلب الأصول" }, { status: 500 });
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
