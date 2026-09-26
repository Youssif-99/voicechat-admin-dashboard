async function testFinalAPI() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 اختبار نهائي للـ API');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Import fetch dynamically
    const fetch = await import('node-fetch').then(m => m.default).catch(() => null);
    
    if (!fetch) {
      // Use native fetch in Node.js 18+
      const response = await globalThis.fetch('http://localhost:3001/api/icons');
      const data = await response.json();
      displayResults(data);
    } else {
      const response = await fetch('http://localhost:3001/api/icons');
      const data = await response.json();
      displayResults(data);
    }
  } catch (error) {
    console.log(`❌ خطأ: ${error.message}`);
    console.log('');
    console.log('💡 تأكد من تشغيل Next.js:');
    console.log('   npm run dev');
  }
}

function displayResults(data) {
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
      console.log(`   PNG URL: ${icon.pngUrl || 'غير موجود'}`);
      console.log(`   SVG URL: ${icon.svgUrl || 'غير موجود'}`);
      console.log(`   Enabled: ${icon.enabled ? 'نعم' : 'لا'}`);
    } else {
      console.log(`❌ ${key}: غير موجودة في الاستجابة!`);
    }
    console.log('');
  });
}

testFinalAPI();
