/**
 * IconRepository — adapts Admin Dashboard to work with actual app_icons schema.
 *
 * Backend uses app_icons table with:
 *   - url (single canonical URL)
 *   - storagePath (Cloudinary path)
 *   - version, etag
 *   - isActive, isPublished, isPending
 *   - defaultUrl (fallback)
 *
 * This repository provides CRUD operations via the backend /api/admin/icons API.
 */

import { api } from "@/lib/api-client";

// ── Types matching backend API ─────────────────────────────────────────────

export type AppIcon = {
  id: string;
  key: string;
  category: string;
  displayName: string;
  type?: "svg" | "png" | "both";
  url?: string;
  svgUrl?: string | null;
  pngUrl?: string | null;
  svgHash?: string | null;
  pngHash?: string | null;
  storagePath?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  version: number;
  isActive: boolean;
  isPublished?: boolean;
  isPending?: boolean;
  etag?: string | null;
  defaultUrl?: string;
  deletedAt?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IconWithVersions = AppIcon & { 
  versions?: Array<{
    id: string;
    version: number;
    url: string;
    createdAt: string;
  }>;
};

export type AuditContext = {
  adminId: string;
  adminName: string;
  adminEmail: string;
  ipAddress?: string;
  userAgent?: string;
};

export type IconListFilter = {
  category?: string;
  search?: string;
  pendingOnly?: boolean;
  enabled?: boolean;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
};

// ── Repository methods using backend API ──────────────────────────────────

export const IconRepository = {
  // ── READ ──────────────────────────────────────────────────────

  /** Admin list — fetches all icons from backend API */
  async listAdmin(filter: IconListFilter = {}): Promise<{ icons: AppIcon[]; total: number }> {
    const params: Record<string, string> = {};
    if (filter.category) params.category = filter.category;
    if (filter.search) params.search = filter.search;
    if (filter.pendingOnly) params.pendingOnly = "true";
    if (filter.enabled !== undefined) params.enabled = String(filter.enabled);
    if (filter.includeDeleted) params.includeDeleted = "true";
    params.page = String(filter.page ?? 1);
    params.limit = String(filter.pageSize ?? 100);

    const response = await api.get<{
      success: boolean;
      data: AppIcon[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>("/api/admin/icons", params);

    if (!response.success || !response.data) {
      return { icons: [], total: 0 };
    }

    return {
      icons: response.data,
      total: response.pagination?.total ?? response.data.length,
    };
  },

  async listPublic(): Promise<AppIcon[]> {
    const response = await api.get<{ success: boolean; data: AppIcon[] }>("/api/icons");
    return response.data || [];
  },

  async getCatalogVersion(): Promise<{ version: number; etag: string } | null> {
    const response = await api.get<{ success: boolean; data: { version: number; etag: string } }>("/api/icons/catalog-version").catch(() => null);
    return response?.data ?? null;
  },

  async getAuditLogs(iconId?: string, limit = 50): Promise<unknown[]> {
    const params: Record<string, string> = { limit: String(limit) };
    if (iconId) params.iconId = iconId;
    const response = await api.get<{ success: boolean; data: unknown[] }>("/api/admin/icons/audit", params).catch(() => null);
    return response?.data ?? [];
  },

  async findById(id: string): Promise<IconWithVersions | null> {
    const response = await api.get<{
      success: boolean;
      data: IconWithVersions;
    }>(`/api/admin/icons/${id}`).catch(() => null);

    if (!response || !response.success) return null;
    return response.data;
  },

  async findByKey(key: string): Promise<AppIcon | null> {
    const { icons } = await IconRepository.listAdmin({ search: key, pageSize: 1 });
    return icons.find((i) => i.key === key) ?? null;
  },

  // ── CREATE/UPLOAD ─────────────────────────────────────────────

  async create(data: Record<string, unknown>, audit?: AuditContext): Promise<AppIcon> {
    const response = await api.post<{ success: boolean; data: AppIcon }>("/api/admin/icons", { ...data, audit });
    return response.data;
  },

  async bulkCreate(inputs: unknown[], audit?: AuditContext): Promise<Record<string, unknown>> {
    const response = await api.post<{ success: boolean; data: Record<string, unknown> }>("/api/admin/icons/bulk", { inputs, audit });
    return response.data || {};
  },

  async uploadIcon(formData: FormData): Promise<AppIcon> {
    const response = await api.upload<{
      success: boolean;
      data: AppIcon;
      message?: string;
    }>("/api/admin/icons/upload", formData, "POST");

    if (!response.success || !response.data) {
      throw new Error(response.message ?? "Failed to upload icon");
    }

    return response.data;
  },

  // ── UPDATE ────────────────────────────────────────────────────

  async update(id: string, data: Record<string, unknown>, audit?: AuditContext): Promise<AppIcon> {
    const response = await api.put<{
      success: boolean;
      data: AppIcon;
    }>(`/api/admin/icons/${id}`, { ...data, audit });

    if (!response.success || !response.data) {
      throw new Error("Failed to update icon");
    }

    return response.data;
  },

  async updateMetadata(
    id: string,
    data: { displayName?: string; category?: string }
  ): Promise<AppIcon> {
    return IconRepository.update(id, data);
  },

  async setEnabled(id: string, enabled: boolean, audit?: AuditContext): Promise<AppIcon> {
    const response = await api.patch<{ success: boolean; data: AppIcon }>(
      `/api/admin/icons/${id}/${enabled ? "enable" : "disable"}`,
      { audit }
    );
    return response.data;
  },

  // ── DELETE / RESTORE ──────────────────────────────────────────

  async softDelete(id: string, audit?: AuditContext): Promise<AppIcon> {
    const response = await api.delete<{
      success: boolean;
      data?: AppIcon;
      message?: string;
    }>(`/api/admin/icons/${id}`, { audit });

    if (!response.success) {
      throw new Error(response.message ?? "Failed to delete icon");
    }
    return response.data as AppIcon;
  },

  async restore(id: string, audit?: AuditContext): Promise<AppIcon> {
    const response = await api.post<{
      success: boolean;
      data: AppIcon;
    }>(`/api/admin/icons/${id}/restore`, { audit });
    return response.data;
  },

  async restoreToDefault(id: string): Promise<AppIcon> {
    const response = await api.post<{
      success: boolean;
      data: AppIcon;
      message?: string;
    }>(`/api/admin/icons/restore/${id}`, {});

    if (!response.success || !response.data) {
      throw new Error(response.message ?? "Failed to restore icon");
    }

    return response.data;
  },

  // ── PUBLISH / CACHE / ROLLBACK ────────────────────────────────

  async publishPending(iconIds?: string[]): Promise<{ published: number }> {
    const response = await api.post<{
      success: boolean;
      data: { published: number };
      message?: string;
    }>("/api/admin/icons/publish", { iconIds });

    if (!response.success || !response.data) {
      throw new Error(response.message ?? "Failed to publish icons");
    }

    return response.data;
  },

  async invalidateCache(audit?: AuditContext): Promise<Record<string, unknown>> {
    const response = await api.post<{ success: boolean; data?: Record<string, unknown> }>("/api/admin/icons/cache-invalidate", { audit });
    return response.data || { success: response.success };
  },

  async rollback(iconId: string, versionIdOrTarget: string | number, audit?: AuditContext): Promise<AppIcon> {
    const response = await api.post<{
      success: boolean;
      data: AppIcon;
      message?: string;
    }>(`/api/admin/icons/revert/${iconId}`, { versionId: versionIdOrTarget, targetVersion: versionIdOrTarget, audit });

    if (!response.success || !response.data) {
      throw new Error(response.message ?? "Failed to rollback icon");
    }

    return response.data;
  },
};
