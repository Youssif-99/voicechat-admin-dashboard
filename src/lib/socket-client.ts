/**
 * Socket.IO Client — Realtime admin events
 *
 * Used client-side only (browser). Connects to the Express Socket.IO server
 * and emits admin actions so Flutter clients receive realtime updates.
 *
 * Usage (client component):
 *   import { useAdminSocket } from "@/lib/socket-client";
 *   const { connected } = useAdminSocket();
 *
 * The Express server must handle these admin namespaced events and
 * broadcast them to Flutter clients via the appropriate rooms/channels.
 */

"use client";

import { io, Socket } from "socket.io-client";

// ── Event types ────────────────────────────────────────────────────────────

export type AdminSocketEvent =
  | { type: "icon:updated";        payload: { iconId: string; key: string } }
  | { type: "icon:cache_cleared";  payload: { version: number; etag: string } }
  // ── AppAsset realtime events ───────────────────────────────────────────────
  | { type: "asset:created";       payload: { assetId: string; key: string; category: string } }
  | { type: "asset:updated";       payload: { assetId: string; key: string; version: number } }
  | { type: "asset:deleted";       payload: { assetId: string; key: string } }
  | { type: "asset:cache_cleared"; payload: { version: number; etag: string } }
  // ── Other events ──────────────────────────────────────────────────────────
  | { type: "agency:updated";      payload: { agencyId: string; status: string } }
  | { type: "user:banned";         payload: { userId: string; banType: string } }
  | { type: "user:unbanned";       payload: { userId: string } }
  | { type: "user:vip_changed";    payload: { userId: string; vipLevel: number } }
  | { type: "room:banned";         payload: { roomId: string } }
  | { type: "room:unbanned";       payload: { roomId: string } }
  | { type: "banner:updated";      payload: Record<string, unknown> }
  | { type: "settings:updated";    payload: Partial<Record<string, unknown>> }
  | { type: "notification:sent";   payload: { title: string; body: string } }
  | { type: "moment:hidden";       payload: { momentId: string } };

// ── Singleton socket instance ──────────────────────────────────────────────

let socket: Socket | null = null;

export function getAdminSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_EXPRESS_URL ||
    "http://localhost:4000";

  socket = io(socketUrl, {
    path: "/socket.io",
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("[AdminSocket] connected:", socket?.id);
    socket?.emit("admin:join", { role: "admin" });
  });

  socket.on("disconnect", (reason) => {
    console.log("[AdminSocket] disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[AdminSocket] connection error:", err.message);
  });

  return socket;
}

export function disconnectAdminSocket(): void {
  socket?.disconnect();
  socket = null;
}

/**
 * Emits an admin action event to the Express server.
 * Express then broadcasts to the appropriate Flutter Socket.IO rooms.
 */
export function emitAdminEvent(
  socket: Socket,
  event: AdminSocketEvent
): void {
  if (!socket.connected) {
    console.warn("[AdminSocket] emit skipped — not connected");
    return;
  }
  socket.emit("admin:event", event);
}

// ── React hook ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

export function useAdminSocket(accessToken?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const s = getAdminSocket(accessToken);
    socketRef.current = s;

    const onConnect    = () => { setConnected(true);  setError(null); };
    const onDisconnect = () => { setConnected(false); };
    const onError      = (err: Error) => { setError(err.message); };

    s.on("connect",      onConnect);
    s.on("disconnect",   onDisconnect);
    s.on("connect_error", onError);

    return () => {
      s.off("connect",      onConnect);
      s.off("disconnect",   onDisconnect);
      s.off("connect_error", onError);
    };
  }, [accessToken]);

  const emit = (event: AdminSocketEvent) => {
    if (socketRef.current) {
      emitAdminEvent(socketRef.current, event);
    }
  };

  return { connected, error, emit, socket: socketRef.current };
}
