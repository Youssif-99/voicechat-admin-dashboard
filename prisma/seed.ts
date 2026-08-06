/**
 * Dashboard Prisma Seed — Icon System ONLY
 *
 * The old seed that created Admin / Agency / User / Room / Payment records
 * has been removed. Those models are owned exclusively by the Express backend.
 *
 * This seed only initialises the Icon catalog so Flutter can fetch icons
 * from day one via GET /api/icons.
 *
 * Run: npm run db:seed-icons
 * (The old `db:seed` script has been removed from package.json)
 */

import { PrismaClient } from "@prisma/client";
import { createHash }   from "crypto";
import { ICON_DEFINITIONS } from "../src/lib/icon-groups";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding icon catalog...");

  // Upsert the catalog version singleton
  const seedEtag = createHash("sha256")
    .update(`seed-v2-${Date.now()}`)
    .digest("hex")
    .slice(0, 32);

  await prisma.iconCatalogVersion.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton", version: 1, etag: seedEtag },
  });

  let created = 0;
  let skipped = 0;

  for (const def of ICON_DEFINITIONS) {
    const existing = await prisma.icon.findUnique({ where: { key: def.key } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.icon.create({
      data: {
        key:         def.key,
        displayName: def.displayName,
        category:    def.category,
        type:        "svg",
        enabled:     true,
        version:     1,
        // svgUrl / pngUrl intentionally null —
        // Flutter falls back to bundled assets until admin uploads real files.
      },
    });
    created++;
  }

  console.log(`✅  Icon catalog: ${created} created, ${skipped} already existed`);
  console.log(`📋  Catalog ETag: ${seedEtag.slice(0, 8)}…`);
  console.log("");
  console.log("ℹ️   To seed admin users / agencies / rooms, run the Express backend seed:");
  console.log("     cd <express-backend> && npm run db:seed");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
