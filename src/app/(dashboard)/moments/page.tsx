import { getSession } from "@/lib/auth";
import { momentsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionButton } from "@/components/ActionButton";
import { canDo } from "@/lib/permissions";
import type { AdminRole } from "@/lib/auth";
import { hideMoment, restoreMoment, deleteMoment } from "./actions";

export const dynamic = "force-dynamic";

export default async function MomentsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string };
}) {
  const session  = await getSession();
  const role     = (session?.role ?? "SUPPORT") as AdminRole;
  const canMod   = canDo(role, "MODERATE_MOMENTS");

  const status = searchParams.status;
  const q      = searchParams.q?.trim();
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const { data: moments, total, pages } = await momentsApi.list({
    status, q, page, pageSize: 30,
  }).catch(() => ({ data: [], total: 0, pages: 1, page: 1, pageSize: 30 }));

  const STATUS_TABS = [
    { key: undefined, label: "الكل"     },
    { key: "ACTIVE",  label: "نشطة"     },
    { key: "HIDDEN",  label: "مخفية"    },
    { key: "REPORTED",label: "مبلّغ عنها"},
  ];

  return (
    <>
      <Header title="اللحظات" subtitle={`${total.toLocaleString("en-US")} لحظة`} adminName={session?.name || ""} />

      <div className="p-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((t) => (
            <a key={t.label} href={t.key ? `/moments?status=${t.key}` : "/moments"}
              className={`text-sm px-3 py-1.5 rounded-lg border transition ${status === t.key ? "bg-gold/10 text-gold border-gold/30" : "text-text-muted border-base-border hover:text-text-primary"}`}>
              {t.label}
            </a>
          ))}
        </div>

        {/* Search */}
        <form className="flex gap-2" action="/moments">
          <input name="q" defaultValue={q} placeholder="بحث بالمحتوى أو اسم المستخدم..." className="w-64 rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
          {status && <input type="hidden" name="status" value={status} />}
          <button className="text-sm bg-gold text-base-bg font-bold rounded-lg px-4 py-2">بحث</button>
        </form>

        {/* Grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {moments.map((m) => (
            <div key={m.id} className="bg-base-surface border border-base-border rounded-card shadow-card overflow-hidden">
              {/* Media preview */}
              {m.mediaUrl && m.mediaType === "IMAGE" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.mediaUrl} alt="moment" className="w-full h-40 object-cover" />
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium text-sm truncate">
                      {m.user.displayName}
                    </p>
                    <p className="text-text-muted text-xs" dir="ltr">@{m.user.username}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                {m.content && (
                  <p className="text-text-muted text-xs line-clamp-3">{m.content}</p>
                )}

                <div className="flex gap-4 text-xs text-text-muted">
                  <span>❤ {m.likesCount}</span>
                  <span>💬 {m.commentsCount}</span>
                  {m.reportsCount > 0 && (
                    <span className="text-danger font-medium">⚑ {m.reportsCount} بلاغات</span>
                  )}
                </div>

                <p className="text-[10px] text-text-muted/70">
                  {new Date(m.createdAt).toLocaleString("ar-EG")}
                </p>

                {canMod && (
                  <div className="flex gap-2">
                    {m.status === "ACTIVE" || m.status === "REPORTED" ? (
                      <form action={hideMoment}>
                        <input type="hidden" name="id" value={m.id} />
                        <ActionButton variant="danger">إخفاء</ActionButton>
                      </form>
                    ) : (
                      <form action={restoreMoment}>
                        <input type="hidden" name="id" value={m.id} />
                        <ActionButton variant="success">استعادة</ActionButton>
                      </form>
                    )}
                    <form action={deleteMoment}>
                      <input type="hidden" name="id" value={m.id} />
                      <ActionButton variant="danger" confirmMessage="حذف هذه اللحظة نهائياً؟">حذف</ActionButton>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
          {moments.length === 0 && (
            <p className="text-text-muted col-span-full text-center py-10">لا توجد لحظات</p>
          )}
        </div>

        {pages > 1 && (
          <div className="flex gap-1 justify-center">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <a key={p} href={`/moments?${status ? `status=${status}&` : ""}page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-gold text-base-bg font-bold" : "bg-base-surface2 text-text-muted"}`}>{p}</a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
