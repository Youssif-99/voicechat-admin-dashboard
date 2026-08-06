import { getSession } from "@/lib/auth";
import { roomsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButton } from "@/components/ActionButton";
import { banRoom, unbanRoom, updateRoomProfile, deleteRoom } from "./actions";
import { canDo } from "@/lib/permissions";
import type { AdminRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const session  = await getSession();
  const role     = (session?.role ?? "SUPPORT") as AdminRole;
  const canBan   = canDo(role, "BAN_ROOMS");
  const canDelete = canDo(role, "DELETE_ROOMS");

  const q      = searchParams.q?.trim();
  const status = searchParams.status;
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const { data: rooms, total, pages } = await roomsApi.list({
    q, status, page, pageSize: 30,
  }).catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 30 }));

  return (
    <>
      <Header
        title="إدارة الغرف"
        subtitle={`${total.toLocaleString("en-US")} غرفة`}
        adminName={session?.name || ""}
      />

      <div className="p-8 space-y-6">
        {/* ── Filter bar ──────────────────────────────────────────── */}
        <form className="flex flex-wrap gap-2 items-center" action="/rooms">
          <input name="q" defaultValue={q} placeholder="بحث باسم الغرفة..." className="w-56 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
          <select name="status" defaultValue={status || ""} className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشطة</option>
            <option value="BANNED">محظورة</option>
          </select>
          <button className="text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2">بحث</button>
          {(q || status) && <a href="/rooms" className="text-xs text-text-muted hover:text-danger underline">مسح</a>}
        </form>

        {/* ── Cards grid ──────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rooms.map((r) => (
            <div key={r.id} className="bg-base-surface border border-base-border rounded-card shadow-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-bold truncate">{r.name}</p>
                  <p className="text-text-muted text-xs mt-0.5 truncate">
                    المالك: {r.owner.displayName} (@{r.owner.username})
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
                <span>{r.seatsLimit} مقعد</span>
                <span>·</span>
                <span>{r.type === "PUBLIC" ? "عامة" : "خاصة"}</span>
                {r.activeUsers !== undefined && (
                  <>
                    <span>·</span>
                    <span className="text-success">{r.activeUsers} مباشر</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canBan && (
                  r.status === "ACTIVE" ? (
                    <form action={banRoom}>
                      <input type="hidden" name="id" value={r.id} />
                      <ActionButton variant="danger" confirmMessage="حظر هذه الغرفة؟">حظر</ActionButton>
                    </form>
                  ) : (
                    <form action={unbanRoom}>
                      <input type="hidden" name="id" value={r.id} />
                      <ActionButton variant="success">رفع الحظر</ActionButton>
                    </form>
                  )
                )}

                <details className="relative">
                  <summary className="cursor-pointer list-none text-xs font-medium border rounded-lg px-3 py-1.5 bg-base-surface2 text-text-primary border-base-border hover:bg-base-border">تعديل</summary>
                  <form action={updateRoomProfile} className="absolute z-20 mt-2 w-56 bg-base-surface2 border border-base-border rounded-lg p-3 space-y-2 shadow-card">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="name" defaultValue={r.name} placeholder="اسم الغرفة" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary" />
                    <input name="coverUrl" defaultValue={r.coverUrl || ""} placeholder="رابط صورة الغلاف" dir="ltr" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary placeholder:text-text-muted/50" />
                    <ActionButton variant="gold">حفظ</ActionButton>
                  </form>
                </details>

                {canDelete && (
                  <form action={deleteRoom}>
                    <input type="hidden" name="id" value={r.id} />
                    <ActionButton variant="danger" confirmMessage="حذف الغرفة نهائياً؟">حذف</ActionButton>
                  </form>
                )}
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <p className="text-text-muted col-span-full text-center py-10">لا توجد غرف</p>
          )}
        </div>

        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <a key={p} href={`/rooms?${q ? `q=${encodeURIComponent(q)}&` : ""}${status ? `status=${status}&` : ""}page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted hover:text-text-primary"}`}
              >{p}</a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
