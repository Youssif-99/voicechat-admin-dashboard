/**
 * POST /api/admin/icons/bulk
 *
 * Bulk-upload multiple icons in one multipart request.
 *
 * FormData fields:
 *   meta        — JSON string: Array<{ key, displayName, category, type, changeNote? }>
 *   svg_{key}   — SVG file for icon with that key (optional)
 *   png_{key}   — PNG file for icon with that key (optional)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { uploadIcon } from "@/lib/storage";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MetaItemSchema = z.object({
  key:         z.string().min(3).max(100).regex(/^[a-z0-9_.]+$/),
  displayName: z.string().min(1).max(120),
  category:    z.string().min(1).max(60),
  type:        z.enum(["svg", "png", "both"]),
  changeNote:  z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  const audit = {
    adminId:    session.adminId,
    adminName:  session.name,
    adminEmail: session.email,
    ipAddress:  req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
  };

  try {
    const formData = await req.formData();
    const metaRaw = formData.get("meta") as string | null;
    if (!metaRaw) {
      return NextResponse.json({ error: "حقل meta مطلوب" }, { status: 422 });
    }

    let metaArray: unknown[];
    try {
      metaArray = JSON.parse(metaRaw);
    } catch {
      return NextResponse.json({ error: "meta ليس JSON صالحًا" }, { status: 422 });
    }

    if (!Array.isArray(metaArray) || metaArray.length === 0) {
      return NextResponse.json({ error: "meta يجب أن يكون مصفوفة غير فارغة" }, { status: 422 });
    }

    if (metaArray.length > 100) {
      return NextResponse.json({ error: "الحد الأقصى 100 أيقونة في طلب واحد" }, { status: 422 });
    }

    // Validate all metadata items first
    const validated: z.infer<typeof MetaItemSchema>[] = [];
    const validationErrors: string[] = [];

    for (const item of metaArray) {
      const r = MetaItemSchema.safeParse(item);
      if (!r.success) {
        validationErrors.push(`${(item as Record<string, unknown>)?.key ?? "?"}: ${JSON.stringify(r.error.flatten())}`);
      } else {
        validated.push(r.data);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "أخطاء في التحقق", details: validationErrors }, { status: 422 });
    }

    // Upload files and build CreateIconInput[]
    const inputs = [];
    const uploadErrors: string[] = [];

    for (const meta of validated) {
      try {
        let svgUrl: string | undefined;
        let pngUrl: string | undefined;
        let svgHash: string | undefined;
        let pngHash: string | undefined;

        const svgFile = formData.get(`svg_${meta.key}`) as File | null;
        const pngFile = formData.get(`png_${meta.key}`) as File | null;

        if (svgFile && svgFile.size > 0) {
          const buf    = Buffer.from(await svgFile.arrayBuffer());
          const result = await uploadIcon(buf, svgFile.name);
          if (!result.success) {
            uploadErrors.push(`${meta.key} (svg): ${result.error}`);
            continue;
          }
          svgUrl = result.data.url; svgHash = result.data.hash;
        }
        if (pngFile && pngFile.size > 0) {
          const buf    = Buffer.from(await pngFile.arrayBuffer());
          const result = await uploadIcon(buf, pngFile.name);
          if (!result.success) {
            uploadErrors.push(`${meta.key} (png): ${result.error}`);
            continue;
          }
          pngUrl = result.data.url; pngHash = result.data.hash;
        }

        inputs.push({ ...meta, svgUrl, pngUrl, svgHash, pngHash });
      } catch (e) {
        uploadErrors.push(`${meta.key}: ${(e as Error).message}`);
      }
    }

    const result = await IconRepository.bulkCreate(inputs, audit);

    return NextResponse.json({
      ...result,
      uploadErrors,
      message: `تم الرفع بنجاح: ${result.created} أيقونة، تجاهل: ${result.skipped}`,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/icons/bulk]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
