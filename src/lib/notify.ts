/**
 * Server-side event notifier.
 *
 * Calls the Express backend's internal admin-event endpoint so it can
 * broadcast Socket.IO events to all connected Flutter clients.
 *
 * Express must expose:
 *   POST /api/admin/events/emit
 *   Body: { type: string, payload: object }
 *   Auth: internal service token (INTERNAL_SERVICE_TOKEN env var)
 *
 * This runs on the Next.js server — NOT in the browser.
 * On any failure it logs a warning but never throws, so it never
 * breaks the primary admin action.
 */

import { EXPRESS_API_URL } from "./api-client";

type AdminEvent =
  | { type: "icon:updated";        payload: { iconId: string; key: string } }
  | { type: "icon:cache_cleared";  payload: { version: number; etag: string } }
  // ── AppAsset events ────────────────────────────────────────────────────────
  | { type: "asset:created";       payload: { assetId: string; key: string; category: string } }
  | { type: "asset:updated";       payload: { assetId: string; key: string; version: number } }
  | { type: "asset:deleted";       payload: { assetId: string; key: string } }
  | { type: "asset:cache_cleared"; payload: { version: number; etag: string } }
  // ── Other domain events ────────────────────────────────────────────────────
  | { type: "agency:updated";      payload: { agencyId: string; status: string } }
  | { type: "user:banned";         payload: { userId: string; banType: string } }
  | { type: "user:unbanned";       payload: { userId: string } }
  | { type: "user:vip_changed";    payload: { userId: string; vipLevel: number } }
  | { type: "room:banned";         payload: { roomId: string } }
  | { type: "room:unbanned";       payload: { roomId: string } }
  | { type: "room:deleted";        payload: { roomId: string } }
  | { type: "banner:updated";      payload: Record<string, unknown> }
  | { type: "settings:updated";    payload: Partial<Record<string, unknown>> }
  | { type: "notification:sent";   payload: { title: string; body: string } }
  | { type: "moment:hidden";       payload: { momentId: string } }
  | { type: "vip:changed";         payload: { userId: string; level: number } };

/**
 * Fire-and-forget: emit an event to Express which broadcasts to Flutter clients.
 * Never throws — failures are logged as warnings only.
 */
export async function notify(event: AdminEvent): Promise<void> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) {
    // Token not configured — skip silently in dev, warn in prod
    if (process.env.NODE_ENV === "production") {
      console.warn("[notify] INTERNAL_SERVICE_TOKEN not set — realtime events disabled");
    }
    return;
  }

  try {
    await fetch(`${EXPRESS_API_URL}/api/admin/events/emit`, {
      method:  "POST",
      headers: {
        "Content-Type":        "application/json",
        "X-Service-Token":     token,
        "X-Dashboard-Client":  "next-admin/1.0",
      },
      body:  JSON.stringify(event),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[notify] Failed to emit event:", (err as Error).message);
  }
}

// ── Convenience wrappers ───────────────────────────────────────────────────

export const notifyIconChange  = (e: Extract<AdminEvent, { type: `icon:${string}` }>) => notify(e);
export const notifyAssetChange = (e: Extract<AdminEvent, { type: `asset:${string}` }>) => notify(e);
export const notifyAgency      = (agencyId: string, status: string) =>
  notify({ type: "agency:updated", payload: { agencyId, status } });
export const notifyUserBanned  = (userId: string, banType: string) =>
  notify({ type: "user:banned", payload: { userId, banType } });
export const notifyUserUnbanned = (userId: string) =>
  notify({ type: "user:unbanned", payload: { userId } });
export const notifyVipChange   = (userId: string, level: number) =>
  notify({ type: "vip:changed", payload: { userId, level } });
export const notifyRoomBanned  = (roomId: string) =>
  notify({ type: "room:banned", payload: { roomId } });
export const notifyRoomDeleted = (roomId: string) =>
  notify({ type: "room:deleted", payload: { roomId } });
export const notifyBanner      = (data: Record<string, unknown>) =>
  notify({ type: "banner:updated", payload: data });
export const notifySettings    = (data: Partial<Record<string, unknown>>) =>
  notify({ type: "settings:updated", payload: data });
export const notifyMoment      = (momentId: string) =>
  notify({ type: "moment:hidden", payload: { momentId } });
