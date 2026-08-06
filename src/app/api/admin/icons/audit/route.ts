/**
 * GET /api/admin/icons/audit?iconId=&limit=
 *
 * Returns audit log entries, optionally filtered by iconId.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const iconId = searchParams.get("iconId") ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  const logs = await IconRepository.getAuditLogs(iconId, limit);
  return NextResponse.json({ logs });
}
