/**
 * GET  /api/admin/icons  — Admin list with filtering & pagination
 * POST /api/admin/icons  — Create / upload a single icon
 *
 * Rate limited: 60 req/min per IP (admin operations)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { uploadIcon } from "@/lib/storage";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── Security helpers ───────────────────────────────────────────────────────

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

async function requireAdmin(req: NextRequest) {
  // Rate limit
  const ip  = getIp(req.headers);
  const rl  = rateLimit(ip, { max: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return {
      error: "طلبات كثيرة — يرجى الانتظار دقيقة",
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    };
  }

  const session = await getSession();
  if (!session) return { error: "غير مصرح", status: 401 };
  if (session.role !== "SUPER_ADMIN") return { error: "مخصص للسوبر أدمن فقط", status: 403 };

  const audit = {
    adminId:    session.adminId,
    adminName:  session.name,
    adminEmail: session.email,
    ipAddress:  ip,
    userAgent:  req.headers.get("user-agent") ?? undefined,
  };
  return { session, audit };
}

// ── GET /api/admin/icons ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.headers) Object.entries(auth.headers).forEach(([k, v]) => res.headers.set(k, v));
    return applySecurityHeaders(res);
  }

  const { searchParams } = req.nextUrl;
  const filter = {
    category:       searchParams.get("category") ?? undefined,
    search:         searchParams.get("q")         ?? undefined,
    enabled:        searchParams.has("enabled")
      ? searchParams.get("enabled") === "true"
      : undefined,
    includeDeleted: searchParams.get("includeDeleted") === "true",
    page:           parseInt(searchParams.get("page")     ?? "1",  10),
    pageSize:       Math.min(parseInt(searchParams.get("pageSize") ?? "50", 10), 200),
  };

  try {
    const { icons, total } = await IconRepository.listAdmin(filter);
    const catalog          = await IconRepository.getCatalogVersion();
    return applySecurityHeaders(NextResponse.json({
      icons, total,
      page:           filter.page,
      pageSize:       filter.pageSize,
      pages:          Math.ceil(total / filter.pageSize),
      catalogEtag:    catalog?.etag,
      catalogVersion: catalog?.version,
    }));
  } catch (err) {
    console.error("[GET /api/admin/icons]", err);
    return applySecurityHeaders(
      NextResponse.json({ error: "فشل جلب الأيقونات" }, { status: 500 })
    );
  }
}

// ── POST /api/admin/icons ──────────────────────────────────────────────────

const CreateSchema = z.object({
  key:         z.string().min(3).max(100).regex(/^[a-z0-9_.]+$/),
  displayName: z.string().min(1).max(120),
  category:    z.string().min(1).max(60),
  type:        z.enum(["svg", "png", "both"]),
  changeNote:  z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return applySecurityHeaders(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  try {
    const formData = await req.formData();
    const parsed   = CreateSchema.safeParse({
      key:         formData.get("key"),
      displayName: formData.get("displayName"),
      category:    formData.get("category"),
      type:        formData.get("type"),
      changeNote:  formData.get("changeNote") ?? undefined,
    });

    if (!parsed.success) {
      return applySecurityHeaders(
        NextResponse.json({ error: "بيانات غير صالحة", details: parsed.error.flatten() }, { status: 422 })
      );
    }

    // Duplicate key check
    const existing = await IconRepository.findByKey(parsed.data.key);
    if (existing && !existing.deletedAt) {
      return applySecurityHeaders(
        NextResponse.json({ error: `المفتاح "${parsed.data.key}" مستخدم بالفعل` }, { status: 409 })
      );
    }

    let svgUrl: string | undefined, pngUrl: string | undefined;
    let svgHash: string | undefined, pngHash: string | undefined;

    const svgFile = formData.get("svg") as File | null;
    const pngFile = formData.get("png") as File | null;

    if (svgFile && svgFile.size > 0) {
      const r = await uploadIcon(Buffer.from(await svgFile.arrayBuffer()), svgFile.name);
      svgUrl = r.url; svgHash = r.hash;
    }
    if (pngFile && pngFile.size > 0) {
      const r = await uploadIcon(Buffer.from(await pngFile.arrayBuffer()), pngFile.name);
      pngUrl = r.url; pngHash = r.hash;
    }

    const icon = await IconRepository.create(
      { ...parsed.data, svgUrl, pngUrl, svgHash, pngHash },
      auth.audit
    );

    return applySecurityHeaders(NextResponse.json({ icon }, { status: 201 }));
  } catch (err) {
    console.error("[POST /api/admin/icons]", err);
    return applySecurityHeaders(
      NextResponse.json({ error: (err as Error).message }, { status: 500 })
    );
  }
}
