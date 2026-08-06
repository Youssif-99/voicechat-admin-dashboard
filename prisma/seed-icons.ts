/**
 * Seed script — creates all icon definitions in the database.
 * Idempotent: safe to run multiple times.
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { ICON_DEFINITIONS } from "../src/lib/icon-groups";

const prisma = new PrismaClient();

async function main() {
  // Upsert catalog version singleton
  const seedEtag = createHash("sha256").update("seed-v1").digest("hex").slice(0, 32);
  await prisma.iconCatalogVersion.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton", version: 1, etag: seedEtag },
  });

  let created = 0;
  let skipped = 0;

  for (const def of ICON_DEFINITIONS) {
    const result = await prisma.icon.upsert({
      where:  { key: def.key },
      update: {},
      create: {
        key:         def.key,
        displayName: def.displayName,
        category:    def.category,
        type:        "svg",
        enabled:     true,
        version:     1,
      },
    });
    // upsert returns the record; detect creation vs skip by checking createdAt ≈ now
    const ageMs = Date.now() - result.createdAt.getTime();
    if (ageMs < 5000) created++; else skipped++;
  }

  console.log(`✅ الأيقونات: ${created} جديد، ${skipped} موجود مسبقًا`);
  console.log(`📋 الكتالوج: ETag=${seedEtag.slice(0, 8)}…`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
