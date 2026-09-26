const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * إصلاح URLs الأيقونات من port 3001 إلى port 3000
 */

async function fixIconUrls() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 إصلاح URLs الأيقونات');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Find all icons with localhost:3001 URLs
  const icons = await prisma.icon.findMany({
    where: {
      OR: [
        { pngUrl: { contains: 'localhost:3001' } },
        { svgUrl: { contains: 'localhost:3001' } },
      ]
    },
    select: {
      id: true,
      key: true,
      svgUrl: true,
      pngUrl: true,
    }
  });

  console.log(`📊 وجدت ${icons.length} أيقونة تحتاج إصلاح\n`);

  if (icons.length === 0) {
    console.log('✅ لا توجد أيقونات تحتاج إصلاح');
    await prisma.$disconnect();
    return;
  }

  let fixed = 0;

  for (const icon of icons) {
    const updates = {};
    
    if (icon.svgUrl && icon.svgUrl.includes('localhost:3001')) {
      updates.svgUrl = icon.svgUrl.replace('localhost:3001', 'localhost:3000');
    }
    
    if (icon.pngUrl && icon.pngUrl.includes('localhost:3001')) {
      updates.pngUrl = icon.pngUrl.replace('localhost:3001', 'localhost:3000');
    }

    if (Object.keys(updates).length > 0) {
      await prisma.icon.update({
        where: { id: icon.id },
        data: {
          ...updates,
          version: { increment: 1 }
        }
      });

      console.log(`✅ ${icon.key}`);
      if (updates.svgUrl) console.log(`   SVG: ${updates.svgUrl}`);
      if (updates.pngUrl) console.log(`   PNG: ${updates.pngUrl}`);
      console.log();
      
      fixed++;
    }
  }

  // Bump catalog version to invalidate Flutter cache
  await prisma.iconCatalogVersion.update({
    where: { id: 'singleton' },
    data: {
      version: { increment: 1 },
      etag: require('crypto').randomBytes(16).toString('hex'),
    }
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ تم إصلاح ${fixed} أيقونة`);
  console.log('✅ تم تحديث catalog version (Flutter سيتم تحديثها تلقائياً)');
  console.log('═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

fixIconUrls().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
