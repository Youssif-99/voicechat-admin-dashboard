/**
 * Express API Client
 *
 * Single point of contact for ALL communication with the Express backend.
 * - Never import prisma in business-logic code — use this instead.
 * - Automatically attaches the admin Bearer token from the session cookie.
 * - Handles token refresh transparently on 401 responses.
 * - Throws ApiError with status + message on non-2xx responses.
 *
 * Usage (server components / server actions):
 *   import { api } from "@/lib/api-client";
 *   const users = await api.get<UsersResponse>("/admin/users");
 */

import { getSession, refreshAccessToken, destroySession } from "./auth";

// ── Config ─────────────────────────────────────────────────────────────────

export const EXPRESS_API_URL = (
  process.env.EXPRESS_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

// ── Error type ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Response types ─────────────────────────────────────────────────────────

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

// ── Core fetch wrapper ─────────────────────────────────────────────────────

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
};

async function fetchExpress<T>(
  path: string,
  options: FetchOptions = {},
  retried = false
): Promise<T> {
  const session = await getSession();

  // Build URL with query params
  const url = new URL(`${EXPRESS_API_URL}${path}`);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Dashboard-Client": "next-admin/1.0",
    ...(options.headers as Record<string, string>),
  };

  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  const init: RequestInit = {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Always revalidate on admin dashboard — no stale data
    cache: "no-store",
  };

  const res = await fetch(url.toString(), init);

  // Transparent token refresh on 401
  if (res.status === 401 && !retried && session?.refreshToken) {
    const newAccessToken = await refreshAccessToken(session.refreshToken);
    if (newAccessToken) {
      return fetchExpress<T>(path, options, true);
    }
    // Refresh failed — session is dead
    await destroySession();
    throw new ApiError(401, "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let data: unknown;
    try {
      data = await res.json();
      message = (data as Record<string, string>)?.message
        || (data as Record<string, string>)?.error
        || message;
    } catch {
      // non-JSON body
    }
    throw new ApiError(res.status, message, data);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Multipart helper (for file uploads) ───────────────────────────────────

async function fetchMultipart<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PUT" | "PATCH" = "POST"
): Promise<T> {
  const session = await getSession();
  const url = `${EXPRESS_API_URL}${path}`;

  const headers: Record<string, string> = {
    "X-Dashboard-Client": "next-admin/1.0",
  };
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data?.message || data?.error || message;
    } catch { /* ignore */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, params?: FetchOptions["params"]) =>
    fetchExpress<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    fetchExpress<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) =>
    fetchExpress<T>(path, { method: "PUT", body }),

  patch: <T>(path: string, body?: unknown) =>
    fetchExpress<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string, body?: unknown) =>
    fetchExpress<T>(path, { method: "DELETE", body }),

  upload: <T>(path: string, formData: FormData, method?: "POST" | "PUT" | "PATCH") =>
    fetchMultipart<T>(path, formData, method),
};

// ── Domain-specific API modules ────────────────────────────────────────────
// Grouping by resource keeps call sites clean and auto-complete friendly.

// ──────────────────────────────────────
//  AUTH
// ──────────────────────────────────────
export type AdminAuthResponse = {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
};

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "SUPPORT";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AdminAuthResponse>("/api/admin/auth/login", { email, password }),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string }>("/api/admin/auth/refresh", { refreshToken }),

  logout: () =>
    api.post<void>("/api/admin/auth/logout"),

  me: () =>
    api.get<AdminAuthResponse["admin"]>("/api/admin/auth/me"),
};

// ──────────────────────────────────────
//  ADMINS
// ──────────────────────────────────────
export type AdminRecord = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt?: string;
};

export const adminsApi = {
  list: () =>
    api.get<AdminRecord[]>("/api/admin/admins"),

  create: (data: { name: string; email: string; password: string; role: AdminRole }) =>
    api.post<AdminRecord>("/api/admin/admins", data),

  update: (id: string, data: Partial<{ name: string; role: AdminRole }>) =>
    api.patch<AdminRecord>(`/api/admin/admins/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/admins/${id}`),

  resetPassword: (id: string, newPassword: string) =>
    api.patch<void>(`/api/admin/admins/${id}/password`, { newPassword }),
};

