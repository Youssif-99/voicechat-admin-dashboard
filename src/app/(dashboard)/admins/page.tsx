import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { adminsApi } from "@/lib/api-client";
import { Header } from "@/components/Header";
import { ActionButton } from "@/components/ActionButton";
import { createAdmin, deleteAdmin, updateAdminRole, resetAdminPassword } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "سوبر أدمن",
  ADMIN:       "أدمن",
  MODERATOR:   "مشرف محتوى",
  SUPPORT:     "دعم فني",
};

export default async function AdminsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard?denied=1");

  const admins = await adminsApi.list()
    .catch(() => [] as Awaited<ReturnType<typeof adminsApi.list>>);

  return (
    <>
      <Header title="المشرفون" subtitle="إدارة حسابات الفريق" adminName={session.name} />

      <div className="p-8 space-y-6">
        {/* ── Create form ─────────────────────────────────────────── */}
        <details className="bg-base-surface border border-base-border rounded-card shadow-card">
          <summary className="cursor-pointer px-6 py-4 font-display font-bold text-text-primary list-none">
            + إضافة مشرف جديد
          </summary>
          <form action={createAdmin} className="px-6 pb-6 grid md:grid-cols-4 gap-3">
            <input name="name" required placeholder="الاسم" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="email" type="email" required dir="ltr" placeholder="البريد الإلكتروني" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <input name="password" type="password" required minLength={6} dir="ltr" placeholder="كلمة المرور (6+ أحرف)" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50" />
            <select name="role" className="rounded-lg bg-base-surface2 border border-base-border px-3 py-2 text-sm text-text-primary">
              <option value="SUPPORT">دعم فني</option>
              <option value="MODERATOR">مشرف محتوى</option>
              <option value="ADMIN">أدمن</option>
              <option value="SUPER_ADMIN">سوبر أدمن</option>
            </select>
            <button type="submit" className="md:col-span-4 bg-gold text-base-bg font-bold rounded-lg py-2 text-sm">إضافة المشرف</button>
          </form>
        </details>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="bg-base-surface border border-base-border rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-border text-text-muted text-xs">
                <th className="text-right font-medium px-5 py-3">الاسم</th>
                <th className="text-right font-medium px-5 py-3">البريد</th>
                <th className="text-right font-medium px-5 py-3">الدور</th>
                <th className="text-right font-medium px-5 py-3">آخر دخول</th>
                <th className="text-right font-medium px-5 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-base-border/60 last:border-0">
                  <td className="px-5 py-4 text-text-primary">{a.name}</td>
                  <td className="px-5 py-4 text-text-muted font-mono text-xs" dir="ltr">{a.email}</td>
                  <td className="px-5 py-4">
                    {a.id !== session.adminId ? (
                      <form action={updateAdminRole} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={a.id} />
                        <select name="role" defaultValue={a.role}
                          className="bg-base-surface2 border border-base-border rounded-md text-xs px-2 py-1 text-text-primary">
                          <option value="SUPPORT">دعم فني</option>
                          <option value="MODERATOR">مشرف محتوى</option>
                          <option value="ADMIN">أدمن</option>
                          <option value="SUPER_ADMIN">سوبر أدمن</option>
                        </select>
                        <button type="submit" className="text-[11px] text-gold underline decoration-dotted">حفظ</button>
                      </form>
                    ) : (
                      <span className="text-xs text-gold font-medium">{ROLE_LABELS[a.role]}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-text-muted text-xs">
                    {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("ar-EG") : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {a.id !== session.adminId && (
                        <>
                          <details className="relative">
                            <summary className="cursor-pointer list-none text-xs text-text-muted border border-base-border rounded-md px-2 py-1 hover:border-gold/40 hover:text-gold transition">
                              تغيير كلمة المرور
                            </summary>
                            <form action={resetAdminPassword} className="absolute z-20 mt-2 w-52 bg-base-surface2 border border-base-border rounded-lg p-3 space-y-2 shadow-card">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="password" name="newPassword" required minLength={6} placeholder="كلمة المرور الجديدة" dir="ltr" className="w-full text-xs bg-base-bg border border-base-border rounded-md px-2 py-1.5 text-text-primary" />
                              <ActionButton variant="gold">تعيين</ActionButton>
                            </form>
                          </details>
                          <form action={deleteAdmin}>
                            <input type="hidden" name="id" value={a.id} />
                            <ActionButton variant="danger" confirmMessage="حذف هذا المشرف؟">حذف</ActionButton>
                          </form>
                        </>
                      )}
                      {a.id === session.adminId && (
                        <span className="text-xs text-text-muted/50 italic">أنت</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
