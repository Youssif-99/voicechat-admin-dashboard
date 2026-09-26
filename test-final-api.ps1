try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/icons" -Method GET -Headers @{"Accept"="application/json"} -ErrorAction Stop
    $json = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ API يعمل!`n"
    Write-Host "ETag: $($json.etag)"
    Write-Host "Version: $($json.version)"
    Write-Host "عدد الأيقونات الكلي: $($json.icons.Count)`n"
    
    $bottomNav = $json.icons | Where-Object { $_.category -eq 'bottom_nav' }
    Write-Host "أيقونات Bottom Navigation: $($bottomNav.Count)`n"
    
    $keys = @('nav.home', 'nav.rooms', 'nav.moments', 'nav.profile')
    foreach ($key in $keys) {
        $icon = $bottomNav | Where-Object { $_.key -eq $key }
        if ($icon) {
            Write-Host "✅ $($icon.key) ($($icon.displayName))"
            Write-Host "   PNG: $($icon.pngUrl)"
            Write-Host ""
        } else {
            Write-Host "❌ ${key}: غير موجودة!`n"
        }
    }
} catch {
    Write-Host "❌ خطأ: $($_.Exception.Message)"
    Write-Host "`nتأكد من تشغيل Next.js: npm run dev"
}
