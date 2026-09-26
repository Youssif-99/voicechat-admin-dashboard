/**
 * Check navigation icon records in Admin Dashboard database
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Navigation Icon Records ===\n');

  const navKeys = ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'];
  
  for (const key of navKeys) {
    const icon = await prisma.icon.findUnique({
      where: { key },
    });
    
    if (icon) {
      console.log(`Key: ${icon.key}`);
      console.log(`  Display Name: ${icon.displayName}`);
      console.log(`  Category: ${icon.category}`);
      console.log(`  Type: ${icon.type}`);
      console.log(`  SVG URL: ${icon.svgUrl || 'NULL'}`);
      console.log(`  PNG URL: ${icon.pngUrl || 'NULL'}`);
      console.log(`  SVG Hash: ${icon.svgHash || 'NULL'}`);
      console.log(`  PNG Hash: ${icon.pngHash || 'NULL'}`);
      console.log(`  Enabled: ${icon.enabled}`);
      console.log(`  Version: ${icon.version}`);
      console.log(`  Updated At: ${icon.updatedAt}`);
      console.log(`  Deleted At: ${icon.deletedAt || 'NULL'}`);
      console.log('');
    } else {
      console.log(`Key: ${key} - NOT FOUND IN DATABASE\n`);
    }
  }

  // Also check if there are any other navigation icons
  console.log('=== All Navigation Category Icons ===\n');
  const allNavIcons = await prisma.icon.findMany({
    where: { 
      category: { contains: 'NAV', mode: 'insensitive' },
      deletedAt: null
    },
    orderBy: { key: 'asc' }
  });

  console.log(`Found ${allNavIcons.length} navigation icons:\n`);
  for (const icon of allNavIcons) {
    console.log(`${icon.key}: ${icon.displayName}`);
    console.log(`  SVG: ${icon.svgUrl || 'NULL'}`);
    console.log(`  PNG: ${icon.pngUrl || 'NULL'}`);
    console.log(`  Enabled: ${icon.enabled}\n`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
