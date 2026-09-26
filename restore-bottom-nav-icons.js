const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restoreBottomNavIcons() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 استعادة أيقونات Bottom Navigation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const navKeys = ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'];

  for (const key of navKeys) {
    const icon = await prisma.icon.findUnique({
      where: { key },
      select: { id: true, key: true, displayName: true, deletedAt: true, svgUrl: true, pngUrl: true }
    });

    if (!icon) {
      console.log(`❌ ${key}: غير موجودة في قاعدة البيانات`);
      continue;
    }

    console.log(`قبل: deletedAt = ${icon.deletedAt}`);
    
    if (icon.deletedAt !== null) {
      const updated = await prisma.icon.update({
        where: { id: icon.id },
        data: {
          deletedAt: null,
          enabled: true,
          version: { increment: 1 },
          updatedBy: 'system-restore'
        }
      });
      console.log(`✅ ${key}: تم الاسترجاع`);
      console.log(`   بعد: deletedAt = ${updated.deletedAt}`);
      console.log(`   الاسم: ${icon.displayName}`);
      console.log(`   SVG: ${icon.svgUrl || 'غير موجود'}`);
      console.log(`   PNG: ${icon.pngUrl || 'غير موجود'}`);
    } else {
      console.log(`ℹ️  ${key}: غير محذوفة (لا تحتاج استرجاع)`);
    }
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

restoreBottomNavIcons().catch(console.error);
