/**
 * POST /api/admin/icons/rollback
 *
 * Body: { iconId: string, targetVersion: number, changeNote?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RollbackSchema = z.object({
  iconId:        z.string().cuid(),
  targetVersion: z.number().int().positive(),
  changeNote:    z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = RollbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة", details: parsed.error.flatten() }, { status: 422 });
    }

    const audit = {
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    };

    const icon = await IconRepository.rollback(
      parsed.data.iconId,
      parsed.data.targetVersion,
      audit
    );

    return NextResponse.json({ icon, message: `تم الرجوع إلى الإصدار ${parsed.data.targetVersion} بنجاح` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطأ داخلي";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
