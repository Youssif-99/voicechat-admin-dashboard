/**
 * IconRepository — single point of contact for all icon DB operations.
 * Follows the Repository Pattern: callers never write raw Prisma queries.
 *
 * All mutating methods automatically:
 *   1. Snapshot the previous state into IconVersion
 *   2. Write an IconAuditLog entry
 *   3. Bump the IconCatalogVersion ETag
 */

import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import type { Icon, IconVersion, IconAuditLog, Prisma } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────────

export type IconWithVersions = Icon & { versions: IconVersion[] };
export type AuditContext = {
  adminId: string;
  adminName: string;
  adminEmail: string;
  ipAddress?: string;
  userAgent?: string;
};
export type CreateIconInput = {
  key: string;
  displayName: string;
  category: string;
  type: "svg" | "png" | "both";
  svgUrl?: string;
  pngUrl?: string;
  svgHash?: string;
  pngHash?: string;
  changeNote?: string;
};
export type UpdateIconInput = Partial<Omit<CreateIconInput, "key">> & {
  enabled?: boolean;
};
export type IconListFilter = {
  category?: string;
  enabled?: boolean;
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
};

// ── Catalog ETag helper ────────────────────────────────────────────────────

async function bumpCatalogVersion(tx: Prisma.TransactionClient): Promise<void> {
  const etag = createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 32);

  await tx.iconCatalogVersion.upsert({
    where: { id: "singleton" },
    update: { version: { increment: 1 }, etag },
    create: { id: "singleton", version: 1, etag },
  });
}

// ── Snapshot helper ────────────────────────────────────────────────────────

async function snapshotVersion(
  tx: Prisma.TransactionClient,
  icon: Icon,
  audit: AuditContext,
  changeNote?: string
): Promise<void> {
  await tx.iconVersion.create({
    data: {
      iconId:       icon.id,
      version:      icon.version,
      svgUrl:       icon.svgUrl,
      pngUrl:       icon.pngUrl,
      svgHash:      icon.svgHash,
      pngHash:      icon.pngHash,
      type:         icon.type,
      updatedBy:    audit.adminId,
      updatedByName:audit.adminName,
      changeNote:   changeNote ?? null,
    },
  });
}

// ── Audit helper ───────────────────────────────────────────────────────────

