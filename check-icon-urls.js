const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIconUrls() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 فحص URLs الأيقونات');
  console.log('═══════════════════════════════════════════════════════════\n');

  const navKeys = ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'];

  for (const key of navKeys) {
    const icon = await prisma.icon.findUnique({
      where: { key },
      select: { 
        key: true, 
        displayName: true, 
        svgUrl: true, 
        pngUrl: true,
        enabled: true,
        deletedAt: true
      }
    });

    if (!icon) {
      console.log(`❌ ${key}: غير موجودة`);
      continue;
    }

    console.log(`📌 ${key} (${icon.displayName})`);
    console.log(`   مفعّلة: ${icon.enabled ? 'نعم' : 'لا'}`);
    console.log(`   محذوفة: ${icon.deletedAt ? 'نعم' : 'لا'}`);
    console.log(`   SVG URL: ${icon.svgUrl || 'غير موجود'}`);
    console.log(`   PNG URL: ${icon.pngUrl || 'غير موجود'}`);
    console.log('');
  }

  await prisma.$disconnect();
}

checkIconUrls().catch(console.error);
