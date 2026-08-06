/**
 * POST /api/admin/icons/cache-invalidate
 *
 * Bumps IconCatalogVersion, generating a new ETag.
 * Flutter clients will detect the changed ETag on next poll and re-download.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "مخصص للسوبر أدمن فقط" }, { status: 403 });

  try {
    const result = await IconRepository.invalidateCache({
      adminId:    session.adminId,
      adminName:  session.name,
      adminEmail: session.email,
      ipAddress:  req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    });
    return NextResponse.json({
      ...result,
      message: "تم مسح الكاش بنجاح. سيقوم تطبيق Flutter بتحديث الأيقونات عند الطلب التالي.",
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
