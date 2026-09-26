const fetch = require('node-fetch');

async function testIconsAPI() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 اختبار API: GET /api/icons');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const response = await fetch('http://localhost:3000/api/icons');
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    
    console.log(`✅ API يعمل بنجاح!`);
    console.log(`   ETag: ${data.etag}`);
    console.log(`   Version: ${data.version}`);
    console.log(`   عدد الأيقونات الكلي: ${data.icons.length}\n`);

    const bottomNavIcons = data.icons.filter(icon => icon.category === 'bottom_nav');
    console.log(`📊 أيقونات Bottom Navigation: ${bottomNavIcons.length}\n`);

    const navKeys = ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'];
    
    navKeys.forEach(key => {
      const icon = bottomNavIcons.find(i => i.key === key);
      if (icon) {
        console.log(`✅ ${key} (${icon.displayName})`);
        console.log(`   SVG: ${icon.svgUrl || 'غير موجود'}`);
        console.log(`   PNG: ${icon.pngUrl || 'غير موجود'}`);
      } else {
        console.log(`❌ ${key}: غير موجودة في الاستجابة!`);
      }
      console.log('');
    });

  } catch (error) {
    console.log(`❌ خطأ: ${error.message}`);
    console.log('');
    console.log('💡 تأكد من تشغيل Next.js server:');
    console.log('   npm run dev');
  }
}

testIconsAPI();
