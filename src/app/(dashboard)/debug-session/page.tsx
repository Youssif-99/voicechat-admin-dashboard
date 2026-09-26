import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DebugSessionPage() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Session Debug Info</h1>
      <div className="bg-base-surface border border-base-border rounded-lg p-6 space-y-3">
        <div>
          <span className="font-bold">Admin ID:</span> {session.adminId}
        </div>
        <div>
          <span className="font-bold">Name:</span> {session.name}
        </div>
        <div>
          <span className="font-bold">Email:</span> {session.email}
        </div>
        <div>
          <span className="font-bold text-xl">Role:</span>{" "}
          <span className="text-2xl text-gold">{session.role}</span>
        </div>
        <div className="mt-6 p-4 bg-base-bg rounded">
          <p className="text-sm text-text-muted">
            To access /icons page, you need: <strong>SUPER_ADMIN</strong>
          </p>
          {session.role !== "SUPER_ADMIN" && (
            <p className="text-danger mt-2">
              ✗ Your current role ({session.role}) cannot access /icons
            </p>
          )}
          {session.role === "SUPER_ADMIN" && (
            <p className="text-success mt-2">
              ✓ Your role has access to /icons
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
