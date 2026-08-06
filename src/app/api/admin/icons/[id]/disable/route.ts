/**
 * PATCH /api/admin/icons/:id/disable
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  try {
    const icon = await IconRepository.setEnabled(params.id, false, {
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    });
    return NextResponse.json({ icon });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
