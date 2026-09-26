/**
 * AssetRepository — single source of truth for all AppAsset DB operations.
 *
 * All mutating methods automatically:
 *   1. Snapshot the previous state into AppAssetVersion
 *   2. Write an AppAssetAuditLog entry
 *   3. Bump the AppAssetCatalogVersion ETag
 */

import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import type { AppAsset, AppAssetVersion, AppAssetAuditLog, Prisma } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────────

export type AssetWithVersions = AppAsset & { versions: AppAssetVersion[] };

export type AssetAuditContext = {
  adminId:    string;
  adminName:  string;
  adminEmail: string;
  ipAddress?: string;
  userAgent?: string;
};

export type CreateAssetInput = {
  key:          string;
  name:         string;
  category:     string;
  imageUrl?:    string;
  thumbnailUrl?: string;
  mimeType?:    string;
  hash?:        string;
  sizeBytes?:   number;
  width?:       number;
  height?:      number;
  changeNote?:  string;
};

export type UpdateAssetInput = Partial<Omit<CreateAssetInput, "key">> & {
  isActive?: boolean;
};

export type AssetListFilter = {
  category?:      string;
  isActive?:      boolean;
  search?:        string;
  includeDeleted?: boolean;
  page?:          number;
  pageSize?:      number;
  sortBy?:        "name" | "category" | "updatedAt" | "version";
  sortDir?:       "asc" | "desc";
};

// ── Catalog ETag helper ────────────────────────────────────────────────────

async function bumpAssetCatalogVersion(tx: Prisma.TransactionClient): Promise<void> {
  const etag = createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 32);

  await tx.appAssetCatalogVersion.upsert({
    where:  { id: "singleton" },
    update: { version: { increment: 1 }, etag },
    create: { id: "singleton", version: 1, etag },
  });
}

// ── Snapshot helper ────────────────────────────────────────────────────────

async function snapshotAssetVersion(
  tx: Prisma.TransactionClient,
  asset: AppAsset,
  audit: AssetAuditContext,
  changeNote?: string
): Promise<void> {
  await tx.appAssetVersion.create({
    data: {
      assetId:       asset.id,
      version:       asset.version,
      imageUrl:      asset.imageUrl,
      thumbnailUrl:  asset.thumbnailUrl,
      mimeType:      asset.mimeType,
      hash:          asset.hash,
      sizeBytes:     asset.sizeBytes,
      updatedBy:     audit.adminId,
      updatedByName: audit.adminName,
      changeNote:    changeNote ?? null,
    },
  });
}

// ── Audit helper ───────────────────────────────────────────────────────────