// ──────────────────────────────────────
//  USERS
// ──────────────────────────────────────
export type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  coins: number;
  vipLevel: number;
  svipLevel?: number;
  isAgent: boolean;
  isHost: boolean;
  status: "ACTIVE" | "BANNED" | "SUSPENDED";
  banType?: string;
  banReason?: string;
  banExpiresAt?: string;
  createdAt: string;
  agencyId?: string;
  agency?: { id: string; name: string };
};

export const usersApi = {
  list: (params?: {
    q?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<PaginatedResponse<UserRecord>>("/api/admin/users", params),

  get: (id: string) =>
    api.get<UserRecord>(`/api/admin/users/${id}`),

  ban: (id: string, data: { banType: string; banReason?: string }) =>
    api.patch<UserRecord>(`/api/admin/users/${id}/ban`, data),

  unban: (id: string) =>
    api.patch<UserRecord>(`/api/admin/users/${id}/unban`),

  update: (id: string, data: Partial<{ displayName: string; avatarUrl: string }>) =>
    api.patch<UserRecord>(`/api/admin/users/${id}`, data),

  setVip: (id: string, vipLevel: number) =>
    api.patch<UserRecord>(`/api/admin/users/${id}/vip`, { vipLevel }),

  setSvip: (id: string, svipLevel: number) =>
    api.patch<UserRecord>(`/api/admin/users/${id}/svip`, { svipLevel }),
};

// ──────────────────────────────────────
//  ROOMS
// ──────────────────────────────────────
export type RoomRecord = {
  id: string;
  name: string;
  coverUrl?: string;
  seatsLimit: number;
  type: "PUBLIC" | "PRIVATE";
  status: "ACTIVE" | "BANNED" | "LOCKED";
  createdAt: string;
  ownerId: string;
  owner: { id: string; displayName: string; username: string };
  activeUsers?: number;
};

export const roomsApi = {
  list: (params?: { q?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<RoomRecord>>("/api/admin/rooms", params),

  get: (id: string) =>
    api.get<RoomRecord>(`/api/admin/rooms/${id}`),

  ban: (id: string, reason?: string) =>
    api.patch<RoomRecord>(`/api/admin/rooms/${id}/ban`, { reason }),

  unban: (id: string) =>
    api.patch<RoomRecord>(`/api/admin/rooms/${id}/unban`),

  update: (id: string, data: Partial<{ name: string; coverUrl: string }>) =>
    api.patch<RoomRecord>(`/api/admin/rooms/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/rooms/${id}`),

  kick: (roomId: string, userId: string) =>
    api.post<void>(`/api/admin/rooms/${roomId}/kick`, { userId }),
};

// ──────────────────────────────────────
//  AGENCIES
// ──────────────────────────────────────
export type AgencyRecord = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "BANNED";
  level: string;
  commissionRate: number;
  totalEarnings: number;
  notes?: string;
  createdAt: string;
  reviewedAt?: string;
  hostsCount?: number;
};

export const agenciesApi = {
  list: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<AgencyRecord>>("/api/admin/agencies", params),

  get: (id: string) =>
    api.get<AgencyRecord>(`/api/admin/agencies/${id}`),

  create: (data: {
    name: string; ownerName: string; phone: string;
    email?: string; notes?: string;
  }) => api.post<AgencyRecord>("/api/admin/agencies", data),

  approve: (id: string, notes?: string) =>
    api.patch<AgencyRecord>(`/api/admin/agencies/${id}/approve`, { notes }),

  reject: (id: string, reason?: string) =>
    api.patch<AgencyRecord>(`/api/admin/agencies/${id}/reject`, { reason }),

  suspend: (id: string, reason?: string) =>
    api.patch<AgencyRecord>(`/api/admin/agencies/${id}/suspend`, { reason }),

  ban: (id: string, reason?: string) =>
    api.patch<AgencyRecord>(`/api/admin/agencies/${id}/ban`, { reason }),

  restore: (id: string) =>
    api.patch<AgencyRecord>(`/api/admin/agencies/${id}/restore`),

  updateLevel: (id: string, data: { level: string; commissionRate: number }) =>
    api.patch<AgencyRecord>(`/api/admin/agencies/${id}/level`, data),
};

// ──────────────────────────────────────
//  PAYMENTS
// ──────────────────────────────────────
export type PaymentRecord = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED";
  description?: string;
  createdAt: string;
  userId: string;
  user: { id: string; displayName: string; username: string };
};

export type PaymentStats = {
  grandTotal: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  recentCount: number;
};

export const paymentsApi = {
  list: (params?: { type?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<PaymentRecord>>("/api/admin/payments", params),

  stats: () =>
    api.get<PaymentStats>("/api/admin/payments/stats"),

  refund: (id: string, reason?: string) =>
    api.patch<PaymentRecord>(`/api/admin/payments/${id}/refund`, { reason }),
};

// ──────────────────────────────────────
//  MOMENTS
// ──────────────────────────────────────
export type MomentRecord = {
  id: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: "IMAGE" | "VIDEO";
  status: "ACTIVE" | "HIDDEN" | "REPORTED" | "DELETED";
  likesCount: number;
  commentsCount: number;
  reportsCount: number;
  createdAt: string;
  userId: string;
  user: { id: string; displayName: string; username: string; avatarUrl?: string };
};

export const momentsApi = {
  list: (params?: { status?: string; q?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<MomentRecord>>("/api/admin/moments", params),

  hide: (id: string, reason?: string) =>
    api.patch<MomentRecord>(`/api/admin/moments/${id}/hide`, { reason }),

  restore: (id: string) =>
    api.patch<MomentRecord>(`/api/admin/moments/${id}/restore`),

  delete: (id: string, reason?: string) =>
    api.delete<void>(`/api/admin/moments/${id}`),
};

// ──────────────────────────────────────
//  VIP / SVIP
// ──────────────────────────────────────
export type VipConfig = {
  level: number;
  name: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  benefits: string[];
  badgeIconKey?: string;
  crownIconKey?: string;
  enabled: boolean;
};

export const vipApi = {
  listConfigs: () =>
    api.get<VipConfig[]>("/api/admin/vip/configs"),

  updateConfig: (level: number, data: Partial<VipConfig>) =>
    api.patch<VipConfig>(`/api/admin/vip/configs/${level}`, data),

  listVipUsers: (params?: { level?: number; page?: number }) =>
    api.get<PaginatedResponse<UserRecord>>("/api/admin/vip/users", params),

  grant: (userId: string, level: number, durationDays?: number) =>
    api.post<void>("/api/admin/vip/grant", { userId, level, durationDays }),

  revoke: (userId: string) =>
    api.post<void>("/api/admin/vip/revoke", { userId }),
};

// ──────────────────────────────────────
//  REPORTS
// ──────────────────────────────────────
export type ReportRecord = {
  id: string;
  type: "USER" | "ROOM" | "MOMENT" | "CHAT";
  reason: string;
  description?: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporterId: string;
  reporter: { id: string; displayName: string; username: string };
  targetId: string;
  targetType: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
};

export const reportsApi = {
  list: (params?: {
    status?: string; type?: string;
    page?: number; pageSize?: number;
  }) => api.get<PaginatedResponse<ReportRecord>>("/api/admin/reports", params),

  resolve: (id: string, resolution: string) =>
    api.patch<ReportRecord>(`/api/admin/reports/${id}/resolve`, { resolution }),

  dismiss: (id: string, reason?: string) =>
    api.patch<ReportRecord>(`/api/admin/reports/${id}/dismiss`, { reason }),

  assign: (id: string, adminId: string) =>
    api.patch<ReportRecord>(`/api/admin/reports/${id}/assign`, { adminId }),
};

// ──────────────────────────────────────
//  BANNERS
// ──────────────────────────────────────
export type BannerRecord = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  screen?: string;
  position: number;
  enabled: boolean;
  startAt?: string;
  endAt?: string;
  createdAt: string;
};

export const bannersApi = {
  list: () =>
    api.get<BannerRecord[]>("/api/admin/banners"),

  create: (data: Omit<BannerRecord, "id" | "createdAt">) =>
    api.post<BannerRecord>("/api/admin/banners", data),

  update: (id: string, data: Partial<BannerRecord>) =>
    api.patch<BannerRecord>(`/api/admin/banners/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/banners/${id}`),

  reorder: (ids: string[]) =>
    api.post<void>("/api/admin/banners/reorder", { ids }),
};

// ──────────────────────────────────────
//  NOTIFICATIONS
// ──────────────────────────────────────
export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  targetType: "ALL" | "USER" | "ROLE" | "AGENCY";
  targetId?: string;
  iconKey?: string;
  sentAt?: string;
  scheduledAt?: string;
  status: "DRAFT" | "SENT" | "SCHEDULED" | "FAILED";
  recipientsCount?: number;
  createdAt: string;
};

export const notificationsApi = {
  list: (params?: { status?: string; page?: number }) =>
    api.get<PaginatedResponse<NotificationRecord>>("/api/admin/notifications", params),

  send: (data: {
    title: string; body: string;
    targetType: NotificationRecord["targetType"];
    targetId?: string; iconKey?: string;
  }) => api.post<NotificationRecord>("/api/admin/notifications/send", data),

  schedule: (data: {
    title: string; body: string;
    targetType: NotificationRecord["targetType"];
    targetId?: string; scheduledAt: string;
  }) => api.post<NotificationRecord>("/api/admin/notifications/schedule", data),

  cancel: (id: string) =>
    api.delete<void>(`/api/admin/notifications/${id}`),
};

// ──────────────────────────────────────
//  STORE
// ──────────────────────────────────────
export type StoreItemRecord = {
  id: string;
  name: string;
  description?: string;
  type: "FRAME" | "BUBBLE" | "ENTRANCE" | "COIN_BUNDLE" | "GIFT" | "BADGE";
  price: number;
  currency: "COIN" | "USD";
  iconKey?: string;
  imageUrl?: string;
  enabled: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
};

export const storeApi = {
  list: (params?: { type?: string; enabled?: boolean }) =>
    api.get<StoreItemRecord[]>("/api/admin/store/items", params),

  create: (data: Omit<StoreItemRecord, "id" | "createdAt">) =>
    api.post<StoreItemRecord>("/api/admin/store/items", data),

  update: (id: string, data: Partial<StoreItemRecord>) =>
    api.patch<StoreItemRecord>(`/api/admin/store/items/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/store/items/${id}`),

  toggleFeatured: (id: string, featured: boolean) =>
    api.patch<StoreItemRecord>(`/api/admin/store/items/${id}/featured`, { featured }),
};

// ──────────────────────────────────────
//  WALLET / ECONOMY
// ──────────────────────────────────────
export type WalletRecord = {
  userId: string;
  user: { displayName: string; username: string };
  coins: number;
  diamonds: number;
  totalEarned: number;
  totalSpent: number;
  lastTransactionAt?: string;
};

export type WalletTransaction = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: "COIN" | "DIAMOND" | "USD";
  direction: "CREDIT" | "DEBIT";
  description?: string;
  createdAt: string;
};

export const walletApi = {
  list: (params?: { q?: string; page?: number }) =>
    api.get<PaginatedResponse<WalletRecord>>("/api/admin/wallet", params),

  getUserWallet: (userId: string) =>
    api.get<WalletRecord>(`/api/admin/wallet/${userId}`),

  transactions: (userId: string, params?: { page?: number }) =>
    api.get<PaginatedResponse<WalletTransaction>>(
      `/api/admin/wallet/${userId}/transactions`, params
    ),

  adjustCoins: (userId: string, amount: number, reason: string) =>
    api.post<void>(`/api/admin/wallet/${userId}/adjust`, { amount, reason }),
};

// ──────────────────────────────────────
//  GIFTS
// ──────────────────────────────────────
export type GiftRecord = {
  id: string;
  name: string;
  iconKey?: string;
  imageUrl?: string;
  coinValue: number;
  animationUrl?: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
};

export const giftsApi = {
  list: (params?: { category?: string; enabled?: boolean }) =>
    api.get<GiftRecord[]>("/api/admin/gifts", params),

  create: (data: Omit<GiftRecord, "id" | "createdAt">) =>
    api.post<GiftRecord>("/api/admin/gifts", data),

  update: (id: string, data: Partial<GiftRecord>) =>
    api.patch<GiftRecord>(`/api/admin/gifts/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/admin/gifts/${id}`),
};

// ──────────────────────────────────────
//  SETTINGS
// ──────────────────────────────────────
export type AppSettings = {
  appName: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  minAppVersion: string;
  forceUpdateVersion?: string;
  termsUrl?: string;
  privacyUrl?: string;
  supportEmail?: string;
  maxRoomSeats: number;
  defaultRoomType: "PUBLIC" | "PRIVATE";
  coinToUsdRate: number;
  giftCommissionRate: number;
  agencyCommissionDefault: number;
  [key: string]: unknown;
};

export const settingsApi = {
  get: () =>
    api.get<AppSettings>("/api/admin/settings"),

  update: (data: Partial<AppSettings>) =>
    api.patch<AppSettings>("/api/admin/settings", data),

  flush: () =>
    api.post<void>("/api/admin/settings/cache/flush"),
};

// ──────────────────────────────────────
//  APP ASSETS
// ──────────────────────────────────────

export type AppAssetRecord = {
  id:           string;
  key:          string;
  name:         string;
  category:     string;
  imageUrl:     string | null;
  thumbnailUrl: string | null;
  mimeType:     string | null;
  hash:         string | null;
  width:        number | null;
  height:       number | null;
  version:      number;
  isActive:     boolean;
  deletedAt:    string | null;
  createdAt:    string;
  updatedAt:    string;
};

export type AppAssetCatalog = {
  etag:      string;
  version:   number;
  updatedAt: string;
  assets:    AppAssetRecord[];
};

export const assetsApi = {
  /** Public — Flutter consumes this */
  catalog: () =>
    api.get<AppAssetCatalog>("/api/assets"),

  byKey: (key: string) =>
    api.get<AppAssetRecord>(`/api/assets/${key}`),

  /** Admin CRUD */
  list: (params?: {
    q?: string; category?: string; isActive?: boolean;
    includeDeleted?: boolean; page?: number; pageSize?: number;
    sortBy?: string; sortDir?: string;
  }) => api.get<PaginatedResponse<AppAssetRecord>>("/api/admin/assets", params as Record<string, string | number | boolean | undefined | null>),

  get: (id: string) =>
    api.get<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}`),

  create: (formData: FormData) =>
    api.upload<{ asset: AppAssetRecord }>("/api/admin/assets", formData, "POST"),

  update: (id: string, formData: FormData) =>
    api.upload<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}`, formData, "PUT"),

  delete: (id: string) =>
    api.delete<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}`),

  restore: (id: string) =>
    api.put<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}?action=restore`),

  enable: (id: string) =>
    api.put<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}?action=enable`),

  disable: (id: string) =>
    api.put<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}?action=disable`),

  rollback: (id: string, targetVersion: number) =>
    api.put<{ asset: AppAssetRecord }>(`/api/admin/assets/${id}?action=rollback`, { targetVersion }),

  invalidateCache: () =>
    api.post<{ ok: boolean; etag: string; version: number }>("/api/admin/assets/cache-invalidate"),

  seed: () =>
    api.post<{ ok: boolean; created: number; skipped: number }>("/api/admin/assets/seed"),
};

// ──────────────────────────────────────
//  DASHBOARD STATS
// ──────────────────────────────────────
export type DashboardStats = {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalRooms: number;
  activeRooms: number;
  activeAgencies: number;
  pendingAgencies: number;
  totalRevenue: number;
  revenueByType: Record<string, number>;
  openReports: number;
  recentPayments: PaymentRecord[];
  recentAgencies: AgencyRecord[];
  recentUsers: UserRecord[];
};

export const statsApi = {
  dashboard: () =>
    api.get<DashboardStats>("/api/admin/stats/dashboard"),

  revenue: (period: "day" | "week" | "month" | "year") =>
    api.get<{ labels: string[]; values: number[] }>("/api/admin/stats/revenue", { period }),
};
