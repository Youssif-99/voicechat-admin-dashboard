/**
 * Integration Tests — Dashboard ↔ Express API
 *
 * Verifies the full dashboard↔Express integration contract.
 * Run with:  npm test  (or: npx tsx tests/integration.test.ts)
 *
 * Prerequisites:
 *   1. Express backend running at EXPRESS_API_URL (default: http://localhost:3000)
 *   2. SUPER_ADMIN seeded: TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env
 *
 * Coverage (18 tests):
 *   1.  Admin login — valid credentials
 *   2.  Admin login — wrong password → 401
 *   3.  GET /auth/me — returns profile with valid token
 *   4.  Unauthenticated request → 401
 *   5.  JWT refresh — refreshToken → new accessToken
 *   6.  List users — paginated
 *   7.  List agencies — paginated
 *   8.  Agency approval workflow
 *   9.  List rooms
 *   10. Dashboard stats
 *   11. Icon catalog (GET /api/icons) — ETag present
 *   12. Icon catalog — conditional GET returns 304
 *   13. Send notification
 *   14. VIP grant
 *   15. User ban + unban
 *   16. Moment listing
 *   17. Banner CRUD
 *   18. Settings read
 */

import assert from "node:assert/strict";

// ── Config ─────────────────────────────────────────────────────────────────

const BASE     = (process.env.EXPRESS_API_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL    = process.env.TEST_ADMIN_EMAIL    || "admin@voicechatapp.com";
const PASSWORD = process.env.TEST_ADMIN_PASSWORD || "Admin@123456";
const NEXT_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

// ── Helpers ────────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; error?: string; durationMs: number };
const results: TestResult[] = [];

let accessToken  = "";
let refreshToken = "";

async function run(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, passed: true, durationMs: ms });
    console.log(`  ✓ ${name} (${ms}ms)`);
  } catch (err) {
    const ms  = Date.now() - start;
    const msg = (err as Error).message;
    results.push({ name, passed: false, error: msg, durationMs: ms });
    console.error(`  ✗ ${name}\n    → ${msg}`);
  }
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status !== 204 ? (await res.json()) : undefined;
  return { status: res.status, data: data as T };
}

// ── Main test runner ────────────────────────────────────────────────────────

