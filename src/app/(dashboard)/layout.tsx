import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import type { AdminRole } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const role = (session?.role ?? "SUPPORT") as AdminRole;
  const adminName = session?.name;

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} adminName={adminName} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