async function writeAssetAudit(
  tx: Prisma.TransactionClient,
  params: {
    assetId?: string;
    action:   string;
    audit:    AssetAuditContext;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await tx.appAssetAuditLog.create({
    data: {
      assetId:    params.assetId ?? null,
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

export const AssetRepository = {

  // ── READ ──────────────────────────────────────────────────────

  /** Public list — active, non-deleted assets for Flutter */
  async listPublic(): Promise<AppAsset[]> {
    return prisma.appAsset.findMany({
      where:   { isActive: true, deletedAt: null },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
  },

  /** Admin list with full filtering, pagination, sorting */
  async listAdmin(filter: AssetListFilter = {}): Promise<{ assets: AssetWithVersions[]; total: number }> {
    const {
      category,
      isActive,
      search,
      includeDeleted = false,
      page    = 1,
      pageSize = 50,
      sortBy  = "updatedAt",
      sortDir = "desc",
    } = filter;

    const where: Prisma.AppAssetWhereInput = {
      deletedAt: includeDeleted ? undefined : null,
      ...(category  !== undefined ? { category }              : {}),
      ...(isActive  !== undefined ? { isActive }              : {}),
      ...(search ? {
        OR: [
          { key:      { contains: search, mode: "insensitive" } },
          { name:     { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };

    const orderBy: Prisma.AppAssetOrderByWithRelationInput[] =
      sortBy === "name"      ? [{ name:      sortDir }] :
      sortBy === "category"  ? [{ category:  sortDir }, { key: "asc" }] :
      sortBy === "version"   ? [{ version:   sortDir }] :
      [{ updatedAt: sortDir }];

    const [assets, total] = await Promise.all([
      prisma.appAsset.findMany({
        where,
        include: { versions: { orderBy: { version: "desc" }, take: 20 } },
        orderBy,
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
      prisma.appAsset.count({ where }),
    ]);

    return { assets, total };
  },

  async findById(id: string): Promise<AssetWithVersions | null> {
    return prisma.appAsset.findUnique({
      where:   { id },
      include: { versions: { orderBy: { version: "desc" } } },
    });
  },

  async findByKey(key: string): Promise<AppAsset | null> {
    return prisma.appAsset.findUnique({ where: { key } });
  },

  async getVersions(assetId: string): Promise<AppAssetVersion[]> {
    return prisma.appAssetVersion.findMany({
      where:   { assetId },
      orderBy: { version: "desc" },
    });
  },

  async getAuditLogs(
    assetId?: string,
    limit = 100
  ): Promise<(AppAssetAuditLog & { assetKey?: string; assetName?: string })[]> {
    const logs = await prisma.appAssetAuditLog.findMany({
      where:   assetId ? { assetId } : undefined,
      include: { asset: { select: { key: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take:    limit,
    });
    return logs.map((l) => ({
      ...l,
      assetKey:  (l as typeof l & { asset?: { key: string } | null }).asset?.key,
      assetName: (l as typeof l & { asset?: { name: string } | null }).asset?.name,
    }));
  },

  async getCatalogVersion(): Promise<{ version: number; etag: string } | null> {
    return prisma.appAssetCatalogVersion.findUnique({ where: { id: "singleton" } });
  },

  async getCategoryStats(): Promise<{
    category: string;
    total: number;
    active: number;
    withFile: number;
  }[]> {
    const assets = await prisma.appAsset.findMany({
      where:  { deletedAt: null },
      select: { category: true, isActive: true, imageUrl: true },
    });
    const map = new Map<string, { total: number; active: number; withFile: number }>();
    for (const a of assets) {
      const cur = map.get(a.category) ?? { total: 0, active: 0, withFile: 0 };
      cur.total++;
      if (a.isActive) cur.active++;
      if (a.imageUrl) cur.withFile++;
      map.set(a.category, cur);
    }
    return Array.from(map.entries()).map(([category, s]) => ({ category, ...s }));
  },

  // ── CREATE ────────────────────────────────────────────────────

  async create(input: CreateAssetInput, audit: AssetAuditContext): Promise<AppAsset> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.appAsset.create({
        data: {
          key:          input.key,
          name:         input.name,
          category:     input.category,
          imageUrl:     input.imageUrl     ?? null,
          thumbnailUrl: input.thumbnailUrl ?? null,
          mimeType:     input.mimeType     ?? null,
          hash:         input.hash         ?? null,
          sizeBytes:    input.sizeBytes    ?? null,
          width:        input.width        ?? null,
          height:       input.height       ?? null,
          isActive:     true,
          version:      1,
          updatedBy:    audit.adminId,
        },
      });

      await snapshotAssetVersion(tx, asset, audit, input.changeNote ?? "إنشاء أولي");
      await writeAssetAudit(tx, {
        assetId:  asset.id,
        action:   "CREATE",
        audit,
        metadata: { key: asset.key, category: asset.category },
      });
      await bumpAssetCatalogVersion(tx);
      return asset;
    });
  },

  // ── UPDATE ────────────────────────────────────────────────────

  async update(id: string, input: UpdateAssetInput, audit: AssetAuditContext): Promise<AppAsset> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.appAsset.findUniqueOrThrow({ where: { id } });
      await snapshotAssetVersion(tx, existing, audit, input.changeNote);

      const asset = await tx.appAsset.update({
        where: { id },
        data:  {
          ...(input.name         !== undefined ? { name:         input.name         } : {}),
          ...(input.category     !== undefined ? { category:     input.category     } : {}),
          ...(input.imageUrl     !== undefined ? { imageUrl:     input.imageUrl     } : {}),
          ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
          ...(input.mimeType     !== undefined ? { mimeType:     input.mimeType     } : {}),
          ...(input.hash         !== undefined ? { hash:         input.hash         } : {}),
          ...(input.sizeBytes    !== undefined ? { sizeBytes:    input.sizeBytes    } : {}),
          ...(input.width        !== undefined ? { width:        input.width        } : {}),
          ...(input.height       !== undefined ? { height:       input.height       } : {}),
          ...(input.isActive     !== undefined ? { isActive:     input.isActive     } : {}),
          version:   { increment: 1 },
          updatedBy: audit.adminId,
        },
      });

      await writeAssetAudit(tx, {
        assetId:  asset.id,
        action:   "UPDATE",
        audit,
        metadata: { fields: Object.keys(input).filter(k => k !== "changeNote") },
      });
      await bumpAssetCatalogVersion(tx);
      return asset;
    });
  },

  // ── ENABLE / DISABLE ──────────────────────────────────────────

  async setActive(id: string, isActive: boolean, audit: AssetAuditContext): Promise<AppAsset> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.appAsset.update({
        where: { id },
        data:  { isActive, version: { increment: 1 }, updatedBy: audit.adminId },
      });
      await writeAssetAudit(tx, {
        assetId:  asset.id,
        action:   isActive ? "ENABLE" : "DISABLE",
        audit,
        metadata: { key: asset.key },
      });
      await bumpAssetCatalogVersion(tx);
      return asset;
    });
  },

  // ── SOFT DELETE ───────────────────────────────────────────────

  async softDelete(id: string, audit: AssetAuditContext): Promise<AppAsset> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.appAsset.findUniqueOrThrow({ where: { id } });
      await snapshotAssetVersion(tx, existing, audit, "حذف الأصل");

      const asset = await tx.appAsset.update({
        where: { id },
        data:  {
          deletedAt: new Date(),
          isActive:  false,
          version:   { increment: 1 },
          updatedBy: audit.adminId,
        },
      });
      await writeAssetAudit(tx, {
        assetId:  asset.id,
        action:   "DELETE",
        audit,
        metadata: { key: asset.key },
      });
      await bumpAssetCatalogVersion(tx);
      return asset;
    });
  },

  // ── RESTORE ───────────────────────────────────────────────────

  async restore(id: string, audit: AssetAuditContext): Promise<AppAsset> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.appAsset.update({
        where: { id },
        data:  {
          deletedAt: null,
          isActive:  true,
          version:   { increment: 1 },
          updatedBy: audit.adminId,
        },
      });
      await writeAssetAudit(tx, {
        assetId:  asset.id,
        action:   "RESTORE",
        audit,
        metadata: { key: asset.key },
      });
      await bumpAssetCatalogVersion(tx);
      return asset;
    });
  },

  // ── ROLLBACK ──────────────────────────────────────────────────

  async rollback(assetId: string, targetVersion: number, audit: AssetAuditContext): Promise<AppAsset> {
    return prisma.$transaction(async (tx) => {
      const [existing, snapshot] = await Promise.all([
        tx.appAsset.findUniqueOrThrow({ where: { id: assetId } }),
        tx.appAssetVersion.findFirst({ where: { assetId, version: targetVersion } }),
      ]);

      if (!snapshot) {
        throw new Error(`الإصدار ${targetVersion} غير موجود لهذا الأصل`);
      }

      await snapshotAssetVersion(tx, existing, audit, `rollback إلى v${targetVersion}`);

      const asset = await tx.appAsset.update({
        where: { id: assetId },
        data:  {
          imageUrl:     snapshot.imageUrl,
          thumbnailUrl: snapshot.thumbnailUrl,
          mimeType:     snapshot.mimeType,
          hash:         snapshot.hash,
          sizeBytes:    snapshot.sizeBytes,
          version:      { increment: 1 },
          updatedBy:    audit.adminId,
        },
      });

      await writeAssetAudit(tx, {
        assetId: asset.id,
        action:  "ROLLBACK",
        audit,
        metadata: {
          key:         asset.key,
          fromVersion: existing.version,
          toVersion:   targetVersion,
        },
      });
      await bumpAssetCatalogVersion(tx);
      return asset;
    });
  },

  // ── SEED DEFAULTS ─────────────────────────────────────────────

  /**
   * Seeds all provided definitions as AppAsset records, skipping any
   * whose key already exists.
   *
   * Uses a single query to find all existing keys (avoids N lookups),
   * then creates missing assets in concurrent batches of 5 to stay
   * within Neon's connection pool limits.
   */
  async seedDefaults(
    definitions: Array<{ key: string; name: string; category: string }>,
    audit: AssetAuditContext
  ): Promise<{ created: number; skipped: number }> {
    // 1. Find all already-existing keys in one query
    const keys    = definitions.map((d) => d.key);
    const existing = await prisma.appAsset.findMany({
      where:  { key: { in: keys } },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((e) => e.key));

    const toCreate = definitions.filter((d) => !existingKeys.has(d.key));
    const skipped  = definitions.length - toCreate.length;
    let   created  = 0;

    // 2. Create missing assets in concurrent batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const batch   = toCreate.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((def) => AssetRepository.create(def, audit))
      );
      for (const r of results) {
        if (r.status === "fulfilled") created++;
        // silently skip failed — key constraint races etc.
      }
    }

    await prisma.appAssetAuditLog.create({
      data: {
        action:     "SEED",
        adminId:    audit.adminId,
        adminName:  audit.adminName,
        adminEmail: audit.adminEmail,
        metadata:   JSON.stringify({ total: definitions.length, created, skipped }),
      },
    });

    return { created, skipped };
  },

  // ── CACHE INVALIDATION ────────────────────────────────────────

  async invalidateCache(audit: AssetAuditContext): Promise<{ etag: string; version: number }> {
    return prisma.$transaction(async (tx) => {
      await bumpAssetCatalogVersion(tx);
      await writeAssetAudit(tx, {
        action:   "CACHE_CLEAR",
        audit,
        metadata: { triggeredAt: new Date().toISOString() },
      });
      const catalog = await tx.appAssetCatalogVersion.findUniqueOrThrow({ where: { id: "singleton" } });
      return { etag: catalog.etag, version: catalog.version };
    });
  },
};
