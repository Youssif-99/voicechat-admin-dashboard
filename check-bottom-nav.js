const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBottomNav() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 فحص أيقونات Bottom Navigation في قاعدة البيانات');
  console.log('═══════════════════════════════════════════════════════════\n');

  const icons = await prisma.icon.findMany({
    where: { category: 'bottom_nav' },
    select: {
      key: true,
      displayName: true,
      enabled: true,
      svgUrl: true,
      pngUrl: true,
      deletedAt: true
    },
    orderBy: { key: 'asc' }
  });

  console.log(`عدد الأيقونات: ${icons.length}\n`);

  if (icons.length === 0) {
    console.log('❌ لا توجد أيقونات bottom_nav في قاعدة البيانات!\n');
    console.log('💡 لإضافة الأيقونات، استخدم صفحة /icons في Admin Dashboard.\n');
  } else {
    icons.forEach((icon, i) => {
      console.log(`${i + 1}. ${icon.key}`);
      console.log(`   الاسم: ${icon.displayName}`);
      console.log(`   مفعّلة: ${icon.enabled ? '✓' : '✗'}`);
      console.log(`   محذوفة: ${icon.deletedAt ? 'نعم ✗' : 'لا ✓'}`);
      console.log(`   SVG URL: ${icon.svgUrl ? '✓ موجود' : '✗ غير موجود'}`);
      console.log(`   PNG URL: ${icon.pngUrl ? '✓ موجود' : '✗ غير موجود'}`);
      console.log('');
    });
  }

  await prisma.$disconnect();
}

checkBottomNav().catch(console.error);
