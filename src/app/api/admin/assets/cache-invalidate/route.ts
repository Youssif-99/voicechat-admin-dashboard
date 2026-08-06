/**
 * POST /api/admin/assets/cache-invalidate
 * Force-bumps the AppAssetCatalogVersion ETag.
 * All Flutter clients will re-fetch the full asset catalog on next poll.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AssetRepository } from "@/lib/asset-repository";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { notifyAssetChange } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getIp(req.headers);
  const rl = rateLimit(ip, { max: 20, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });

  const session = await getSession();
  if (!session)                       return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  try {
    const result = await AssetRepository.invalidateCache({
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  ip,
    });
    await notifyAssetChange({ type: "asset:cache_cleared", payload: result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
