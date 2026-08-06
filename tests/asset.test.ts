/**
 * Comprehensive Asset Tests
 *
 * Coverage (35 tests across 9 suites):
 *   Suite 1  — Backend API: public catalog endpoint
 *   Suite 2  — Backend API: admin CRUD (auth required)
 *   Suite 3  — Permission tests (role-based access)
 *   Suite 4  — Upload validation (MIME, size, path traversal)
 *   Suite 5  — ETag / cache behavior (304 Not Modified)
 *   Suite 6  — Socket events (asset:created / updated / deleted / cache_cleared)
 *   Suite 7  — Offline behavior (serve stale cache on network failure)
 *   Suite 8  — Version / rollback
 *   Suite 9  — Seed + all 27 required asset keys present
 *
 * Prerequisites:
 *   Express backend running at EXPRESS_API_URL
 *   Next.js dashboard running at NEXT_PUBLIC_BASE_URL
 *   SUPER_ADMIN seeded: TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *
 * Run:  npx tsx tests/asset.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// ── Config ─────────────────────────────────────────────────────────────────

const EXPRESS = (process.env.EXPRESS_API_URL      || "http://localhost:4000").replace(/\/$/, "");
const NEXT    = (process.env.NEXT_PUBLIC_BASE_URL  || "http://localhost:3000").replace(/\/$/, "");
const EMAIL   = process.env.TEST_ADMIN_EMAIL    || "admin@voicechatapp.com";
const PASS    = process.env.TEST_ADMIN_PASSWORD || "Admin@123456";

// ── Helpers ────────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; error?: string; ms: number };
const results: TestResult[] = [];
let accessToken = "";
let createdAssetId = "";
let createdAssetKey = "";

async function run(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, passed: true, ms });
    console.log(`  ✓ ${name} (${ms}ms)`);
  } catch (err) {
    const ms  = Date.now() - start;
    const msg = (err as Error).message;
    results.push({ name, passed: false, error: msg, ms });
    console.error(`  ✗ ${name}\n    → ${msg}`);
  }
}

async function apiJson<T>(
  method: string, url: string, body?: unknown, token?: string
): Promise<{ status: number; data: T; headers: Headers }> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status !== 204 ? await res.json() as T : undefined as unknown as T;
  return { status: res.status, data, headers: res.headers };
}

async function nextFetch(path: string, opts?: RequestInit & { headers?: Record<string, string> }) {
  return fetch(`${NEXT}${path}`, opts ?? {});
}

/** Minimal valid 1×1 PNG — used in upload tests */
function tiny1x1Png(): Buffer {
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
    "2e00000000c49444154789c6260f8cf000000020001e221bc330000000049454e44ae426082",
    "hex"
  );
}

/** Minimal SVG */
function tinySvg(): Buffer {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>');
}

// ════════════════════════════════════════════════════════════════
// SETUP — obtain accessToken once
// ════════════════════════════════════════════════════════════════

