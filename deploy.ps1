# Admin Dashboard Deployment Script
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Admin Dashboard Deployment" -ForegroundColor Cyan
Write-Host ""

$appName = "voicechat-admin-dashboard"

# Check if fly CLI is available
if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    Write-Host "Fly CLI not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Checking if app exists..." -ForegroundColor Yellow
$appExists = fly apps list 2>&1 | Select-String $appName

if (-not $appExists) {
    Write-Host "App doesn't exist. Creating..." -ForegroundColor Yellow
    fly apps create $appName --org personal
    
    Write-Host ""
    Write-Host "App created! Now set the required secrets:" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. DATABASE_URL (same as backend):" -ForegroundColor Cyan
    $dbUrl = Read-Host "Enter DATABASE_URL"
    
    Write-Host ""
    Write-Host "2. BACKEND_URL:" -ForegroundColor Cyan
    $backendUrl = Read-Host "Enter BACKEND_URL (e.g., https://demedia-back-end.fly.dev)"
    
    Write-Host ""
    Write-Host "Setting secrets..." -ForegroundColor Cyan
    
    # Generate random NEXTAUTH_SECRET
    $nextauthSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
    
    fly secrets set `
        DATABASE_URL="$dbUrl" `
        BACKEND_URL="$backendUrl" `
        NEXTAUTH_SECRET="$nextauthSecret" `
        NEXT_PUBLIC_API_URL="https://$appName.fly.dev" `
        --app $appName
    
    Write-Host "Secrets configured!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Deploying..." -ForegroundColor Cyan
Write-Host ""

fly deploy --app $appName

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment Successful!" -ForegroundColor Green
    Write-Host "Admin Dashboard: https://$appName.fly.dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test health check:" -ForegroundColor Yellow
    Write-Host "  Invoke-WebRequest https://$appName.fly.dev/api/health" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "Check logs: fly logs --app $appName" -ForegroundColor Yellow
}
