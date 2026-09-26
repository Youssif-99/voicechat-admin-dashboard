const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Final fix: Update all URLs from port 3000 to port 3001
 * (Dashboard actually runs on 3001, not 3000)
 */

async function fixIconUrls() {
  console.log('============================================');
  console.log('FINAL FIX: Updating URLs to port 3001');
  console.log('============================================\n');

  // Find all icons with localhost:3000 URLs
  const icons = await prisma.icon.findMany({
    where: {
      OR: [
        { pngUrl: { contains: 'localhost:3000' } },
        { svgUrl: { contains: 'localhost:3000' } },
      ]
    },
    select: {
      id: true,
      key: true,
      svgUrl: true,
      pngUrl: true,
    }
  });

  console.log(`Found ${icons.length} icons to fix\n`);

  if (icons.length === 0) {
    console.log('No icons need fixing');
    await prisma.$disconnect();
    return;
  }

  let fixed = 0;

  for (const icon of icons) {
    const updates = {};
    
    if (icon.svgUrl && icon.svgUrl.includes('localhost:3000')) {
      updates.svgUrl = icon.svgUrl.replace('localhost:3000', 'localhost:3001');
    }
    
    if (icon.pngUrl && icon.pngUrl.includes('localhost:3000')) {
      updates.pngUrl = icon.pngUrl.replace('localhost:3000', 'localhost:3001');
    }

    if (Object.keys(updates).length > 0) {
      await prisma.icon.update({
        where: { id: icon.id },
        data: {
          ...updates,
          version: { increment: 1 }
        }
      });

      console.log(`OK: ${icon.key}`);
      if (updates.svgUrl) console.log(`    SVG: ${updates.svgUrl}`);
      if (updates.pngUrl) console.log(`    PNG: ${updates.pngUrl}`);
      console.log();
      
      fixed++;
    }
  }

  // Bump catalog version
  await prisma.iconCatalogVersion.update({
    where: { id: 'singleton' },
    data: {
      version: { increment: 1 },
      etag: require('crypto').randomBytes(16).toString('hex'),
    }
  });

  console.log('============================================');
  console.log(`SUCCESS: Fixed ${fixed} icons`);
  console.log('Catalog version updated');
  console.log('============================================');

  await prisma.$disconnect();
}

fixIconUrls().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
