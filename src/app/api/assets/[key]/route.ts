/**
 * GET /api/assets/:key
 *
 * Returns a single active AppAsset by its key.
 * Used by Flutter when it needs to resolve a specific asset on-demand.
 */

import { NextRequest, NextResponse } from "next/server";
import { AssetRepository } from "@/lib/asset-repository";
import { rateLimit, getIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const ip = getIp(req.headers);
  const rl = rateLimit(ip, { max: 300, windowMs: 60_000 });

  if (!rl.allowed) {
    return new NextResponse(null, { status: 429 });
  }

  const { key } = params;
  if (!key || !/^[a-z0-9_]+$/.test(key)) {
    return NextResponse.json({ error: "مفتاح غير صالح" }, { status: 400 });
  }

  try {
    const asset = await AssetRepository.findByKey(key);

    if (!asset || asset.deletedAt || !asset.isActive) {
      return NextResponse.json({ error: "الأصل غير موجود" }, { status: 404 });
    }

    return NextResponse.json(
      {
        id:          asset.id,
        key:         asset.key,
        name:        asset.name,
        category:    asset.category,
        imageUrl:    asset.imageUrl,
        thumbnailUrl:asset.thumbnailUrl,
        mimeType:    asset.mimeType,
        hash:        asset.hash,
        width:       asset.width,
        height:      asset.height,
        version:     asset.version,
        updatedAt:   asset.updatedAt.toISOString(),
      },
      {
        headers: {
          "Cache-Control":                "public, max-age=60, stale-while-revalidate=300",
          "Access-Control-Allow-Origin":  "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }
    );
  } catch (err) {
    console.error("[GET /api/assets/:key]", err);
    return NextResponse.json({ error: "فشل جلب الأصل" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
