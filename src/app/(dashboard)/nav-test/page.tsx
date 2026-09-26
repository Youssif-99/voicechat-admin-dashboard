"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavTestPage() {
  const pathname = usePathname();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Navigation Test Page</h1>
      
      <div className="mb-6 p-4 bg-base-surface2 rounded-lg">
        <p className="font-mono text-sm">
          <strong>Current pathname:</strong> {pathname}
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">Test Links (Client Component):</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="px-4 py-2 bg-gold text-base-bg rounded-lg hover:bg-gold/90">
            Dashboard
          </Link>
          <Link href="/icons" className="px-4 py-2 bg-info text-white rounded-lg hover:bg-info/90">
            Icons
          </Link>
          <Link href="/users" className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90">
            Users
          </Link>
          <Link href="/rooms" className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90">
            Rooms
          </Link>
          <Link href="/agencies" className="px-4 py-2 bg-text-primary text-base-bg rounded-lg hover:opacity-90">
            Agencies
          </Link>
        </div>
      </div>

      <div className="mt-6 p-4 bg-base-surface border border-base-border rounded-lg">
        <h3 className="font-bold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-text-muted">
          <li>Click each link above</li>
          <li>Watch if the "Current pathname" updates</li>
          <li>Check if the page content changes</li>
          <li>Open browser DevTools Console for errors</li>
        </ol>
      </div>

      <div className="mt-6">
        <button
          onClick={() => {
            console.log("Current window.location:", window.location.href);
            console.log("Current pathname:", pathname);
          }}
          className="px-4 py-2 bg-base-surface2 rounded-lg hover:bg-base-border"
        >
          Log Current URL to Console
        </button>
      </div>
    </div>
  );
}
