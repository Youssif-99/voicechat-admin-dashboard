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

/**
 * api-client.ts imports ONLY from auth.ts (read-only).
 * Cookie mutations (createSession / destroySession / refresh) live in
 * auth-mutations.ts and are called exclusively from Server Actions or
 * Route Handlers — never from the fetch pipeline which runs during
 * Server Component rendering where cookies().set() is forbidden.
 */
import { getSession } from "./auth";

// ── Config ─────────────────────────────────────────────────────────────────

export const EXPRESS_API_URL = (
  process.env.EXPRESS_API_URL || "http://localhost:3000"
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
  options: FetchOptions = {}
): Promise<T> {
  const session = await getSession();
  
  // Debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('[api-client] fetchExpress:', { 
      path, 
      hasSession: !!session, 
      hasToken: !!session?.accessToken,
      tokenPreview: session?.accessToken ? `${session.accessToken.substring(0, 30)}...` : 'NONE'
    });
  }

  // Build URL with query params
  const url = new URL(`${EXPRESS_API_URL}${path}`);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[api-client] Final URL:', url.toString());
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Dashboard-Client": "next-admin/1.0",
    ...(options.headers as Record<string, string>),
  };

  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[api-client] Authorization header set');
    }
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[api-client] ⚠️ NO SESSION OR TOKEN - Request will fail!');
    }
  }

  const init: RequestInit = {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Always revalidate on admin dashboard — no stale data
    cache: "no-store",
  };

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (err) {
    // Network error (ECONNREFUSED, timeout, DNS failure, etc.)
    // Wrap in ApiError with status 0 so every caller gets a typed error.
    const msg = (err instanceof Error ? err.message : String(err)) || "fetch failed";
    throw new ApiError(0, `تعذّر الاتصال بـ ${EXPRESS_API_URL} — ${msg}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[api-client] Response status:', res.status);
  }

  // ── 401 handling ────────────────────────────────────────────────────────
  // fetchExpress runs during Server Component rendering where cookies().set()
  // is forbidden. Token rotation happens in the /api/admin/session Route Handler
  // (called by middleware) before the page renders. If the token is still
  // expired here, throw a typed ApiError — the page renders the "session expired"
  // message with a login link. No crash, no cookie mutation.
  if (res.status === 401) {
    if (process.env.NODE_ENV !== 'production') {
      const errorBody = await res.text().catch(() => 'Could not read error body');
      console.log('[api-client] ❌ 401 Unauthorized. Backend response:', errorBody);
    }
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
  list: async (): Promise<AdminRecord[]> => {
    const raw = await api.get<unknown>("/api/admin/admins");
    const envelope = raw as { success?: boolean; data?: AdminRecord[] };
    return Array.isArray(envelope?.data) ? envelope.data : Array.isArray(raw) ? raw as AdminRecord[] : [];
  },

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

/**
 * UserRecord — normalised shape used throughout the dashboard.
 * Backend returns slightly different field names; see normaliseUser() below.
 *
 * Backend user fields (from GET /api/admin/users):
 *   id, username, displayName, email, phone, avatar (not avatarUrl),
 *   role, status, isBanned, banType, banExpiresAt, accountType,
 *   agencyApproved, coins, vipTier (string "NONE"|"VIP"|"SVIP_1"...), createdAt
 */
export type UserRecord = {
  id:           string;
  username:     string;
  displayName:  string;
  avatarUrl?:   string;
  phone?:       string;
  email?:       string;
  coins:        number;
  vipLevel:     number;   // derived from vipTier
  vipTier?:     string;   // raw string from backend
  svipLevel?:   number;
  isAgent:      boolean;
  isHost:       boolean;
  status:       "ACTIVE" | "BANNED" | "SUSPENDED";
  banType?:     string;
  banReason?:   string;
  banExpiresAt?:string;
  createdAt:    string;
  agencyId?:    string;
  agency?:      { id: string; name: string };
};

/** Map VipTier string → numeric level (0 = no VIP) */
function vipTierToLevel(tier: string | null | undefined): number {
  if (!tier || tier === "NONE") return 0;
  if (tier === "VIP")           return 1;
  // SVIP_1 → 2, SVIP_2 → 3 ... SVIP_5 → 6, TEST_VIP → 1, TEST_SVIP → 2
  const svip = tier.match(/SVIP_(\d)/);
  if (svip) return 1 + parseInt(svip[1], 10);
  if (tier.includes("TEST")) return 1;
  return 1;
}

/**
 * Map dashboard banType → backend banType
 * Dashboard UI sends: DAY_1, DAY_3, WEEK_1, PERMANENT, NETWORK
 * Backend expects:    ONE_DAY, THREE_DAYS, NETWORK
 * PERMANENT and WEEK_1 → ONE_DAY (backend longest non-network ban is ONE_DAY/THREE_DAYS)
 * We use NETWORK for PERMANENT as it's the closest "indefinite" equivalent.
 */
function mapBanType(dashboardBanType: string): string {
  const map: Record<string, string> = {
    DAY_1:     "ONE_DAY",
    DAY_3:     "THREE_DAYS",
    WEEK_1:    "THREE_DAYS",   // no WEEK_1 on backend — use THREE_DAYS
    PERMANENT: "NETWORK",      // NETWORK = permanent network-level ban
    NETWORK:   "NETWORK",
    // passthrough if backend values are already sent
    ONE_DAY:    "ONE_DAY",
    THREE_DAYS: "THREE_DAYS",
  };
  return map[dashboardBanType] ?? "ONE_DAY";
}

/**
 * Map backend banType → dashboard display key
 */
function mapBanTypeFromBackend(backendBanType: string | undefined): string | undefined {
  if (!backendBanType) return undefined;
  const map: Record<string, string> = {
    ONE_DAY:    "DAY_1",
    THREE_DAYS: "DAY_3",
    NETWORK:    "NETWORK",
  };
  return map[backendBanType] ?? backendBanType;
}

function normaliseUser(raw: Record<string, unknown>): UserRecord {
  return {
    id:          String(raw.id          ?? ""),
    username:    String(raw.username    ?? ""),
    displayName: String(raw.displayName ?? raw.username ?? ""),
    avatarUrl:   (raw.avatarUrl ?? raw.avatar) as string | undefined,
    phone:       raw.phone   as string | undefined,
    email:       raw.email   as string | undefined,
    coins:       Number(raw.coins ?? 0),
    vipLevel:    vipTierToLevel(raw.vipTier as string),
    vipTier:     raw.vipTier as string | undefined,
    svipLevel:   raw.svipLevel as number | undefined,
    isAgent:     !!(raw.isAgent ?? (raw.role === "AGENT")),
    isHost:      !!(raw.isHost  ?? (raw.role === "HOST")),
    status:      (raw.status ?? "ACTIVE") as UserRecord["status"],
    banType:     mapBanTypeFromBackend(raw.banType as string | undefined),
    banReason:   raw.banReason as string | undefined,
    banExpiresAt:raw.banExpiresAt as string | undefined,
    createdAt:   String(raw.createdAt ?? ""),
    agencyId:    raw.agencyId as string | undefined,
    agency:      raw.agency as { id: string; name: string } | undefined,
  };
}

type RawPaginatedEnvelope<T> = {
  success?: boolean;
  data:     T[];
  total:    number;
  page:     number;
  pageSize: number;
  pages:    number;
};

function normalisePaginated<T>(
  raw: unknown,
  itemNormaliser?: (item: Record<string, unknown>) => T
): PaginatedResponse<T> {
  const r = raw as RawPaginatedEnvelope<Record<string, unknown>>;
  const items = Array.isArray(r.data) ? r.data : [];
  return {
    data:     itemNormaliser ? items.map(itemNormaliser) : items as unknown as T[],
    total:    Number(r.total    ?? 0),
    page:     Number(r.page     ?? 1),
    pageSize: Number(r.pageSize ?? 50),
    pages:    Number(r.pages    ?? 1),
  };
}

export const usersApi = {
  list: async (params?: {
    q?: string; status?: string; page?: number; pageSize?: number;
  }): Promise<PaginatedResponse<UserRecord>> => {
    const raw = await api.get<unknown>("/api/admin/users", params);
    return normalisePaginated(raw, normaliseUser as (item: Record<string, unknown>) => UserRecord);
  },

  get: (id: string) =>
    api.get<UserRecord>(`/api/admin/users/${id}`),

  ban: (id: string, data: { banType: string; banReason?: string }) =>
    api.patch<UserRecord>(`/api/admin/users/${id}/ban`, {
      ...data,
      banType: mapBanType(data.banType),
    }),

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

/**
 * Backend returns:
 *   { id, name, image, isPrivate, isActive, maxSeats, ownerId, owner, activeUsers, createdAt }
 *
 * Dashboard expects:
 *   { id, name, coverUrl, type, seatsLimit, status, ownerId, owner, activeUsers, createdAt }
 */
function normaliseRoom(raw: Record<string, unknown>): RoomRecord {
  const owner = (raw.owner ?? {}) as Record<string, unknown>;
  return {
    id:          String(raw.id          ?? ""),
    name:        String(raw.name        ?? ""),
    coverUrl:    (raw.coverUrl ?? raw.image) as string | undefined,
    seatsLimit:  Number(raw.seatsLimit  ?? raw.maxSeats ?? 0),
    type:        raw.isPrivate ? "PRIVATE" : "PUBLIC",
    // isActive:false means closed/banned; isActive:true means active
    status:      raw.isActive === false ? "BANNED" : "ACTIVE",
    createdAt:   String(raw.createdAt   ?? ""),
    ownerId:     String(raw.ownerId     ?? ""),
    owner: {
      id:          String(owner.id          ?? ""),
      username:    String(owner.username    ?? ""),
      displayName: String(owner.displayName ?? owner.username ?? ""),
    },
    activeUsers: raw.activeUsers as number | undefined,
  };
}

export const roomsApi = {
  list: async (params?: { q?: string; status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<RoomRecord>> => {
    // Backend uses isActive filter — map status param
    const backendParams: Record<string, string | number | boolean | undefined | null> = { ...params };
    if (params?.status === "ACTIVE")  backendParams.status = "ACTIVE";
    if (params?.status === "BANNED")  { backendParams.status = "CLOSED"; }
    const raw = await api.get<unknown>("/api/admin/rooms", backendParams);
    return normalisePaginated(raw, normaliseRoom as (item: Record<string, unknown>) => RoomRecord);
  },

  get: async (id: string): Promise<RoomRecord> => {
    const raw = await api.get<unknown>(`/api/admin/rooms/${id}`);
    const envelope = raw as { success?: boolean; data?: Record<string, unknown> };
    const data = envelope?.data ?? (raw as Record<string, unknown>);
    return normaliseRoom(data as Record<string, unknown>);
  },

  ban: (id: string, reason?: string) =>
    api.patch<RoomRecord>(`/api/admin/rooms/${id}/ban`, { reason }),

  unban: (id: string) =>
    api.patch<RoomRecord>(`/api/admin/rooms/${id}/unban`),

  update: (id: string, data: Partial<{ name: string; coverUrl: string }>) => {
    // Backend field for cover image is 'image', not 'coverUrl'
    const payload: Record<string, unknown> = {};
    if (data.name     !== undefined) payload.name  = data.name;
    if (data.coverUrl !== undefined) payload.image = data.coverUrl;
    return api.patch<RoomRecord>(`/api/admin/rooms/${id}`, payload);
  },

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

/**
 * Backend /api/admin/agencies now returns AgencyRequest records transformed for compatibility:
 *   { id, name (from agencyName), ownerName, phone, email, country, documents,
 *     profileImage, bio, teamSize, offeredServices, status(PENDING|APPROVED|REJECTED),
 *     rejectionReason, reviewedAt, createdAt, hostsCount, level, commissionRate, totalEarnings,
 *     userId, user: { id, username, email, phone, accountType, agencyApproved, status } }
 *
 * Dashboard expects: id, name, ownerName, phone, email, status, level,
 *   commissionRate, totalEarnings, hostsCount, createdAt
 */
function normaliseAgencyStatus(raw: Record<string, unknown>): AgencyRecord["status"] {
  const s = String(raw.status ?? "");
  // AgencyRequest.status values
  if (s === "PENDING")   return "PENDING";
  if (s === "APPROVED")  return "APPROVED";
  if (s === "REJECTED")  return "REJECTED";
  if (s === "SUSPENDED") return "SUSPENDED";
  if (s === "BANNED")    return "BANNED";
  // Fallback for old User-based approach
  if (s === "PENDING_APPROVAL") return "PENDING";
  if (s === "ACTIVE" && raw.agencyApproved === true) return "APPROVED";
  return "PENDING";
}

function normaliseAgency(raw: Record<string, unknown>): AgencyRecord {
  return {
    id:             String(raw.id          ?? ""),
    // New: name comes from transformed AgencyRequest.agencyName
    name:           String(raw.name ?? raw.agencyName ?? raw.displayName ?? ""),
    // New: ownerName comes directly from AgencyRequest.ownerName
    ownerName:      String(raw.ownerName ?? raw.displayName ?? raw.username ?? ""),
    phone:          String(raw.phone       ?? ""),
    email:          raw.email as string | undefined,
    status:         normaliseAgencyStatus(raw),
    // level and commissionRate come from transformed response
    level:          String(raw.level ?? "عادي"),
    commissionRate: Number(raw.commissionRate ?? 0),
    totalEarnings:  Number(raw.totalEarnings  ?? 0),
    notes:          (raw.notes ?? raw.rejectionReason) as string | undefined,
    createdAt:      String(raw.createdAt  ?? ""),
    reviewedAt:     (raw.reviewedAt ?? raw.agencyApprovedAt) as string | undefined,
    hostsCount:     Number(raw.hostsCount ?? 0),
  };
}

export const agenciesApi = {
  list: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<AgencyRecord>> => {
    // New AgencyRequest-based API uses direct status values (no mapping needed)
    const backendParams: Record<string, string | number | boolean | undefined | null> = {
      page:     params?.page,
      pageSize: params?.pageSize,
      status:   params?.status, // Pass status directly — backend expects PENDING, APPROVED, REJECTED, etc.
    };
    const raw = await api.get<unknown>("/api/admin/agencies", backendParams);
    return normalisePaginated(raw, normaliseAgency as (item: Record<string, unknown>) => AgencyRecord);
  },

  get: async (id: string): Promise<AgencyRecord> => {
    const raw = await api.get<unknown>(`/api/admin/agencies/${id}`);
    const envelope = raw as { success?: boolean; data?: Record<string, unknown> };
    const data = envelope?.data ?? (raw as Record<string, unknown>);
    return normaliseAgency(data as Record<string, unknown>);
  },

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

/**
 * Backend GET /api/admin/payments returns:
 *   { id, userId, type, amountEGP, currency, status, createdAt,
 *     user: { id, username, email } }
 *
 * Backend GET /api/admin/payments/stats returns:
 *   { success, data: { grandTotal, totalTransactions, byStatus, byType } }
 *   where byType is an array of { type, _count: { id } } objects, NOT a plain Record.
 */
export type PaymentRecord = {
  id:          string;
  type:        string;
  amount:      number;     // normalised from amountEGP
  amountEGP?:  number;     // raw backend field
  currency:    string;
  status:      "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED";
  description?:string;
  createdAt:   string;
  userId:      string;
  user:        { id: string; displayName: string; username: string };
};

export type PaymentStats = {
  grandTotal:        number;
  totalTransactions: number;
  byType:            Record<string, number>;
  byStatus:          Record<string, number>;
  recentCount:       number;
};

function normalisePayment(raw: Record<string, unknown>): PaymentRecord {
  const user = (raw.user ?? {}) as Record<string, unknown>;
  return {
    id:          String(raw.id          ?? ""),
    type:        String(raw.type        ?? ""),
    amount:      Number(raw.amountEGP   ?? raw.amount ?? 0),
    amountEGP:   Number(raw.amountEGP   ?? 0),
    currency:    String(raw.currency    ?? "EGP"),
    status:      (raw.status ?? "PENDING") as PaymentRecord["status"],
    description: raw.description as string | undefined,
    createdAt:   String(raw.createdAt   ?? ""),
    userId:      String(raw.userId      ?? ""),
    user: {
      id:          String(user.id       ?? ""),
      username:    String(user.username  ?? ""),
      displayName: String(user.displayName ?? user.username ?? user.email ?? "—"),
    },
  };
}

function normalisePaymentStats(raw: unknown): PaymentStats {
  const envelope = raw as { success?: boolean; data?: Record<string, unknown> };
  const d = (envelope?.data ?? envelope) as Record<string, unknown>;

  // byType from backend is an array: [{ type: "COIN_PURCHASE", _count: { id: 5 } }]
  // normalise to Record<string, number>
  const byTypeRaw = d?.byType;
  const byType: Record<string, number> = {};
  if (Array.isArray(byTypeRaw)) {
    for (const item of byTypeRaw as Array<{ type: string; _count: { id: number } }>) {
      if (item.type) byType[item.type] = item._count?.id ?? 0;
    }
  } else if (byTypeRaw && typeof byTypeRaw === "object") {
    Object.assign(byType, byTypeRaw);
  }

  const byStatusRaw = d?.byStatus;
  const byStatus: Record<string, number> = {};
  if (Array.isArray(byStatusRaw)) {
    for (const item of byStatusRaw as Array<{ status: string; _count: { id: number } }>) {
      if (item.status) byStatus[item.status] = item._count?.id ?? 0;
    }
  } else if (byStatusRaw && typeof byStatusRaw === "object") {
    Object.assign(byStatus, byStatusRaw);
  }

  return {
    grandTotal:        Number(d?.grandTotal        ?? 0),
    totalTransactions: Number(d?.totalTransactions ?? 0),
    byType,
    byStatus,
    recentCount:       Number(d?.recentCount       ?? 0),
  };
}

export const paymentsApi = {
  list: async (params?: { type?: string; status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<PaymentRecord>> => {
    const raw = await api.get<unknown>("/api/admin/payments", params);
    return normalisePaginated(raw, normalisePayment as (item: Record<string, unknown>) => PaymentRecord);
  },

  stats: async (): Promise<PaymentStats> => {
    const raw = await api.get<unknown>("/api/admin/payments/stats");
    return normalisePaymentStats(raw);
  },

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

/**
 * Backend returns:
 *   { id, content, mediaUrls (array), visibility ('PUBLIC'|'PRIVATE'),
 *     viewsCount, createdAt, userId, user, likesCount, commentsCount, reportsCount,
 *     status (already normalised by admin.core.routes) }
 */
function normaliseMoment(raw: Record<string, unknown>): MomentRecord {
  const user = (raw.user ?? {}) as Record<string, unknown>;
  // mediaUrls is an array — take first entry as mediaUrl
  const mediaUrls = Array.isArray(raw.mediaUrls) ? (raw.mediaUrls as string[]) : [];
  const firstMedia = (raw.mediaUrl as string | undefined) ?? mediaUrls[0];
  return {
    id:            String(raw.id        ?? ""),
    content:       raw.content as string | undefined,
    mediaUrl:      firstMedia,
    mediaType:     firstMedia?.match(/\.(mp4|mov|avi|webm)$/i) ? "VIDEO" : firstMedia ? "IMAGE" : undefined,
    // backend admin.core.routes already sets status field to HIDDEN/ACTIVE based on visibility
    status:        (raw.status ?? (raw.visibility === "PRIVATE" ? "HIDDEN" : "ACTIVE")) as MomentRecord["status"],
    likesCount:    Number(raw.likesCount    ?? 0),
    commentsCount: Number(raw.commentsCount ?? 0),
    reportsCount:  Number(raw.reportsCount  ?? 0),
    createdAt:     String(raw.createdAt ?? ""),
    userId:        String(raw.userId    ?? ""),
    user: {
      id:          String(user.id          ?? ""),
      username:    String(user.username    ?? ""),
      displayName: String(user.displayName ?? user.username ?? ""),
      avatarUrl:   (user.avatarUrl ?? user.avatar) as string | undefined,
    },
  };
}

export const momentsApi = {
  list: async (params?: { status?: string; q?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<MomentRecord>> => {
    const raw = await api.get<unknown>("/api/admin/moments", params);
    return normalisePaginated(raw, normaliseMoment as (item: Record<string, unknown>) => MomentRecord);
  },

  hide: (id: string, reason?: string) =>
    api.patch<MomentRecord>(`/api/admin/moments/${id}/hide`, { reason }),

  restore: (id: string) =>
    api.patch<MomentRecord>(`/api/admin/moments/${id}/restore`),

  delete: (id: string, _reason?: string) =>
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

/**
 * Backend GET /api/admin/vip/users returns UserVip records:
 *   { id, userId, tier, startedAt, expiresAt, status, autoRenew, ..., User: { id, username, displayName, avatar } }
 *
 * We normalise these into the standard UserRecord shape expected by the VIP page.
 */
function normaliseVipUser(raw: Record<string, unknown>): UserRecord {
  // The nested user object has capital U in the backend response
  const u = (raw.User ?? raw.user ?? {}) as Record<string, unknown>;
  return {
    id:          String(u.id          ?? raw.userId ?? ""),
    username:    String(u.username    ?? ""),
    displayName: String(u.displayName ?? u.username ?? ""),
    avatarUrl:   (u.avatarUrl ?? u.avatar) as string | undefined,
    coins:       Number(u.coins       ?? 0),
    vipLevel:    vipTierToLevel(raw.tier as string),
    vipTier:     raw.tier as string | undefined,
    isAgent:     false,
    isHost:      false,
    status:      raw.status === "ACTIVE" ? "ACTIVE" : "ACTIVE",
    createdAt:   String(u.createdAt   ?? ""),
  };
}

export const vipApi = {
  listConfigs: async (): Promise<VipConfig[]> => {
    const raw = await api.get<unknown>("/api/admin/vip/configs");
    const envelope = raw as { success?: boolean; data?: unknown[] };
    const items = Array.isArray(envelope?.data) ? envelope.data : Array.isArray(raw) ? raw as unknown[] : [];
    return items as VipConfig[];
  },

  updateConfig: (level: number, data: Partial<VipConfig>) =>
    api.patch<VipConfig>(`/api/admin/vip/configs/${level}`, data),

  listVipUsers: async (params?: { level?: number; page?: number }): Promise<PaginatedResponse<UserRecord>> => {
    const raw = await api.get<unknown>("/api/admin/vip/users", params);
    return normalisePaginated(raw, normaliseVipUser as (item: Record<string, unknown>) => UserRecord);
  },

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
  list: async (): Promise<BannerRecord[]> => {
    const raw = await api.get<unknown>("/api/admin/banners");
    const envelope = raw as { success?: boolean; data?: BannerRecord[] };
    return Array.isArray(envelope?.data) ? envelope.data : Array.isArray(raw) ? raw as BannerRecord[] : [];
  },

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
  list: async (params?: { type?: string; enabled?: boolean }): Promise<StoreItemRecord[]> => {
    const raw = await api.get<unknown>("/api/admin/store/items", params as Record<string, string | number | boolean | undefined | null>);
    const envelope = raw as { success?: boolean; data?: StoreItemRecord[] };
    return Array.isArray(envelope?.data) ? envelope.data : Array.isArray(raw) ? raw as StoreItemRecord[] : [];
  },

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

/**
 * Backend UserWallet fields:
 *   id, userId, coinBalance, totalEarned, totalSpent, updatedAt,
 *   user: { id, username, displayName }
 *
 * Dashboard expects:
 *   userId, user, coins, diamonds, totalEarned, totalSpent, lastTransactionAt
 */
function normaliseWallet(raw: Record<string, unknown>): WalletRecord {
  const user = (raw.user ?? {}) as Record<string, unknown>;
  return {
    userId:            String(raw.userId            ?? raw.id ?? ""),
    coins:             Number(raw.coins             ?? raw.coinBalance ?? 0),
    diamonds:          Number(raw.diamonds          ?? 0),
    totalEarned:       Number(raw.totalEarned       ?? 0),
    totalSpent:        Number(raw.totalSpent        ?? 0),
    lastTransactionAt: (raw.lastTransactionAt ?? raw.updatedAt) as string | undefined,
    user: {
      username:    String(user.username    ?? ""),
      displayName: String(user.displayName ?? user.username ?? ""),
    },
  };
}

export const walletApi = {
  list: async (params?: { q?: string; page?: number }): Promise<PaginatedResponse<WalletRecord>> => {
    const raw = await api.get<unknown>("/api/admin/wallet", params);
    return normalisePaginated(raw, normaliseWallet as (item: Record<string, unknown>) => WalletRecord);
  },

  getUserWallet: async (userId: string): Promise<WalletRecord> => {
    const raw = await api.get<unknown>(`/api/admin/wallet/${userId}`);
    const envelope = raw as { success?: boolean; data?: Record<string, unknown> };
    return normaliseWallet((envelope?.data ?? raw) as Record<string, unknown>);
  },

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
  nameAr?: string;
  iconKey?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  coinValue: number;
  coinPrice?: number;
  animationUrl?: string;
  animationType?: "lottie" | "rive" | "webp" | "gif" | "png" | "svg" | "svga" | string;
  durationMs?: number;
  scale?: number;
  category: string;
  enabled: boolean;
  isActive?: boolean;
  isVipOnly?: boolean;
  isLegendary?: boolean;
  comboCount?: number;
  minTier?: string | null;
  sortOrder: number;
  createdAt: string;
};

/**
 * Backend Gift fields:
 *   id, name, nameAr, animationUrl, thumbnailUrl, coinPrice,
 *   category, isActive, isVipOnly, isLegendary, comboCount, minTier, createdAt
 *
 * Dashboard expects:
 *   id, name, iconKey, imageUrl, coinValue, animationUrl, category, enabled, sortOrder, createdAt
 */
function normaliseGift(raw: Record<string, unknown>): GiftRecord {
  const animUrl = (raw.animationUrl ?? "") as string;
  let inferredType = "lottie";
  if (animUrl.endsWith(".riv")) inferredType = "rive";
  else if (animUrl.endsWith(".gif")) inferredType = "gif";
  else if (animUrl.endsWith(".webp")) inferredType = "webp";
  else if (animUrl.endsWith(".png") || animUrl.endsWith(".jpg") || animUrl.endsWith(".jpeg")) inferredType = "png";
  else if (animUrl.endsWith(".svg")) inferredType = "svg";

  return {
    id:            String(raw.id            ?? ""),
    name:          String(raw.name          ?? raw.nameAr ?? ""),
    nameAr:        raw.nameAr ? String(raw.nameAr) : undefined,
    iconKey:       raw.iconKey as string | undefined,
    imageUrl:      (raw.imageUrl ?? raw.thumbnailUrl) as string | undefined,
    thumbnailUrl:  (raw.thumbnailUrl ?? raw.imageUrl) as string | undefined,
    coinValue:     Number(raw.coinValue     ?? raw.coinPrice ?? 0),
    coinPrice:     Number(raw.coinPrice     ?? raw.coinValue ?? 0),
    animationUrl:  animUrl || undefined,
    animationType: (raw.animationType as string) || inferredType,
    durationMs:    raw.durationMs !== undefined ? Number(raw.durationMs) : 3000,
    scale:         raw.scale !== undefined ? Number(raw.scale) : 1.0,
    category:      String(raw.category     ?? "regular"),
    enabled:       raw.enabled !== undefined ? Boolean(raw.enabled) : Boolean(raw.isActive ?? true),
    isActive:      raw.isActive !== undefined ? Boolean(raw.isActive) : Boolean(raw.enabled ?? true),
    isVipOnly:     Boolean(raw.isVipOnly),
    isLegendary:   Boolean(raw.isLegendary),
    comboCount:    Number(raw.comboCount    ?? 3),
    minTier:       (raw.minTier as string) || null,
    sortOrder:     Number(raw.sortOrder     ?? 0),
    createdAt:     String(raw.createdAt    ?? ""),
  };
}

export const giftsApi = {
  list: async (params?: { category?: string; enabled?: boolean; q?: string }): Promise<GiftRecord[]> => {
    const raw = await api.get<unknown>("/api/admin/gifts", params as Record<string, string | number | boolean | undefined | null>);
    const envelope = raw as { success?: boolean; data?: unknown[] };
    const items = Array.isArray(envelope?.data) ? envelope.data : Array.isArray(raw) ? raw as unknown[] : [];
    return items.map(item => normaliseGift(item as Record<string, unknown>));
  },

  get: async (id: string): Promise<GiftRecord | null> => {
    const raw = await api.get<unknown>(`/api/admin/gifts/${id}`).catch(() => null);
    const envelope = raw as { success?: boolean; data?: unknown };
    const item = envelope?.data ?? raw;
    if (!item) return null;
    return normaliseGift(item as Record<string, unknown>);
  },

  create: (data: Partial<GiftRecord>) =>
    api.post<GiftRecord>("/api/admin/gifts", {
      name:         data.name,
      nameAr:       data.nameAr || data.name,
      animationUrl: data.animationUrl ?? "",
      thumbnailUrl: (data.imageUrl || data.thumbnailUrl) ?? "",
      coinPrice:    (data.coinValue ?? data.coinPrice) ?? 0,
      category:     data.category ?? "regular",
      isActive:     data.enabled !== undefined ? data.enabled : (data.isActive !== undefined ? data.isActive : true),
      isVipOnly:    Boolean(data.isVipOnly),
      isLegendary:  Boolean(data.isLegendary),
      comboCount:   data.comboCount ?? 3,
      minTier:      data.minTier ?? null,
    }),

  update: (id: string, data: Partial<GiftRecord>) =>
    api.patch<GiftRecord>(`/api/admin/gifts/${id}`, {
      ...(data.name         !== undefined && { name: data.name }),
      ...(data.nameAr       !== undefined && { nameAr: data.nameAr }),
      ...(data.animationUrl !== undefined && { animationUrl: data.animationUrl }),
      ...((data.imageUrl !== undefined || data.thumbnailUrl !== undefined) && { thumbnailUrl: data.imageUrl ?? data.thumbnailUrl }),
      ...((data.coinValue !== undefined || data.coinPrice !== undefined) && { coinPrice: data.coinValue ?? data.coinPrice }),
      ...(data.category     !== undefined && { category: data.category }),
      ...(data.enabled      !== undefined && { isActive: data.enabled }),
      ...(data.isActive     !== undefined && { isActive: data.isActive }),
      ...(data.isVipOnly    !== undefined && { isVipOnly: data.isVipOnly }),
      ...(data.isLegendary  !== undefined && { isLegendary: data.isLegendary }),
      ...(data.comboCount   !== undefined && { comboCount: data.comboCount }),
      ...(data.minTier      !== undefined && { minTier: data.minTier }),
    }),

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
  get: async (): Promise<AppSettings> => {
    const raw = await api.get<unknown>("/api/admin/settings");
    // Backend returns { success: true, data: { key: "value", ... } }
    const envelope = raw as { success?: boolean; data?: Record<string, unknown> };
    return (envelope?.data ?? raw) as AppSettings;
  },

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

/**
 * Shape of the data object returned by GET /api/admin/stats/dashboard.
 *
 * The backend wraps every response in { success: true, data: { ... } }.
 * statsApi.dashboard() unwraps that envelope and returns this type directly.
 *
 * Verified against admin.core.routes.js GET /stats/dashboard:
 *   totalUsers, activeUsers, bannedUsers, totalRooms, activeRooms,
 *   activeAgencies, pendingAgencies, totalRevenue, openReports, recentPayments
 *
 * recentAgencies and recentUsers are NOT returned by the backend — they
 * default to [] so the dashboard renders gracefully without crashing.
 */
export type RecentPayment = {
  id:        string;
  type:      string;
  amountEGP: number;
  status:    string;
  createdAt: string;
  user: {
    id:          string;
    username:    string;
    displayName: string | null;
  };
};

export type DashboardStats = {
  totalUsers:       number;
  activeUsers:      number;
  bannedUsers:      number;
  totalRooms:       number;
  activeRooms:      number;
  activeAgencies:   number;
  pendingAgencies:  number;
  totalRevenue:     number;
  openReports:      number;
  recentPayments:   RecentPayment[];
  // Fields not yet returned by backend — default to [] in the normaliser
  recentAgencies:   AgencyRecord[];
  recentUsers:      UserRecord[];
  revenueByType:    Record<string, number>;
};

/** Envelope shape every Express route uses: { success: boolean; data: T } */
type ExpressEnvelope<T> = { success: boolean; data: T };

function normaliseDashboardStats(raw: unknown): DashboardStats {
  // raw is { success, data: { totalUsers, ... } }
  const envelope = raw as ExpressEnvelope<Partial<DashboardStats>>;
  const d = (envelope?.data ?? envelope) as Partial<DashboardStats> & {
    recentPayments?: Array<{
      id: string; type: string; amountEGP: number; status: string; createdAt: string;
      user?: { id?: string; username?: string; displayName?: string | null };
    }>;
  };

  // Normalise recentPayments — backend returns user without displayName
  const recentPayments: RecentPayment[] = Array.isArray(d.recentPayments)
    ? d.recentPayments.map(p => ({
        id:        String(p.id        ?? ""),
        type:      String(p.type      ?? ""),
        amountEGP: Number(p.amountEGP ?? 0),
        status:    String(p.status    ?? ""),
        createdAt: String(p.createdAt ?? ""),
        user: {
          id:          String(p.user?.id       ?? ""),
          username:    String(p.user?.username  ?? ""),
          displayName: p.user?.displayName ?? p.user?.username ?? null,
        },
      }))
    : [];

  return {
    totalUsers:      Number(d.totalUsers      ?? 0),
    activeUsers:     Number(d.activeUsers     ?? 0),
    bannedUsers:     Number(d.bannedUsers     ?? 0),
    totalRooms:      Number(d.totalRooms      ?? 0),
    activeRooms:     Number(d.activeRooms     ?? 0),
    activeAgencies:  Number(d.activeAgencies  ?? 0),
    pendingAgencies: Number(d.pendingAgencies ?? 0),
    totalRevenue:    Number(d.totalRevenue    ?? 0),
    openReports:     Number(d.openReports     ?? 0),
    recentPayments,
    recentAgencies:  Array.isArray(d.recentAgencies)  ? d.recentAgencies  : [],
    recentUsers:     Array.isArray(d.recentUsers)     ? d.recentUsers     : [],
    revenueByType:   (d.revenueByType && typeof d.revenueByType === "object")
                       ? d.revenueByType
                       : {},
  };
}

export const statsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    // fetchExpress returns the raw JSON body — we unwrap + normalise here
    const raw = await api.get<unknown>("/api/admin/stats/dashboard");
    return normaliseDashboardStats(raw);
  },

  revenue: (period: "day" | "week" | "month" | "year") =>
    api.get<{ labels: string[]; values: number[] }>("/api/admin/stats/revenue", { period }),
};
