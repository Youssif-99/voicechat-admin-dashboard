const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 Checking Admin Dashboard Icons Database...\n');

    const icons = await prisma.icon.findMany({
      where: {
        key: { startsWith: 'nav' },
        enabled: true,
      },
      select: {
        key: true,
        displayName: true,
        svgUrl: true,
        pngUrl: true,
        version: true,
        enabled: true,
      },
      orderBy: { key: 'asc' },
    });

    console.log(`✅ Found ${icons.length} navigation icons in Admin Dashboard DB:\n`);
    
    icons.forEach((icon) => {
      console.log(`📌 ${icon.key}`);
      console.log(`   Display: ${icon.displayName}`);
      console.log(`   SVG URL: ${icon.svgUrl || 'N/A'}`);
      console.log(`   PNG URL: ${icon.pngUrl || 'N/A'}`);
      console.log(`   Version: ${icon.version}`);
      console.log('');
    });

    // Check required keys
    const required = ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'];
    console.log('🔎 Checking required navigation keys:');
    required.forEach((key) => {
      const icon = icons.find((i) => i.key === key);
      if (icon) {
        console.log(`  ✅ ${key} → ${icon.svgUrl || icon.pngUrl || 'NO URL'}`);
      } else {
        console.log(`  ❌ ${key} → MISSING`);
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
