/**
 * Audit Logger — records every significant admin action.
 *
 * Two transports:
 *   1. Express backend  → POST /api/admin/audit  (persists in PostgreSQL via Express)
 *   2. Console fallback → if Express is unreachable in development
 *
 * The Icon system already writes its own IconAuditLog via Prisma (kept as-is).
 * This module covers all OTHER admin actions (users, agencies, rooms, etc.).
 *
 * Usage:
 *   import { auditLog } from "@/lib/audit";
 *   await auditLog(session, "USER_BANNED", { userId, banType });
 */

import { EXPRESS_API_URL } from "./api-client";
import type { AdminRole } from "./auth";

export type AuditAction =
  // Auth
  | "ADMIN_LOGIN" | "ADMIN_LOGOUT" | "ADMIN_CREATED" | "ADMIN_DELETED" | "ADMIN_ROLE_CHANGED"
  // Users
  | "USER_BANNED" | "USER_UNBANNED" | "USER_PROFILE_UPDATED" | "USER_VIP_CHANGED"
  // Rooms
  | "ROOM_BANNED" | "ROOM_UNBANNED" | "ROOM_UPDATED" | "ROOM_DELETED"
  // Agencies
  | "AGENCY_APPROVED" | "AGENCY_REJECTED" | "AGENCY_SUSPENDED" | "AGENCY_BANNED"
  | "AGENCY_RESTORED" | "AGENCY_LEVEL_UPDATED" | "AGENCY_CREATED"
  // Moments
  | "MOMENT_HIDDEN" | "MOMENT_RESTORED" | "MOMENT_DELETED"
  // Reports
  | "REPORT_RESOLVED" | "REPORT_DISMISSED"
  // VIP
  | "VIP_GRANTED" | "VIP_REVOKED"
  // Banners
  | "BANNER_CREATED" | "BANNER_UPDATED" | "BANNER_DELETED" | "BANNER_TOGGLED"
  // Notifications
  | "NOTIFICATION_SENT"
  // Store / Gifts
  | "STORE_ITEM_CREATED" | "STORE_ITEM_DELETED" | "STORE_ITEM_TOGGLED"
  | "GIFT_CREATED" | "GIFT_DELETED" | "GIFT_TOGGLED"
  // Wallet
  | "WALLET_ADJUSTED"
  // Settings
  | "SETTINGS_UPDATED" | "SETTINGS_CACHE_FLUSHED";

export type AuditEntry = {
  action:     AuditAction;
  adminId:    string;
  adminName:  string;
  adminEmail: string;
  adminRole:  AdminRole;
  metadata?:  Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp:  string;
};

export async function auditLog(
  admin: { adminId: string; name: string; email: string; role: AdminRole },
  action: AuditAction,
  metadata?: Record<string, unknown>,
  req?: { ip?: string; userAgent?: string }
): Promise<void> {
  const entry: AuditEntry = {
    action,
    adminId:    admin.adminId,
    adminName:  admin.name,
    adminEmail: admin.email,
    adminRole:  admin.role,
    metadata,
    ipAddress:  req?.ip,
    userAgent:  req?.userAgent,
    timestamp:  new Date().toISOString(),
  };

  // Always log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.log("[AUDIT]", JSON.stringify(entry));
  }

  // Send to Express backend for persistent storage
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) return; // graceful skip if not configured

  try {
    await fetch(`${EXPRESS_API_URL}/api/admin/audit`, {
      method:  "POST",
      headers: {
        "Content-Type":       "application/json",
        "X-Service-Token":    token,
        "X-Dashboard-Client": "next-admin/1.0",
      },
      body:  JSON.stringify(entry),
      cache: "no-store",
    });
  } catch (err) {
    // Never block the admin action because of audit failure
    console.warn("[audit] Failed to persist audit log:", (err as Error).message);
  }
}
