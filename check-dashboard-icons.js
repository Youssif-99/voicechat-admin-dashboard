/**
 * Check what icon assets exist in the Admin Dashboard database
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Admin Dashboard Icon Records ===\n');

  // Check if Icon table exists and has data
  try {
    const iconCount = await prisma.icon.count();
    console.log(`Total icons in Admin Dashboard: ${iconCount}\n`);

    if (iconCount > 0) {
      const navIcons = await prisma.icon.findMany({
        where: {
          key: {
            startsWith: 'nav.'
          },
          deletedAt: null
        },
        orderBy: { key: 'asc' }
      });

      console.log(`Found ${navIcons.length} navigation icons:\n`);
      
      for (const icon of navIcons) {
        console.log(`${icon.key}:`);
        console.log(`  Display Name: ${icon.displayName}`);
        console.log(`  SVG URL: ${icon.svgUrl || 'NULL'}`);
        console.log(`  PNG URL: ${icon.pngUrl || 'NULL'}`);
        console.log(`  Type: ${icon.type}`);
        console.log(`  Enabled: ${icon.enabled}`);
        console.log(`  Version: ${icon.version}\n`);
      }
    } else {
      console.log('No icons found in Admin Dashboard database');
      console.log('Icon table may not exist or is empty');
    }
  } catch (error) {
    console.log('Error accessing Icon table:', error.message);
    console.log('The Icon table may not exist in this database');
  }

  // Check if there are any AppAsset records (alternative storage)
  try {
    const assetCount = await prisma.appAsset.count();
    console.log(`Total assets in Admin Dashboard: ${assetCount}\n`);

    if (assetCount > 0) {
      const navAssets = await prisma.appAsset.findMany({
        where: {
          key: {
            startsWith: 'nav.'
          },
          deletedAt: null
        },
        orderBy: { key: 'asc' }
      });

      console.log(`Found ${navAssets.length} navigation assets:\n`);
      
      for (const asset of navAssets) {
        console.log(`${asset.key}:`);
        console.log(`  Name: ${asset.name}`);
        console.log(`  Image URL: ${asset.imageUrl || 'NULL'}`);
        console.log(`  Thumbnail URL: ${asset.thumbnailUrl || 'NULL'}`);
        console.log(`  MIME Type: ${asset.mimeType || 'NULL'}`);
        console.log(`  Active: ${asset.isActive}\n`);
      }
    }
  } catch (error) {
    console.log('Error accessing AppAsset table:', error.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
