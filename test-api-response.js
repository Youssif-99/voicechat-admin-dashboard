const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testApiResponse() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 محاكاة استجابة API');
  console.log('═══════════════════════════════════════════════════════════\n');

  // This is what IconRepository.listPublic() does
  const icons = await prisma.icon.findMany({
    where: { enabled: true, deletedAt: null },
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });

  console.log(`✅ عدد الأيقونات من listPublic(): ${icons.length}\n`);

  const bottomNavIcons = icons.filter(i => i.category === 'bottom_nav');
  console.log(`📊 Bottom Nav Icons: ${bottomNavIcons.length}\n`);

  if (bottomNavIcons.length === 0) {
    console.log('❌ لا توجد أيقونات bottom_nav مفعّلة وغير محذوفة!');
    console.log('');
    console.log('🔍 دعنا نفحص السبب:');
    
    // Check all bottom_nav icons regardless of enabled/deleted status
    const allBottomNav = await prisma.icon.findMany({
      where: { category: 'bottom_nav' },
      select: {
        key: true,
        enabled: true,
        deletedAt: true,
      }
    });
    
    console.log(`\nجميع أيقونات bottom_nav (${allBottomNav.length}):`);
    allBottomNav.forEach(icon => {
      console.log(`  ${icon.key}: enabled=${icon.enabled}, deleted=${icon.deletedAt ? 'YES' : 'NO'}`);
    });
  } else {
    console.log('Bottom Nav Icons في API Response:');
    bottomNavIcons.forEach(icon => {
      console.log(`\n  ${icon.key}:`);
      console.log(`    displayName: ${icon.displayName}`);
      console.log(`    type: ${icon.type}`);
      console.log(`    svgUrl: ${icon.svgUrl || 'null'}`);
      console.log(`    pngUrl: ${icon.pngUrl || 'null'}`);
      console.log(`    version: v${icon.version}`);
    });
  }

  await prisma.$disconnect();
}

testApiResponse().catch(err => {
  console.error('❌ خطأ:', err.message);
  console.error(err);
  process.exit(1);
});
