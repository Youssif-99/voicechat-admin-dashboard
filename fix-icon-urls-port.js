const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixIconUrlsPort() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 إصلاح URLs الأيقونات - تغيير Port من 3000 إلى 3001');
  console.log('═══════════════════════════════════════════════════════════\n');

  const icons = await prisma.icon.findMany({
    where: {
      OR: [
        { svgUrl: { contains: 'localhost:3000' } },
        { pngUrl: { contains: 'localhost:3000' } }
      ]
    }
  });

  console.log(`وجدت ${icons.length} أيقونات تحتاج إصلاح\n`);

  for (const icon of icons) {
    const newSvgUrl = icon.svgUrl?.replace('localhost:3000', 'localhost:3001');
    const newPngUrl = icon.pngUrl?.replace('localhost:3000', 'localhost:3001');

    await prisma.icon.update({
      where: { id: icon.id },
      data: {
        svgUrl: newSvgUrl || icon.svgUrl,
        pngUrl: newPngUrl || icon.pngUrl,
        version: { increment: 1 }
      }
    });

    console.log(`✅ ${icon.key}`);
    if (icon.svgUrl) console.log(`   SVG: ${icon.svgUrl} → ${newSvgUrl}`);
    if (icon.pngUrl) console.log(`   PNG: ${icon.pngUrl} → ${newPngUrl}`);
    console.log('');
  }

  // Bump catalog version
  await prisma.iconCatalogVersion.upsert({
    where: { id: 'singleton' },
    update: {
      version: { increment: 1 },
      etag: Date.now().toString()
    },
    create: {
      id: 'singleton',
      version: 1,
      etag: Date.now().toString()
    }
  });

  console.log('✅ تم تحديث catalog version');

  await prisma.$disconnect();
}

fixIconUrlsPort().catch(console.error);