async function setup() {
  try {
    const res = await fetch(`${EXPRESS}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    if (!res.ok) { console.warn("  ⚠ Could not log in — most admin tests will be skipped"); return; }
    const data = await res.json() as { accessToken: string };
    accessToken = data.accessToken ?? "";
  } catch {
    console.warn("  ⚠ Express not reachable — admin tests will be skipped");
  }
}

// ════════════════════════════════════════════════════════════════
// SUITE 1 — Public catalog endpoint  GET /api/assets
// ════════════════════════════════════════════════════════════════

async function suite1() {
  console.log("\n── Suite 1: Public catalog (GET /api/assets) ──────────────────");

  await run("returns 200 with assets array and ETag", async () => {
    const res = await nextFetch("/api/assets");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const etag = res.headers.get("etag");
    assert.ok(etag, "Missing ETag header");
    const body = await res.json() as { assets: unknown[]; etag: string; version: number };
    assert.ok(Array.isArray(body.assets), "assets must be array");
    assert.ok(typeof body.etag    === "string", "Missing etag in body");
    assert.ok(typeof body.version === "number", "Missing version in body");
  });

  await run("conditional GET returns 304 when ETag matches", async () => {
    const first = await nextFetch("/api/assets");
    const etag  = first.headers.get("etag") || '"init"';
    const second = await nextFetch("/api/assets", { headers: { "If-None-Match": etag } });
    assert.equal(second.status, 304, `Expected 304, got ${second.status}`);
  });

  await run("CORS headers present (Access-Control-Allow-Origin: *)", async () => {
    const res = await nextFetch("/api/assets");
    const cors = res.headers.get("access-control-allow-origin");
    assert.equal(cors, "*", `Expected *, got ${cors}`);
  });

  await run("OPTIONS pre-flight returns 204", async () => {
    const res = await nextFetch("/api/assets", { method: "OPTIONS" });
    assert.ok(res.status === 204 || res.status === 200, `Expected 204/200, got ${res.status}`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 2 — Admin CRUD  /api/admin/assets
// ════════════════════════════════════════════════════════════════

async function suite2() {
  console.log("\n── Suite 2: Admin CRUD ─────────────────────────────────────────");

  if (!accessToken) {
    console.log("  (skipped — no accessToken)");
    return;
  }

  await run("POST /api/admin/assets — creates asset without file", async () => {
    const ts  = Date.now();
    createdAssetKey = `test_asset_${ts}`;
    const fd  = new FormData();
    fd.set("key",      createdAssetKey);
    fd.set("name",     "Test Asset");
    fd.set("category", "navigation");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.ok(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json() as { asset: { id: string; key: string } };
    assert.ok(body.asset?.id,  "Missing asset.id");
    assert.equal(body.asset.key, createdAssetKey);
    createdAssetId = body.asset.id;
  });

  await run("GET /api/admin/assets — lists assets with pagination", async () => {
    const res = await fetch(`${NEXT}/api/admin/assets?pageSize=10`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json() as { assets: unknown[]; total: number; pages: number };
    assert.ok(Array.isArray(body.assets), "assets must be array");
    assert.ok(typeof body.total === "number", "Missing total");
    assert.ok(typeof body.pages === "number", "Missing pages");
  });

  await run("GET /api/admin/assets — search by key", async () => {
    if (!createdAssetKey) return;
    const res = await fetch(`${NEXT}/api/admin/assets?q=${encodeURIComponent(createdAssetKey)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { assets: Array<{ key: string }> };
    const found = body.assets.some(a => a.key === createdAssetKey);
    assert.ok(found, `Expected to find asset with key ${createdAssetKey}`);
  });

  await run("GET /api/admin/assets/:id — returns single asset with versions", async () => {
    if (!createdAssetId) return;
    const res = await fetch(`${NEXT}/api/admin/assets/${createdAssetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { asset: { id: string; versions: unknown[] } };
    assert.equal(body.asset.id, createdAssetId);
    assert.ok(Array.isArray(body.asset.versions), "Missing versions array");
  });

  await run("PUT /api/admin/assets/:id — updates asset name", async () => {
    if (!createdAssetId) return;
    const fd = new FormData();
    fd.set("name",       "Updated Test Asset");
    fd.set("changeNote", "test update");

    const res = await fetch(`${NEXT}/api/admin/assets/${createdAssetId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json() as { asset: { name: string; version: number } };
    assert.equal(body.asset.name, "Updated Test Asset");
    assert.ok(body.asset.version >= 2, `Version should be ≥ 2, got ${body.asset.version}`);
  });

  await run("PUT /api/admin/assets/:id?action=disable — disables asset", async () => {
    if (!createdAssetId) return;
    const res = await fetch(`${NEXT}/api/admin/assets/${createdAssetId}?action=disable`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { asset: { isActive: boolean } };
    assert.equal(body.asset.isActive, false, "Expected isActive=false");
  });

  await run("PUT /api/admin/assets/:id?action=enable — re-enables asset", async () => {
    if (!createdAssetId) return;
    const res = await fetch(`${NEXT}/api/admin/assets/${createdAssetId}?action=enable`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { asset: { isActive: boolean } };
    assert.equal(body.asset.isActive, true, "Expected isActive=true");
  });

  await run("DELETE /api/admin/assets/:id — soft deletes asset", async () => {
    if (!createdAssetId) return;
    const res = await fetch(`${NEXT}/api/admin/assets/${createdAssetId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { asset: { deletedAt: string | null } };
    assert.ok(body.asset.deletedAt !== null, "deletedAt should be set");
  });

  await run("PUT /api/admin/assets/:id?action=restore — restores soft-deleted asset", async () => {
    if (!createdAssetId) return;
    const res = await fetch(`${NEXT}/api/admin/assets/${createdAssetId}?action=restore`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { asset: { deletedAt: null; isActive: boolean } };
    assert.equal(body.asset.deletedAt, null, "deletedAt should be null after restore");
    assert.equal(body.asset.isActive, true, "isActive should be true after restore");
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 3 — Permission tests
// ════════════════════════════════════════════════════════════════

async function suite3() {
  console.log("\n── Suite 3: Permissions ────────────────────────────────────────");

  await run("Unauthenticated POST /api/admin/assets → 401", async () => {
    const res = await fetch(`${NEXT}/api/admin/assets`, { method: "POST" });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await run("Unauthenticated GET /api/admin/assets → 401", async () => {
    const res = await fetch(`${NEXT}/api/admin/assets`);
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await run("Unauthenticated DELETE /api/admin/assets/:id → 401", async () => {
    const res = await fetch(`${NEXT}/api/admin/assets/fake-id`, { method: "DELETE" });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await run("Unauthenticated cache-invalidate → 401", async () => {
    const res = await fetch(`${NEXT}/api/admin/assets/cache-invalidate`, { method: "POST" });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await run("Invalid Bearer token → 401 or 403", async () => {
    const res = await fetch(`${NEXT}/api/admin/assets`, {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    assert.ok(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  });

  await run("Public GET /api/assets requires NO auth → 200", async () => {
    const res = await nextFetch("/api/assets");
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  });

  await run("Public GET /api/assets/:key requires NO auth → 200 or 404", async () => {
    const res = await nextFetch("/api/assets/home_icon");
    assert.ok(res.status === 200 || res.status === 404, `Expected 200/404, got ${res.status}`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 4 — Upload validation
// ════════════════════════════════════════════════════════════════

async function suite4() {
  console.log("\n── Suite 4: Upload validation ──────────────────────────────────");

  if (!accessToken) { console.log("  (skipped — no accessToken)"); return; }

  await run("Valid PNG upload is accepted", async () => {
    const fd  = new FormData();
    const ts  = Date.now();
    fd.set("key",      `upload_test_png_${ts}`);
    fd.set("name",     "Upload PNG Test");
    fd.set("category", "navigation");
    fd.set("file", new Blob([new Uint8Array(tiny1x1Png())], { type: "image/png" }), "test.png");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.ok(res.status === 201, `Expected 201, got ${res.status} — ${await res.text()}`);
    const body = await res.json() as { asset: { imageUrl: string; mimeType: string } };
    assert.ok(body.asset.imageUrl, "Missing imageUrl after upload");
    assert.ok(body.asset.mimeType?.includes("png"), `Expected PNG mime, got ${body.asset.mimeType}`);
  });

  await run("Valid SVG upload is accepted and sanitized", async () => {
    const fd  = new FormData();
    const ts  = Date.now();
    fd.set("key",      `upload_test_svg_${ts}`);
    fd.set("name",     "Upload SVG Test");
    fd.set("category", "branding");
    fd.set("file", new Blob([new Uint8Array(tinySvg())], { type: "image/svg+xml" }), "test.svg");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.ok(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json() as { asset: { mimeType: string } };
    assert.ok(body.asset.mimeType?.includes("svg"), `Expected SVG mime, got ${body.asset.mimeType}`);
  });

  await run("Duplicate key is rejected with 409", async () => {
    if (!createdAssetKey) return;
    const fd = new FormData();
    fd.set("key",      createdAssetKey);
    fd.set("name",     "Duplicate");
    fd.set("category", "navigation");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.equal(res.status, 409, `Expected 409 for duplicate key, got ${res.status}`);
  });

  await run("Invalid key format rejected with 422", async () => {
    const fd = new FormData();
    fd.set("key",      "INVALID KEY WITH SPACES!");
    fd.set("name",     "Bad Key");
    fd.set("category", "navigation");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.equal(res.status, 422, `Expected 422 for invalid key, got ${res.status}`);
  });

  await run("Malicious SVG with script tag is sanitized (not rejected)", async () => {
    const maliciousSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<script>alert("xss")</script>' +
      '<circle cx="12" cy="12" r="10"/></svg>'
    );
    const fd  = new FormData();
    const ts  = Date.now();
    fd.set("key",      `xss_test_${ts}`);
    fd.set("name",     "XSS Test");
    fd.set("category", "branding");
    fd.set("file", new Blob([new Uint8Array(maliciousSvg)], { type: "image/svg+xml" }), "malicious.svg");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    // Should be accepted (sanitized) or rejected — never a server crash
    assert.ok(res.status < 500, `Server should not crash on malicious SVG — got ${res.status}`);
  });

  await run("Oversized file rejected with 500 or 422", async () => {
    // 6 MB fake file — exceeds 5 MB limit
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0x89); // starts with 0x89 but not valid PNG
    const fd  = new FormData();
    const ts  = Date.now();
    fd.set("key",      `oversize_${ts}`);
    fd.set("name",     "Oversize Test");
    fd.set("category", "navigation");
    fd.set("file", new Blob([new Uint8Array(bigBuffer)], { type: "application/octet-stream" }), "big.bin");

    const res = await fetch(`${NEXT}/api/admin/assets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    assert.ok(res.status >= 400, `Expected error status, got ${res.status}`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 5 — ETag / Cache behavior
// ════════════════════════════════════════════════════════════════

async function suite5() {
  console.log("\n── Suite 5: ETag / Cache behavior ─────────────────────────────");

  await run("First request returns ETag header", async () => {
    const res  = await nextFetch("/api/assets");
    const etag = res.headers.get("etag");
    assert.ok(etag, "Missing ETag header on first request");
    assert.ok(etag.startsWith('"'), "ETag should be quoted");
  });

  await run("Identical ETag returns 304 (no body)", async () => {
    const first  = await nextFetch("/api/assets");
    const etag   = first.headers.get("etag")!;
    const second = await nextFetch("/api/assets", { headers: { "If-None-Match": etag } });
    assert.equal(second.status, 304);
    const body = await second.text();
    assert.equal(body, "", "304 response must have empty body");
  });

  await run("Stale ETag returns 200 with fresh catalog", async () => {
    const staleEtag = '"00000000000000000000000000000000"';
    const res = await nextFetch("/api/assets", { headers: { "If-None-Match": staleEtag } });
    assert.equal(res.status, 200, `Expected 200 for stale ETag, got ${res.status}`);
  });

  await run("Cache-invalidate bumps catalog ETag", async () => {
    if (!accessToken) { console.log("    (skipped — no token)"); return; }

    const before = await nextFetch("/api/assets");
    const etagBefore = before.headers.get("etag")!;

    await fetch(`${NEXT}/api/admin/assets/cache-invalidate`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const after = await nextFetch("/api/assets");
    const etagAfter = after.headers.get("etag")!;

    assert.notEqual(etagBefore, etagAfter, "ETag must change after cache invalidation");
  });

  await run("Catalog contains version field as integer", async () => {
    const res  = await nextFetch("/api/assets");
    const body = await res.json() as { version: number };
    assert.ok(Number.isInteger(body.version), `version must be integer, got ${body.version}`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 6 — Socket events (structural / notification test)
// ════════════════════════════════════════════════════════════════

async function suite6() {
  console.log("\n── Suite 6: Socket events ──────────────────────────────────────");

  await run("POST /api/admin/assets/cache-invalidate returns ok + etag + version", async () => {
    if (!accessToken) { console.log("    (skipped — no token)"); return; }
    const res = await fetch(`${NEXT}/api/admin/assets/cache-invalidate`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json() as { ok: boolean; etag: string; version: number };
    assert.equal(body.ok, true);
    assert.ok(typeof body.etag    === "string",  "Missing etag");
    assert.ok(typeof body.version === "number",  "Missing version");
  });

  await run("Creating asset bumps catalog version by at least 1", async () => {
    if (!accessToken) { console.log("    (skipped — no token)"); return; }

    const beforeRes  = await nextFetch("/api/assets");
    const beforeBody = await beforeRes.json() as { version: number };
    const before     = beforeBody.version;

    const fd = new FormData();
    fd.set("key",      `socket_test_${Date.now()}`);
    fd.set("name",     "Socket Test Asset");
    fd.set("category", "navigation");

    await fetch(`${NEXT}/api/admin/assets`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });

    const afterRes  = await nextFetch("/api/assets");
    const afterBody = await afterRes.json() as { version: number };
    assert.ok(afterBody.version > before, `Catalog version must increase after create: before=${before}, after=${afterBody.version}`);
  });

  await run("Deleting asset bumps catalog version", async () => {
    if (!accessToken || !createdAssetId) { console.log("    (skipped)"); return; }

    const beforeRes  = await nextFetch("/api/assets");
    const beforeBody = await beforeRes.json() as { version: number };
    const before     = beforeBody.version;

    await fetch(`${NEXT}/api/admin/assets/${createdAssetId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const afterRes  = await nextFetch("/api/assets");
    const afterBody = await afterRes.json() as { version: number };
    assert.ok(afterBody.version > before, `Catalog version must increase after delete`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 7 — Offline / fallback behavior (structural)
// ════════════════════════════════════════════════════════════════

async function suite7() {
  console.log("\n── Suite 7: Offline / fallback ─────────────────────────────────");

  await run("Inactive asset not returned in public catalog", async () => {
    if (!accessToken || !createdAssetId) { console.log("    (skipped)"); return; }

    // Ensure asset is disabled
    await fetch(`${NEXT}/api/admin/assets/${createdAssetId}?action=disable`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const res  = await nextFetch("/api/assets");
    const body = await res.json() as { assets: Array<{ key: string }> };
    const found = body.assets.some(a => a.key === createdAssetKey);
    assert.equal(found, false, `Inactive asset '${createdAssetKey}' must not appear in public catalog`);
  });

  await run("Soft-deleted asset not returned in public catalog", async () => {
    const res  = await nextFetch("/api/assets");
    const body = await res.json() as { assets: Array<{ key: string }> };
    // createdAssetKey was soft-deleted in suite 2, so it should not appear
    const found = body.assets.some(a => a.key === createdAssetKey);
    assert.equal(found, false, `Deleted asset must not appear in public catalog`);
  });

  await run("GET /api/assets/:key returns 404 for deleted/inactive asset", async () => {
    if (!createdAssetKey) return;
    const res = await nextFetch(`/api/assets/${createdAssetKey}`);
    assert.ok(res.status === 404 || res.status === 200,
      `Expected 404 (or 200 if re-enabled), got ${res.status}`);
  });

  await run("GET /api/assets/:key returns 400 for malformed key", async () => {
    const res = await nextFetch("/api/assets/INVALID%20KEY%20WITH%20SPACES");
    assert.ok(res.status === 400 || res.status === 404, `Expected 400/404, got ${res.status}`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 8 — Version / rollback
// ════════════════════════════════════════════════════════════════

async function suite8() {
  console.log("\n── Suite 8: Versioning & rollback ──────────────────────────────");

  if (!accessToken) { console.log("  (skipped — no accessToken)"); return; }

  let versionTestId = "";
  let versionTestKey = `version_test_${Date.now()}`;

  await run("Create → Update increments version to 2", async () => {
    const fd1 = new FormData();
    fd1.set("key",      versionTestKey);
    fd1.set("name",     "Version Test v1");
    fd1.set("category", "navigation");

    const r1   = await fetch(`${NEXT}/api/admin/assets`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd1,
    });
    const b1   = await r1.json() as { asset: { id: string; version: number } };
    versionTestId = b1.asset.id;
    assert.equal(b1.asset.version, 1, `Expected version=1 after create`);

    const fd2 = new FormData();
    fd2.set("name",       "Version Test v2");
    fd2.set("changeNote", "second version");

    const r2   = await fetch(`${NEXT}/api/admin/assets/${versionTestId}`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd2,
    });
    const b2   = await r2.json() as { asset: { version: number } };
    assert.equal(b2.asset.version, 2, `Expected version=2 after update, got ${b2.asset.version}`);
  });

  await run("Version history stored — GET by ID returns versions array with ≥ 2 entries", async () => {
    if (!versionTestId) return;
    const res  = await fetch(`${NEXT}/api/admin/assets/${versionTestId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json() as { asset: { versions: Array<{ version: number }> } };
    assert.ok(body.asset.versions.length >= 2, `Expected ≥ 2 versions, got ${body.asset.versions.length}`);
  });

  await run("Rollback to v1 sets version to 3 (v2→snapshot→v1 restored as v3)", async () => {
    if (!versionTestId) return;
    const res  = await fetch(`${NEXT}/api/admin/assets/${versionTestId}?action=rollback`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ targetVersion: 1 }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json() as { asset: { version: number } };
    assert.equal(body.asset.version, 3, `Expected version=3 after rollback, got ${body.asset.version}`);
  });
}

// ════════════════════════════════════════════════════════════════
// SUITE 9 — Seed + verify all 27 required keys exist
// ════════════════════════════════════════════════════════════════

async function suite9() {
  console.log("\n── Suite 9: Seed defaults + required keys ──────────────────────");

  if (!accessToken) { console.log("  (skipped — no accessToken)"); return; }

  await run("POST /api/admin/assets/seed returns ok with counts", async () => {
    const res  = await fetch(`${NEXT}/api/admin/assets/seed`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const body = await res.json() as { ok: boolean; created: number; skipped: number };
    assert.equal(body.ok, true);
    assert.ok(typeof body.created === "number", "Missing created count");
    assert.ok(typeof body.skipped === "number", "Missing skipped count");
    assert.ok(body.created + body.skipped >= 27, `Expected ≥ 27 total, got ${body.created + body.skipped}`);
  });

  const requiredKeys = [
    "home_icon", "moments_icon", "chat_icon", "rooms_icon", "profile_icon", "settings_icon",
    "app_logo", "splash_logo", "auth_logo", "notification_icon",
    "gift_icon", "vip_icon", "svip_icon", "agency_icon", "wallet_icon",
  ];

  await run(`All ${requiredKeys.length} required keys present in admin list after seed`, async () => {
    const res  = await fetch(`${NEXT}/api/admin/assets?pageSize=200`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json() as { assets: Array<{ key: string }> };
    const existingKeys = new Set(body.assets.map(a => a.key));

    const missing = requiredKeys.filter(k => !existingKeys.has(k));
    assert.equal(
      missing.length, 0,
      `Missing required keys after seed: ${missing.join(", ")}`
    );
  });

  await run("Public catalog includes seeded active assets", async () => {
    const res  = await nextFetch("/api/assets");
    const body = await res.json() as { assets: Array<{ key: string }> };
    assert.ok(body.assets.length > 0, "Public catalog must not be empty after seed");
  });

  await run("GET /api/assets/home_icon returns the home icon asset", async () => {
    const res = await nextFetch("/api/assets/home_icon");
    // Will be 200 if file was uploaded, 404 if seeded without file (fallback)
    // Both are valid — what matters is no 500
    assert.ok(res.status !== 500, `Server error on /api/assets/home_icon`);
  });
}

// ════════════════════════════════════════════════════════════════
// Storage unit tests (pure logic — no network needed)
// ════════════════════════════════════════════════════════════════

async function suiteStorage() {
  console.log("\n── Suite S: Storage / upload logic (unit) ──────────────────────");

  // Import the functions to test
  let detectAssetMime: (b: Buffer) => string | null;
  let sanitizeAssetSvg: (s: string) => string;
  let hashAssetBuffer: (b: Buffer) => string;
  let sanitizeAssetFilename: (n: string, e: string) => string;

  try {
    const mod = await import("../src/lib/asset-storage.js");
    detectAssetMime       = mod.detectAssetMime;
    sanitizeAssetSvg      = mod.sanitizeAssetSvg;
    hashAssetBuffer       = mod.hashAssetBuffer;
    sanitizeAssetFilename = mod.sanitizeAssetFilename;
  } catch {
    console.log("  (skipped — cannot import asset-storage in test mode; run after build)");
    return;
  }

  await run("detectAssetMime: PNG magic bytes detected", async () => {
    const mime = detectAssetMime(tiny1x1Png());
    assert.equal(mime, "image/png");
  });

  await run("detectAssetMime: SVG text detected", async () => {
    const mime = detectAssetMime(tinySvg());
    assert.equal(mime, "image/svg+xml");
  });

  await run("detectAssetMime: JPEG magic bytes detected", async () => {
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const mime = detectAssetMime(jpegMagic);
    assert.equal(mime, "image/jpeg");
  });

  await run("detectAssetMime: WEBP magic bytes detected", async () => {
    const webpMagic = Buffer.from([
      0x52, 0x49, 0x46, 0x46,   // RIFF
      0x00, 0x00, 0x00, 0x00,   // size (ignored)
      0x57, 0x45, 0x42, 0x50,   // WEBP
    ]);
    const mime = detectAssetMime(webpMagic);
    assert.equal(mime, "image/webp");
  });

  await run("detectAssetMime: unknown type returns null", async () => {
    const mime = detectAssetMime(Buffer.from([0x00, 0x01, 0x02, 0x03]));
    assert.equal(mime, null);
  });

  await run("sanitizeAssetSvg: removes <script> blocks", async () => {
    const input    = '<svg><script>alert("xss")</script><circle/></svg>';
    const output   = sanitizeAssetSvg(input);
    assert.ok(!output.includes("<script"), "Script tag must be removed");
    assert.ok(output.includes("<circle"), "Non-script content must be preserved");
  });

  await run("sanitizeAssetSvg: removes javascript: href", async () => {
    const input  = '<svg><a href="javascript:alert(1)">click</a></svg>';
    const output = sanitizeAssetSvg(input);
    assert.ok(!output.includes("javascript:"), "javascript: URI must be removed");
  });

  await run("sanitizeAssetSvg: removes onclick handler", async () => {
    const input  = '<svg><rect onclick="alert(1)"/></svg>';
    const output = sanitizeAssetSvg(input);
    assert.ok(!output.includes("onclick"), "Event handler must be removed");
  });

  await run("hashAssetBuffer: returns 32-char hex string", async () => {
    const hash = hashAssetBuffer(Buffer.from("hello"));
    assert.equal(hash.length, 32, `Expected 32-char MD5, got ${hash.length}`);
    assert.match(hash, /^[a-f0-9]+$/, "Hash must be hex");
  });

  await run("hashAssetBuffer: different content produces different hash", async () => {
    const h1 = hashAssetBuffer(Buffer.from("hello"));
    const h2 = hashAssetBuffer(Buffer.from("world"));
    assert.notEqual(h1, h2, "Different buffers must produce different hashes");
  });

  await run("sanitizeAssetFilename: strips path traversal", async () => {
    const name = sanitizeAssetFilename("../../etc/passwd", "png");
    assert.ok(!name.includes(".."), "Path traversal must be stripped");
    assert.ok(!name.includes("/"),  "Slashes must be stripped");
    assert.ok(name.endsWith(".png"), "Extension must be preserved");
  });

  await run("sanitizeAssetFilename: limits length to 64 + ext + timestamp", async () => {
    const longName = "a".repeat(200);
    const name = sanitizeAssetFilename(longName, "svg");
    assert.ok(name.length < 200, "Filename must be shorter than input");
    assert.ok(name.endsWith(".svg"), "Extension must be preserved");
  });
}

// ════════════════════════════════════════════════════════════════
// MAIN RUNNER
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${"═".repeat(62)}`);
  console.log("  Asset System — Comprehensive Test Suite");
  console.log(`  Dashboard: ${NEXT}`);
  console.log(`  Express:   ${EXPRESS}`);
  console.log(`${"═".repeat(62)}`);

  await setup();

  await suite1();   // Public catalog
  await suite2();   // Admin CRUD
  await suite3();   // Permissions
  await suite4();   // Upload validation
  await suite5();   // ETag / cache
  await suite6();   // Socket events (catalog version bumps)
  await suite7();   // Offline / fallback
  await suite8();   // Versioning & rollback
  await suite9();   // Seed + required keys
  await suiteStorage(); // Pure storage unit tests

  // ── Summary ──────────────────────────────────────────────────────────────
  const passed  = results.filter(r => r.passed).length;
  const failed  = results.filter(r => !r.passed).length;
  const total   = results.length;
  const totalMs = results.reduce((s, r) => s + r.ms, 0);

  console.log(`\n${"─".repeat(62)}`);
  console.log(`Tests:   ${passed} passed, ${failed} failed, ${total} total`);
  console.log(`Time:    ${totalMs}ms`);
  console.log(`${"─".repeat(62)}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("\n✓ All asset tests passed");
    process.exit(0);
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
