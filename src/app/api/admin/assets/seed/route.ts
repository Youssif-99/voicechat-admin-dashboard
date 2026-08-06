/**
 * POST /api/admin/assets/seed
 * Seeds all ASSET_DEFINITIONS as AppAsset records (skips existing keys).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AssetRepository } from "@/lib/asset-repository";
import { ASSET_DEFINITIONS } from "@/lib/asset-definitions";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { notifyAssetChange } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getIp(req.headers);
  const rl = rateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const session = await getSession();
  if (!session)                       return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  try {
    const result = await AssetRepository.seedDefaults(ASSET_DEFINITIONS, {
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  ip,
    });

    await notifyAssetChange({
      type:    "asset:cache_cleared",
      payload: { version: 0, etag: "seed" },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
