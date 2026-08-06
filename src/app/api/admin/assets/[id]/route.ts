/**
 * GET    /api/admin/assets/:id  — Fetch single asset with version history
 * PUT    /api/admin/assets/:id  — Replace file + update metadata
 * DELETE /api/admin/assets/:id  — Soft delete
 *
 * Plus sub-actions via query param ?action=restore|enable|disable|rollback
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AssetRepository } from "@/lib/asset-repository";
import { uploadAsset, deleteAsset } from "@/lib/asset-storage";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { notifyAssetChange } from "@/lib/notify";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireSuperAdmin(req: NextRequest) {
  const ip = getIp(req.headers);
  const rl = rateLimit(ip, { max: 60, windowMs: 60_000 });
  if (!rl.allowed) return { error: "طلبات كثيرة", status: 429 };
  const session = await getSession();
  if (!session)                       return { error: "غير مصرح",              status: 401 };
  if (session.role !== "SUPER_ADMIN") return { error: "مخصص للسوبر أدمن فقط", status: 403 };
  return {
    audit: {
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  ip,
      userAgent:  req.headers.get("user-agent") ?? undefined,
    },
  };
}

function sec(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

// ── GET /api/admin/assets/:id ──────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return sec(NextResponse.json({ error: auth.error }, { status: auth.status }));

  try {
    const asset = await AssetRepository.findById(params.id);
    if (!asset) return sec(NextResponse.json({ error: "الأصل غير موجود" }, { status: 404 }));
    return sec(NextResponse.json({ asset }));
  } catch (err) {
    return sec(NextResponse.json({ error: (err as Error).message }, { status: 500 }));
  }
}

// ── PUT /api/admin/assets/:id ──────────────────────────────────────────────

const UpdateSchema = z.object({
  name:          z.string().min(1).max(120).optional(),
  category:      z.string().min(1).max(60).optional(),
  isActive:      z.coerce.boolean().optional(),
  changeNote:    z.string().max(300).optional(),
  targetVersion: z.coerce.number().int().positive().optional(), // for rollback
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return sec(NextResponse.json({ error: auth.error }, { status: auth.status }));

  const action = req.nextUrl.searchParams.get("action");

  try {
    // ── Restore ────────────────────────────────────────────────
    if (action === "restore") {
      const asset = await AssetRepository.restore(params.id, auth.audit);
      await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
      return sec(NextResponse.json({ asset }));
    }

    // ── Enable / Disable ───────────────────────────────────────
    if (action === "enable" || action === "disable") {
      const asset = await AssetRepository.setActive(params.id, action === "enable", auth.audit);
      await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
      return sec(NextResponse.json({ asset }));
    }

    // ── Rollback ───────────────────────────────────────────────
    if (action === "rollback") {
      const body = await req.json() as { targetVersion?: number };
      const tv = Number(body.targetVersion);
      if (!tv || tv < 1) return sec(NextResponse.json({ error: "targetVersion مطلوب" }, { status: 422 }));
      const asset = await AssetRepository.rollback(params.id, tv, auth.audit);
      await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
      return sec(NextResponse.json({ asset }));
    }

    // ── Standard Update (multipart) ────────────────────────────
    const formData = await req.formData();
    const parsed   = UpdateSchema.safeParse({
      name:       formData.get("name")       ?? undefined,
      category:   formData.get("category")   ?? undefined,
      isActive:   formData.get("isActive")   ?? undefined,
      changeNote: formData.get("changeNote") ?? undefined,
    });

    if (!parsed.success) {
      return sec(NextResponse.json({ error: "بيانات غير صالحة", details: parsed.error.flatten() }, { status: 422 }));
    }

    const existing = await AssetRepository.findById(params.id);
    if (!existing) return sec(NextResponse.json({ error: "الأصل غير موجود" }, { status: 404 }));

    let imageUrl     = existing.imageUrl     ?? undefined;
    let thumbnailUrl = existing.thumbnailUrl ?? undefined;
    let mimeType     = existing.mimeType     ?? undefined;
    let hash         = existing.hash         ?? undefined;
    let sizeBytes    = existing.sizeBytes    ?? undefined;
    let width        = existing.width        ?? undefined;
    let height       = existing.height       ?? undefined;

    // Handle file replacement
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      // Delete old files first
      await deleteAsset(existing.imageUrl, existing.thumbnailUrl);
      const result = await uploadAsset(Buffer.from(await file.arrayBuffer()), file.name);
      imageUrl     = result.imageUrl;
      thumbnailUrl = result.thumbnailUrl;
      mimeType     = result.mimeType;
      hash         = result.hash;
      sizeBytes    = result.sizeBytes;
      width        = result.width;
      height       = result.height;
    }

    const asset = await AssetRepository.update(
      params.id,
      { ...parsed.data, imageUrl, thumbnailUrl, mimeType, hash, sizeBytes, width, height },
      auth.audit
    );

    await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
    return sec(NextResponse.json({ asset }));
  } catch (err) {
    console.error("[PUT /api/admin/assets/:id]", err);
    return sec(NextResponse.json({ error: (err as Error).message }, { status: 500 }));
  }
}

// ── DELETE /api/admin/assets/:id ──────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) return sec(NextResponse.json({ error: auth.error }, { status: auth.status }));

  try {
    const asset = await AssetRepository.softDelete(params.id, auth.audit);
    await notifyAssetChange({ type: "asset:deleted", payload: { assetId: asset.id, key: asset.key } });
    return sec(NextResponse.json({ asset }));
  } catch (err) {
    return sec(NextResponse.json({ error: (err as Error).message }, { status: 500 }));
  }
}
