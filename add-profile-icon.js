const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addProfileIcon() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('➕ إضافة أيقونة nav.profile');
  console.log('═══════════════════════════════════════════════════════════\n');

  // استخدام ملف موجود - navsettngs.png
  const pngUrl = 'http://localhost:3000/icons/navsettngs.png';

  const icon = await prisma.icon.findUnique({
    where: { key: 'nav.profile' }
  });

  if (!icon) {
    console.log('❌ nav.profile غير موجودة في قاعدة البيانات');
    await prisma.$disconnect();
    return;
  }

  await prisma.icon.update({
    where: { id: icon.id },
    data: {
      pngUrl: pngUrl,
      pngHash: 'temp-hash-' + Date.now(), // يمكن حساب الـ hash الفعلي لاحقاً
      type: 'png',
      version: { increment: 1 },
      updatedBy: 'system-add'
    }
  });

  console.log(`✅ تم إضافة PNG URL لـ nav.profile`);
  console.log(`   URL: ${pngUrl}`);
  console.log('');

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

addProfileIcon().catch(console.error);
