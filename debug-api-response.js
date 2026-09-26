async function debugAPIResponse() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 تحليل استجابة API بالتفصيل');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const response = await globalThis.fetch('http://localhost:3001/api/icons');
    const data = await response.json();
    
    console.log(`ETag: ${data.etag}`);
    console.log(`Version: ${data.version}\n`);

    const navKeys = ['nav.home', 'nav.rooms', 'nav.moments', 'nav.profile'];
    
    navKeys.forEach(key => {
      const icon = data.icons.find(i => i.key === key);
      if (icon) {
        console.log(`━━━ ${key} ━━━`);
        console.log(JSON.stringify(icon, null, 2));
        console.log('');
      } else {
        console.log(`❌ ${key}: لا توجد في الاستجابة!\n`);
      }
    });
  } catch (error) {
    console.log(`❌ خطأ: ${error.message}`);
  }
}

debugAPIResponse();
