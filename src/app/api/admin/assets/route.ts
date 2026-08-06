/**
 * GET  /api/admin/assets  — Admin list: filtering, pagination, sorting, search
 * POST /api/admin/assets  — Create a new AppAsset with optional file upload
 *
 * Auth: SUPER_ADMIN only
 * Rate limit: 60 req/min per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AssetRepository } from "@/lib/asset-repository";
import { uploadAsset } from "@/lib/asset-storage";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { notifyAssetChange } from "@/lib/notify";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── Shared auth + rate-limit guard ─────────────────────────────────────────

async function requireSuperAdmin(req: NextRequest) {
  const ip = getIp(req.headers);
  const rl = rateLimit(ip, { max: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return {
      error:   "طلبات كثيرة — يرجى الانتظار دقيقة",
      status:  429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    };
  }
  const session = await getSession();
  if (!session)                         return { error: "غير مصرح",              status: 401 };
  if (session.role !== "SUPER_ADMIN")   return { error: "مخصص للسوبر أدمن فقط", status: 403 };

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

// ── GET /api/admin/assets ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.headers) Object.entries(auth.headers).forEach(([k, v]) => res.headers.set(k, v));
    return sec(res);
  }

  const sp = req.nextUrl.searchParams;
  const filter = {
    category:       sp.get("category")       ?? undefined,
    search:         sp.get("q")              ?? undefined,
    isActive:       sp.has("isActive")       ? sp.get("isActive") === "true" : undefined,
    includeDeleted: sp.get("includeDeleted") === "true",
    page:           parseInt(sp.get("page")     ?? "1",  10),
    pageSize:       Math.min(parseInt(sp.get("pageSize") ?? "50", 10), 200),
    sortBy:         (sp.get("sortBy")  ?? "updatedAt") as "name" | "category" | "updatedAt" | "version",
    sortDir:        (sp.get("sortDir") ?? "desc")      as "asc" | "desc",
  };

  try {
    const [{ assets, total }, catalog] = await Promise.all([
      AssetRepository.listAdmin(filter),
      AssetRepository.getCatalogVersion(),
    ]);
    return sec(NextResponse.json({
      assets,
      total,
      page:           filter.page,
      pageSize:       filter.pageSize,
      pages:          Math.ceil(total / filter.pageSize),
      catalogEtag:    catalog?.etag,
      catalogVersion: catalog?.version,
    }));
  } catch (err) {
    console.error("[GET /api/admin/assets]", err);
    return sec(NextResponse.json({ error: "فشل جلب الأصول" }, { status: 500 }));
  }
}

// ── POST /api/admin/assets ─────────────────────────────────────────────────

const CreateSchema = z.object({
  key:        z.string().min(2).max(80).regex(/^[a-z0-9_]+$/, "المفتاح: أحرف صغيرة وأرقام وشرطة سفلية فقط"),
  name:       z.string().min(1).max(120),
  category:   z.string().min(1).max(60),
  changeNote: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if ("error" in auth) {
    return sec(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  try {
    const formData = await req.formData();
    const parsed   = CreateSchema.safeParse({
      key:        formData.get("key"),
      name:       formData.get("name"),
      category:   formData.get("category"),
      changeNote: formData.get("changeNote") ?? undefined,
    });

    if (!parsed.success) {
      return sec(NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 422 }
      ));
    }

    // Duplicate key check
    const existing = await AssetRepository.findByKey(parsed.data.key);
    if (existing && !existing.deletedAt) {
      return sec(NextResponse.json(
        { error: `المفتاح "${parsed.data.key}" مستخدم بالفعل` },
        { status: 409 }
      ));
    }

    // Handle file upload
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let mimeType: string | undefined;
    let hash: string | undefined;
    let sizeBytes: number | undefined;
    let width: number | undefined;
    let height: number | undefined;

    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const result = await uploadAsset(Buffer.from(await file.arrayBuffer()), file.name);
      imageUrl    = result.imageUrl;
      thumbnailUrl = result.thumbnailUrl;
      mimeType    = result.mimeType;
      hash        = result.hash;
      sizeBytes   = result.sizeBytes;
      width       = result.width;
      height      = result.height;
    }

    const asset = await AssetRepository.create(
      { ...parsed.data, imageUrl, thumbnailUrl, mimeType, hash, sizeBytes, width, height },
      auth.audit
    );

    await notifyAssetChange({
      type:    "asset:created",
      payload: { assetId: asset.id, key: asset.key, category: asset.category },
    });

    return sec(NextResponse.json({ asset }, { status: 201 }));
  } catch (err) {
    console.error("[POST /api/admin/assets]", err);
    return sec(NextResponse.json({ error: (err as Error).message }, { status: 500 }));
  }
}