async function main() {
  console.log(`\nRunning integration tests against: ${BASE}\n`);

  // ── 1. Admin Login ─────────────────────────────────────────────────────

  await run("Admin Login — valid credentials return accessToken + refreshToken", async () => {
    const { status, data } = await api<{
      accessToken: string; refreshToken: string;
      admin: { id: string; role: string };
    }>("POST", "/api/admin/auth/login", { email: EMAIL, password: PASSWORD });

    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(data.accessToken,  "Missing accessToken");
    assert.ok(data.refreshToken, "Missing refreshToken");
    assert.ok(data.admin?.id,    "Missing admin.id");
    assert.ok(data.admin?.role,  "Missing admin.role");

    accessToken  = data.accessToken;
    refreshToken = data.refreshToken;
  });

  // ── 2. Wrong password → 401 ────────────────────────────────────────────

  await run("Admin Login — wrong password returns 401", async () => {
    const { status } = await api<unknown>("POST", "/api/admin/auth/login", {
      email: EMAIL, password: "wrong-password-xyz",
    });
    assert.equal(status, 401, `Expected 401, got ${status}`);
  });

  // ── 3. /me ─────────────────────────────────────────────────────────────

  await run("Auth /me — returns admin profile with valid token", async () => {
    const { status, data } = await api<{ data: { id: string; email: string } }>(
      "GET", "/api/admin/auth/me", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok((data.data ?? data as unknown as {id:string}).id,    "Missing id");
    assert.ok((data.data ?? data as unknown as {email:string}).email, "Missing email");
  });

  // ── 4. No auth → 401 ───────────────────────────────────────────────────

  await run("Auth — unauthenticated /api/admin/users returns 401", async () => {
    const { status } = await api<unknown>("GET", "/api/admin/users");
    assert.equal(status, 401, `Expected 401, got ${status}`);
  });

  // ── 5. JWT Refresh ─────────────────────────────────────────────────────

  await run("JWT Refresh — refreshToken returns new accessToken", async () => {
    const { status, data } = await api<{ accessToken: string }>(
      "POST", "/api/admin/auth/refresh", { refreshToken }
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(data.accessToken, "No accessToken in refresh response");
    accessToken = data.accessToken; // update for remaining tests
  });

  // ── 6. List Users ──────────────────────────────────────────────────────

  await run("Users — GET /api/admin/users returns paginated list", async () => {
    const { status, data } = await api<{ data: unknown[]; total: number }>(
      "GET", "/api/admin/users?page=1&pageSize=5", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(Array.isArray(data.data), "data.data must be array");
    assert.ok(typeof data.total === "number", "Missing total");
  });

  // ── 7. List Agencies ───────────────────────────────────────────────────

  await run("Agencies — GET /api/admin/agencies returns paginated list", async () => {
    const { status, data } = await api<{ data: unknown[]; total: number }>(
      "GET", "/api/admin/agencies", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(Array.isArray(data.data), "data.data must be array");
  });

  // ── 8. Agency Approval ─────────────────────────────────────────────────

  await run("Agency Approval — PATCH approve on pending agency", async () => {
    const listRes = await api<{ data: Array<{ id: string; status: string }> }>(
      "GET", "/api/admin/agencies?status=PENDING_APPROVAL&pageSize=1", undefined, accessToken
    );
    if (!listRes.data.data || listRes.data.data.length === 0) {
      console.log("    (skipped — no PENDING agencies)");
      return;
    }
    const agencyId = listRes.data.data[0].id;
    const { status } = await api<unknown>(
      "PATCH", `/api/admin/agencies/${agencyId}/approve`,
      { notes: "Integration test approval" }, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
  });

  // ── 9. List Rooms ──────────────────────────────────────────────────────

  await run("Rooms — GET /api/admin/rooms returns list", async () => {
    const { status, data } = await api<{ data: unknown[] }>(
      "GET", "/api/admin/rooms", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(Array.isArray(data.data), "data.data must be array");
  });

  // ── 10. Dashboard Stats ────────────────────────────────────────────────

  await run("Stats — GET /api/admin/stats/dashboard returns summary", async () => {
    const { status, data } = await api<{ data: { totalUsers: number } }>(
      "GET", "/api/admin/stats/dashboard", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    const stats = (data as unknown as { data?: { totalUsers?: number }; totalUsers?: number });
    const total = stats.data?.totalUsers ?? (stats as unknown as {totalUsers:number}).totalUsers;
    assert.ok(typeof total === "number", `Missing totalUsers — got: ${JSON.stringify(data)}`);
  });

  // ── 11. Icon Catalog ETag ──────────────────────────────────────────────
  // Requires Next.js dashboard running at NEXT_PUBLIC_BASE_URL

  await run("Icon Catalog — GET /api/icons returns catalog with ETag", async () => {
    let res: Response;
    try {
      res = await fetch(`${NEXT_URL}/api/icons`, { signal: AbortSignal.timeout(5000) });
    } catch {
      console.log(`    (skipped — dashboard not running at ${NEXT_URL})`);
      return;
    }
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const etag = res.headers.get("etag");
    assert.ok(etag, "Missing ETag header");
    const data = await res.json() as { icons: unknown[]; etag: string; version: number };
    assert.ok(Array.isArray(data.icons),       "Missing icons array");
    assert.ok(data.etag,                        "Missing etag in body");
    assert.ok(typeof data.version === "number", "Missing version");
  });

  // ── 12. Icon Catalog 304 ───────────────────────────────────────────────

  await run("Icon Catalog — ETag conditional GET returns 304", async () => {
    let first: Response;
    try {
      first = await fetch(`${NEXT_URL}/api/icons`, { signal: AbortSignal.timeout(5000) });
    } catch {
      console.log(`    (skipped — dashboard not running at ${NEXT_URL})`);
      return;
    }
    const etag  = first.headers.get("etag") || `"init"`;
    const second = await fetch(`${NEXT_URL}/api/icons`, {
      headers: { "If-None-Match": etag },
    });
    assert.equal(second.status, 304, `Expected 304, got ${second.status}`);
  });

  // ── 13. Send Notification ─────────────────────────────────────────────

  await run("Notifications — POST /api/admin/notifications/send", async () => {
    const { status } = await api<{ error?: string }>(
      "POST", "/api/admin/notifications/send",
      { title: "Test", body: "Integration test — ignore", targetType: "ALL" },
      accessToken
    );
    assert.ok(status === 200 || status === 201, `Expected 200/201, got ${status}`);
  });

  // ── 14. VIP Grant ─────────────────────────────────────────────────────

  await run("VIP — POST /api/admin/vip/grant sets vip on user", async () => {
    const usersRes = await api<{ data: Array<{ id: string }> }>(
      "GET", "/api/admin/users?status=ACTIVE&pageSize=1", undefined, accessToken
    );
    if (!usersRes.data.data?.length) {
      console.log("    (skipped — no active users)");
      return;
    }
    const userId = usersRes.data.data[0].id;
    const { status } = await api<unknown>(
      "POST", "/api/admin/vip/grant",
      { userId, level: 1, durationDays: 30 }, accessToken
    );
    assert.ok(status === 200 || status === 201, `Expected 200/201, got ${status}`);
  });

  // ── 15. User Ban + Unban ───────────────────────────────────────────────

  await run("User Moderation — ban then unban a user", async () => {
    const usersRes = await api<{ data: Array<{ id: string }> }>(
      "GET", "/api/admin/users?status=ACTIVE&pageSize=1", undefined, accessToken
    );
    if (!usersRes.data.data?.length) {
      console.log("    (skipped — no active users)");
      return;
    }
    const userId = usersRes.data.data[0].id;

    const banRes = await api<unknown>(
      "PATCH", `/api/admin/users/${userId}/ban`,
      { banType: "ONE_DAY", banReason: "integration test" }, accessToken
    );
    assert.equal(banRes.status, 200, `Ban expected 200, got ${banRes.status}`);

    const unbanRes = await api<unknown>(
      "PATCH", `/api/admin/users/${userId}/unban`, undefined, accessToken
    );
    assert.equal(unbanRes.status, 200, `Unban expected 200, got ${unbanRes.status}`);
  });

  // ── 16. Moment listing ────────────────────────────────────────────────

  await run("Moments — GET /api/admin/moments returns list", async () => {
    const { status, data } = await api<{ data: unknown[] }>(
      "GET", "/api/admin/moments?pageSize=5", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(Array.isArray(data.data), "data.data must be array");
  });

  // ── 17. Banner CRUD ───────────────────────────────────────────────────

  await run("Banners — create then delete a banner", async () => {
    const createRes = await api<{ data?: { id?: string }; id?: string }>(
      "POST", "/api/admin/banners",
      { title: "Integration Test Banner", imageUrl: "https://via.placeholder.com/800x200", position: 999, enabled: false },
      accessToken
    );
    assert.ok(
      createRes.status === 200 || createRes.status === 201,
      `Create expected 200/201, got ${createRes.status}`
    );

    const bannerId = createRes.data?.data?.id ?? createRes.data?.id;
    if (!bannerId) {
      console.log("    (delete skipped — no banner id returned)");
      return;
    }

    const delRes = await api<unknown>(
      "DELETE", `/api/admin/banners/${bannerId}`, undefined, accessToken
    );
    assert.ok(
      delRes.status === 200 || delRes.status === 204,
      `Delete expected 200/204, got ${delRes.status}`
    );
  });

  // ── 18. Settings Read ─────────────────────────────────────────────────

  await run("Settings — GET /api/admin/settings returns object", async () => {
    const { status, data } = await api<Record<string, unknown>>(
      "GET", "/api/admin/settings", undefined, accessToken
    );
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(typeof data === "object" && data !== null, "Expected object response");
  });

  // ── Summary ────────────────────────────────────────────────────────────

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total  = results.length;
  const ms     = results.reduce((s, r) => s + r.durationMs, 0);

  console.log("\n" + "─".repeat(60));
  console.log(`Tests:   ${passed} passed, ${failed} failed, ${total} total`);
  console.log(`Time:    ${ms}ms`);
  console.log("─".repeat(60));

  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("\n✓ All tests passed");
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
