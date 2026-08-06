$base = "http://localhost:3000"

# Login
$loginBody = '{"email":"admin@voicechatapp.com","password":"Admin@123456"}'
try {
  $login = Invoke-RestMethod -Uri "$base/api/admin/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
  Write-Host "LOGIN OK role=$($login.admin.role)"
  $token = $login.accessToken
  $refreshToken = $login.refreshToken
} catch {
  Write-Host "LOGIN FAILED: $($_.ErrorDetails.Message)"
  exit 1
}

# /me
try {
  $headers = @{ Authorization = "Bearer $token" }
  $me = Invoke-RestMethod -Uri "$base/api/admin/auth/me" -Headers $headers
  Write-Host "/me OK email=$($me.data.email)"
} catch {
  Write-Host "/me FAILED: $($_.ErrorDetails.Message)"
}

# stats
try {
  $stats = Invoke-RestMethod -Uri "$base/api/admin/stats/dashboard" -Headers $headers
  Write-Host "STATS OK totalUsers=$($stats.data.totalUsers)"
} catch {
  Write-Host "STATS FAILED: $($_.ErrorDetails.Message)"
}

# banners list
try {
  $banners = Invoke-RestMethod -Uri "$base/api/admin/banners" -Headers $headers
  Write-Host "BANNERS OK count=$($banners.data.Count)"
} catch {
  Write-Host "BANNERS FAILED: $($_.ErrorDetails.Message)"
}

# refresh
try {
  $refreshBody = "{`"refreshToken`":`"$refreshToken`"}"
  $refresh = Invoke-RestMethod -Uri "$base/api/admin/auth/refresh" -Method POST -ContentType "application/json" -Body $refreshBody
  Write-Host "REFRESH OK newToken=$($refresh.accessToken.Substring(0,20))..."
} catch {
  Write-Host "REFRESH FAILED: $($_.ErrorDetails.Message)"
}

Write-Host "DONE"
