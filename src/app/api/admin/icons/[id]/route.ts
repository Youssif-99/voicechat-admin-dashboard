/**
 * GET    /api/admin/icons/:id  — Get single icon with version history
 * PUT    /api/admin/icons/:id  — Replace / update icon files and metadata
 * DELETE /api/admin/icons/:id  — Soft-delete icon
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { uploadIcon, deleteIcon } from "@/lib/storage";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function requireAdmin(req: NextRequest) {
  const session = await getSession();
  if (!session) return { error: "غير مصرح", status: 401 };
  if (session.role !== "SUPER_ADMIN") return { error: "مخصص للسوبر أدمن فقط", status: 403 };
  return {
    session,
    audit: {
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown",
      userAgent:  req.headers.get("user-agent") ?? undefined,
    },
  };
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const icon = await IconRepository.findById(params.id);
  if (!icon) return NextResponse.json({ error: "الأيقونة غير موجودة" }, { status: 404 });

  const auditLogs = await IconRepository.getAuditLogs(params.id, 50);
  return NextResponse.json({ icon, auditLogs });
}

// ── PUT ────────────────────────────────────────────────────────────────────

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  category:    z.string().min(1).max(60).optional(),
  type:        z.enum(["svg", "png", "both"]).optional(),
  changeNote:  z.string().max(300).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const existing = await IconRepository.findById(params.id);
    if (!existing) return NextResponse.json({ error: "الأيقونة غير موجودة" }, { status: 404 });

    const formData = await req.formData();

    const parsed = UpdateSchema.safeParse({
      displayName: formData.get("displayName") ?? undefined,
      category:    formData.get("category")    ?? undefined,
      type:        formData.get("type")         ?? undefined,
      changeNote:  formData.get("changeNote")   ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    let svgUrl  = existing.svgUrl  ?? undefined;
    let pngUrl  = existing.pngUrl  ?? undefined;
    let svgHash = existing.svgHash ?? undefined;
    let pngHash = existing.pngHash ?? undefined;

    const svgFile = formData.get("svg") as File | null;
    const pngFile = formData.get("png") as File | null;

    // Replace SVG — delete old file first
    if (svgFile && svgFile.size > 0) {
      if (existing.svgUrl) await deleteIcon(existing.svgUrl);
      const buf = Buffer.from(await svgFile.arrayBuffer());
      const result = await uploadIcon(buf, svgFile.name);
      svgUrl  = result.url;
      svgHash = result.hash;
    }

    // Replace PNG
    if (pngFile && pngFile.size > 0) {
      if (existing.pngUrl) await deleteIcon(existing.pngUrl);
      const buf = Buffer.from(await pngFile.arrayBuffer());
      const result = await uploadIcon(buf, pngFile.name);
      pngUrl  = result.url;
      pngHash = result.hash;
    }

    const icon = await IconRepository.update(
      params.id,
      { ...parsed.data, svgUrl, pngUrl, svgHash, pngHash },
      auth.audit
    );

    return NextResponse.json({ icon });
  } catch (err) {
    console.error("[PUT /api/admin/icons/:id]", err);
    const message = err instanceof Error ? err.message : "خطأ داخلي";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const icon = await IconRepository.softDelete(params.id, auth.audit);
    return NextResponse.json({ icon, message: "تم الحذف بنجاح" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطأ داخلي";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