async function writeAudit(
  tx: Prisma.TransactionClient,
  params: {
    iconId?: string;
    action: string;
    audit: AuditContext;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await tx.iconAuditLog.create({
    data: {
      iconId:     params.iconId ?? null,
      action:     params.action,
      adminId:    params.audit.adminId,
      adminName:  params.audit.adminName,
      adminEmail: params.audit.adminEmail,
      ipAddress:  params.audit.ipAddress ?? null,
      userAgent:  params.audit.userAgent ?? null,
      metadata:   params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}

// ── Repository ─────────────────────────────────────────────────────────────

export const IconRepository = {
  // ── READ ──────────────────────────────────────────────────────

  /** Public list — enabled, non-deleted icons only */
  async listPublic(): Promise<Icon[]> {
    return prisma.icon.findMany({
      where: { enabled: true, deletedAt: null },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
  },

  /** Admin list — supports filtering, pagination, soft-deleted, includes version history */
  async listAdmin(filter: IconListFilter = {}): Promise<{ icons: IconWithVersions[]; total: number }> {
    const {
      category,
      enabled,
      search,
      includeDeleted = false,
      page = 1,
      pageSize = 50,
    } = filter;

    const where: Prisma.IconWhereInput = {
      deletedAt: includeDeleted ? undefined : null,
      ...(category ? { category } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(search
        ? {
            OR: [
              { key:         { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
              { category:    { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [icons, total] = await Promise.all([
      prisma.icon.findMany({
        where,
        include: { versions: { orderBy: { version: "desc" }, take: 20 } },
        orderBy: [{ category: "asc" }, { key: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.icon.count({ where }),
    ]);

    return { icons, total };
  },

  async findById(id: string): Promise<IconWithVersions | null> {
    return prisma.icon.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" } } },
    });
  },

  async findByKey(key: string): Promise<Icon | null> {
    return prisma.icon.findUnique({ where: { key } });
  },

  async getVersions(iconId: string): Promise<IconVersion[]> {
    return prisma.iconVersion.findMany({
      where: { iconId },
      orderBy: { version: "desc" },
    });
  },

  async getAuditLogs(
    iconId?: string,
    limit = 100
  ): Promise<IconAuditLog[]> {
    return prisma.iconAuditLog.findMany({
      where: iconId ? { iconId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  /** Audit logs enriched with icon key + displayName for display in dashboard */
  async getAuditLogsEnriched(
    iconId?: string,
    limit = 100
  ): Promise<(IconAuditLog & { iconKey?: string; iconDisplayName?: string })[]> {
    const logs = await prisma.iconAuditLog.findMany({
      where: iconId ? { iconId } : undefined,
      include: { icon: { select: { key: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return logs.map((l) => ({
      ...l,
      iconKey:         (l as typeof l & { icon?: { key: string; displayName: string } | null }).icon?.key,
      iconDisplayName: (l as typeof l & { icon?: { key: string; displayName: string } | null }).icon?.displayName,
    }));
  },

  async getCatalogVersion(): Promise<{ version: number; etag: string } | null> {
    return prisma.iconCatalogVersion.findUnique({ where: { id: "singleton" } });
  },

  // ── CREATE ────────────────────────────────────────────────────

  async create(input: CreateIconInput, audit: AuditContext): Promise<Icon> {
    return prisma.$transaction(async (tx) => {
      const icon = await tx.icon.create({
        data: {
          key:         input.key,
          displayName: input.displayName,
          category:    input.category,
          type:        input.type,
          svgUrl:      input.svgUrl ?? null,
          pngUrl:      input.pngUrl ?? null,
          svgHash:     input.svgHash ?? null,
          pngHash:     input.pngHash ?? null,
          enabled:     true,
          version:     1,
          updatedBy:   audit.adminId,
        },
      });

      // Snapshot initial version
      await snapshotVersion(tx, icon, audit, input.changeNote ?? "إنشاء أولي");

      await writeAudit(tx, {
        iconId: icon.id,
        action: "CREATE",
        audit,
        metadata: { key: icon.key, category: icon.category },
      });

      await bumpCatalogVersion(tx);
      return icon;
    });
  },

  // ── UPDATE ────────────────────────────────────────────────────

  async update(
    id: string,
    input: UpdateIconInput,
    audit: AuditContext
  ): Promise<Icon> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.icon.findUniqueOrThrow({ where: { id } });

      // Snapshot current state before overwriting
      await snapshotVersion(tx, existing, audit, input.changeNote);

      const icon = await tx.icon.update({
        where: { id },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.category    !== undefined ? { category:    input.category    } : {}),
          ...(input.type        !== undefined ? { type:        input.type        } : {}),
          ...(input.svgUrl      !== undefined ? { svgUrl:      input.svgUrl      } : {}),
          ...(input.pngUrl      !== undefined ? { pngUrl:      input.pngUrl      } : {}),
          ...(input.svgHash     !== undefined ? { svgHash:     input.svgHash     } : {}),
          ...(input.pngHash     !== undefined ? { pngHash:     input.pngHash     } : {}),
          ...(input.enabled     !== undefined ? { enabled:     input.enabled     } : {}),
          version:   { increment: 1 },
          updatedBy: audit.adminId,
        },
      });

      await writeAudit(tx, {
        iconId: icon.id,
        action: "UPDATE",
        audit,
        metadata: { fields: Object.keys(input) },
      });

      await bumpCatalogVersion(tx);
      return icon;
    });
  },

  // ── ENABLE / DISABLE ──────────────────────────────────────────

  async setEnabled(id: string, enabled: boolean, audit: AuditContext): Promise<Icon> {
    return prisma.$transaction(async (tx) => {
      const icon = await tx.icon.update({
        where: { id },
        data: { enabled, updatedBy: audit.adminId, version: { increment: 1 } },
      });

      await writeAudit(tx, {
        iconId: icon.id,
        action: enabled ? "ENABLE" : "DISABLE",
        audit,
        metadata: { key: icon.key },
      });

      await bumpCatalogVersion(tx);
      return icon;
    });
  },

  // ── SOFT DELETE ───────────────────────────────────────────────

  async softDelete(id: string, audit: AuditContext): Promise<Icon> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.icon.findUniqueOrThrow({ where: { id } });

      // Snapshot before deletion
      await snapshotVersion(tx, existing, audit, "حذف الأيقونة");

      const icon = await tx.icon.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          enabled:   false,
          updatedBy: audit.adminId,
          version:   { increment: 1 },
        },
      });

      await writeAudit(tx, {
        iconId: icon.id,
        action: "DELETE",
        audit,
        metadata: { key: icon.key },
      });

      await bumpCatalogVersion(tx);
      return icon;
    });
  },

  // ── RESTORE (un-delete) ───────────────────────────────────────

  async restore(id: string, audit: AuditContext): Promise<Icon> {
    return prisma.$transaction(async (tx) => {
      const icon = await tx.icon.update({
        where: { id },
        data: {
          deletedAt: null,
          enabled:   true,
          updatedBy: audit.adminId,
          version:   { increment: 1 },
        },
      });

      await writeAudit(tx, {
        iconId: icon.id,
        action: "RESTORE",
        audit,
        metadata: { key: icon.key },
      });

      await bumpCatalogVersion(tx);
      return icon;
    });
  },

  // ── ROLLBACK ──────────────────────────────────────────────────

  /**
   * Revert an icon to a previous version snapshot.
   * Current state is snapshotted first so the rollback itself is reversible.
   */
  async rollback(
    iconId: string,
    targetVersion: number,
    audit: AuditContext
  ): Promise<Icon> {
    return prisma.$transaction(async (tx) => {
      const [existing, snapshot] = await Promise.all([
        tx.icon.findUniqueOrThrow({ where: { id: iconId } }),
        tx.iconVersion.findFirst({
          where: { iconId, version: targetVersion },
        }),
      ]);

      if (!snapshot) {
        throw new Error(`الإصدار ${targetVersion} غير موجود لهذه الأيقونة`);
      }

      // Snapshot current state before rollback
      await snapshotVersion(tx, existing, audit, `rollback إلى v${targetVersion}`);

      const icon = await tx.icon.update({
        where: { id: iconId },
        data: {
          svgUrl:    snapshot.svgUrl,
          pngUrl:    snapshot.pngUrl,
          svgHash:   snapshot.svgHash,
          pngHash:   snapshot.pngHash,
          type:      snapshot.type,
          version:   { increment: 1 },
          updatedBy: audit.adminId,
        },
      });

      await writeAudit(tx, {
        iconId: icon.id,
        action: "ROLLBACK",
        audit,
        metadata: {
          key:           icon.key,
          fromVersion:   existing.version,
          toVersion:     targetVersion,
        },
      });

      await bumpCatalogVersion(tx);
      return icon;
    });
  },

  // ── BULK CREATE ───────────────────────────────────────────────

  async bulkCreate(
    icons: CreateIconInput[],
    audit: AuditContext
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const input of icons) {
      try {
        const existing = await prisma.icon.findUnique({ where: { key: input.key } });
        if (existing) {
          skipped++;
          continue;
        }
        await IconRepository.create(input, audit);
        created++;
      } catch (e) {
        errors.push(`${input.key}: ${(e as Error).message}`);
      }
    }

    // One audit entry for the whole bulk operation (runs outside individual icon transactions — intentional,
    // since each icon create already bumped the catalog version inside its own transaction)
    await prisma.iconAuditLog.create({
      data: {
        iconId:     null,
        action:     "BULK_UPLOAD",
        adminId:    audit.adminId,
        adminName:  audit.adminName,
        adminEmail: audit.adminEmail,
        ipAddress:  audit.ipAddress ?? null,
        userAgent:  audit.userAgent ?? null,
        metadata:   JSON.stringify({ total: icons.length, created, skipped, errors }),
      },
    });

    return { created, skipped, errors };
  },

  // ── CACHE INVALIDATION ────────────────────────────────────────

  async invalidateCache(audit: AuditContext): Promise<{ etag: string; version: number }> {
    return prisma.$transaction(async (tx) => {
      await bumpCatalogVersion(tx);

      await writeAudit(tx, {
        action: "CACHE_CLEAR",
        audit,
        metadata: { triggeredAt: new Date().toISOString() },
      });

      const catalog = await tx.iconCatalogVersion.findUniqueOrThrow({
        where: { id: "singleton" },
      });

      return { etag: catalog.etag, version: catalog.version };
    });
  },

  // ── STATS ─────────────────────────────────────────────────────

  /** Returns counts grouped by category for the dashboard summary panel */
  async getCategoryStats(): Promise<{ category: string; total: number; enabled: number; withFile: number }[]> {
    const icons = await prisma.icon.findMany({
      where:  { deletedAt: null },
      select: { category: true, enabled: true, svgUrl: true, pngUrl: true },
    });

    const map = new Map<string, { total: number; enabled: number; withFile: number }>();
    for (const icon of icons) {
      const cur = map.get(icon.category) ?? { total: 0, enabled: 0, withFile: 0 };
      cur.total++;
      if (icon.enabled) cur.enabled++;
      if (icon.svgUrl || icon.pngUrl) cur.withFile++;
      map.set(icon.category, cur);
    }
    return Array.from(map.entries()).map(([category, stats]) => ({ category, ...stats }));
  },
};
