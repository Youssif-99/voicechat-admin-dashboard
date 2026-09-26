import { getSession } from "@/lib/auth";
import { SidebarClient } from "@/components/Sidebar-client";
import { getNavItemsForRole } from "@/lib/permissions";
import { logoutAction } from "./actions";
import type { AdminRole } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const role = (session?.role ?? "SUPPORT") as AdminRole;
  const adminName = session?.name;
  const navItems = getNavItemsForRole(role);

  return (
    <div className="flex min-h-screen">
      <SidebarClient 
        role={role} 
        adminName={adminName} 
        navItems={navItems}
        logoutAction={logoutAction} 
      />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
