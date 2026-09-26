const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnabledStatus() {
  const icons = await prisma.icon.findMany({
    where: {
      key: { in: ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'] }
    },
    select: { key: true, enabled: true, deletedAt: true }
  });

  console.log('حالة الأيقونات في قاعدة البيانات:\n');
  icons.forEach(i => {
    console.log(`${i.key}:`);
    console.log(`  enabled: ${i.enabled ? 'نعم ✓' : 'لا ✗'}`);
    console.log(`  deleted: ${i.deletedAt ? 'نعم ✗' : 'لا ✓'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkEnabledStatus().catch(console.error);
