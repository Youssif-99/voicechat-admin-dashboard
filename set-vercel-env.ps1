# PowerShell script to set Vercel environment variables
# Run this after installing Vercel CLI: npm install -g vercel

Write-Host "Setting Vercel Environment Variables for voicechat-admin-dashboard" -ForegroundColor Green
Write-Host ""

# Check if vercel CLI is installed
try {
    $vercelVersion = vercel --version 2>&1
    Write-Host "✓ Vercel CLI detected: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Install it first:" -ForegroundColor Red
    Write-Host "   npm install -g vercel" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
Set-Location $PSScriptRoot

# Set EXPRESS_API_URL (CRITICAL)
Write-Host "1. Setting EXPRESS_API_URL..." -ForegroundColor Yellow
"https://voicechat-backend.fly.dev" | vercel env add EXPRESS_API_URL production
Write-Host "   ✓ EXPRESS_API_URL set for production" -ForegroundColor Green

# Set for preview and development too
"https://voicechat-backend.fly.dev" | vercel env add EXPRESS_API_URL preview
Write-Host "   ✓ EXPRESS_API_URL set for preview" -ForegroundColor Green

"https://voicechat-backend.fly.dev" | vercel env add EXPRESS_API_URL development
Write-Host "   ✓ EXPRESS_API_URL set for development" -ForegroundColor Green

Write-Host ""
Write-Host "2. Setting INTERNAL_SERVICE_TOKEN..." -ForegroundColor Yellow
"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0" | vercel env add INTERNAL_SERVICE_TOKEN production
Write-Host "   ✓ INTERNAL_SERVICE_TOKEN set" -ForegroundColor Green

Write-Host ""
Write-Host "3. Setting SESSION_SECRET..." -ForegroundColor Yellow
"d3v-s3cr3t-v0ice-adm1n-2026-ch4nge-b3f0re-pr0d-d3pl0yment" | vercel env add SESSION_SECRET production
Write-Host "   ✓ SESSION_SECRET set" -ForegroundColor Green

Write-Host ""
Write-Host "4. Setting DATABASE_URL..." -ForegroundColor Yellow
"postgresql://neondb_owner:npg_i3rnohlUeHY7@ep-steep-sky-b4hv2ocm-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15" | vercel env add DATABASE_URL production
Write-Host "   ✓ DATABASE_URL set" -ForegroundColor Green

Write-Host ""
Write-Host "5. Setting DIRECT_URL..." -ForegroundColor Yellow
"postgresql://neondb_owner:npg_i3rnohlUeHY7@ep-steep-sky-b4hv2ocm.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15" | vercel env add DIRECT_URL production
Write-Host "   ✓ DIRECT_URL set" -ForegroundColor Green

Write-Host ""
Write-Host "✅ All environment variables set successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: You must redeploy for changes to take effect" -ForegroundColor Yellow
Write-Host "   Run: vercel --prod" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Or trigger redeploy from Vercel Dashboard:" -ForegroundColor Cyan
Write-Host "   https://vercel.com/dashboard → Select Project → Deployments → Redeploy" -ForegroundColor Cyan
