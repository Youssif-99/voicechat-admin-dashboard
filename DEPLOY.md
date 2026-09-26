# Admin Dashboard Deployment Guide

## Prerequisites

- Fly.io CLI installed and logged in
- PostgreSQL database URL (same as backend)
- Backend API URL

## Quick Deploy

### 1. Create the Fly.io app (if not exists)

```powershell
cd e:\voicechat\voice-admin-dashboard
fly apps create voicechat-admin-dashboard --org personal
```

### 2. Set Required Secrets

```powershell
# Database connection (same as backend)
fly secrets set DATABASE_URL="postgresql://user:pass@host/db" --app voicechat-admin-dashboard

# Backend API URL for rewrites
fly secrets set BACKEND_URL="https://demedia-back-end.fly.dev" --app voicechat-admin-dashboard

# NextAuth secret (generate a random string)
fly secrets set NEXTAUTH_SECRET="$(openssl rand -base64 32)" --app voicechat-admin-dashboard

# App URL (your dashboard URL)
fly secrets set NEXT_PUBLIC_API_URL="https://voicechat-admin-dashboard.fly.dev" --app voicechat-admin-dashboard
```

### 3. Deploy

```powershell
fly deploy --app voicechat-admin-dashboard
```

### 4. Run Database Migrations (first time only)

```powershell
fly ssh console --app voicechat-admin-dashboard -C "npx prisma migrate deploy"
```

### 5. Verify

```powershell
# Check health
Invoke-WebRequest https://voicechat-admin-dashboard.fly.dev/api/health

# View logs
fly logs --app voicechat-admin-dashboard
```

## Environment Variables

Required secrets:
- `DATABASE_URL` - PostgreSQL connection string
- `BACKEND_URL` - Backend API URL for proxying
- `NEXTAUTH_SECRET` - Secret for NextAuth.js sessions
- `NEXT_PUBLIC_API_URL` - Public dashboard URL

Optional:
- `NODE_ENV` - Set to 'production' (automatically set in fly.toml)

## Troubleshooting

### Build fails with "Module not found: sharp"
- Fixed: Dockerfile now installs build-essential for native modules
- The current Dockerfile handles sharp compilation correctly

### App crashes on startup
```powershell
fly logs --app voicechat-admin-dashboard
```

### Database connection issues
- Verify DATABASE_URL is correct
- Check if database is accessible from Fly.io
- Run: `fly ssh console --app voicechat-admin-dashboard -C "npx prisma migrate status"`

### Check app status
```powershell
fly status --app voicechat-admin-dashboard
fly checks --app voicechat-admin-dashboard
```

## Architecture

The admin dashboard is a Next.js application that:
1. Serves the admin UI (Next.js pages)
2. Hosts asset/icon APIs (`/api/assets`, `/api/icons`)
3. Proxies backend APIs (`/api/auth`, `/api/users`, etc.)
4. Manages admin-specific routes (`/api/admin/*`)

## URLs

- **Admin Dashboard**: https://voicechat-admin-dashboard.fly.dev
- **Health Check**: https://voicechat-admin-dashboard.fly.dev/api/health
- **Backend API**: https://demedia-back-end.fly.dev

## Updating

To deploy updates:

```powershell
cd e:\voicechat\voice-admin-dashboard
fly deploy --app voicechat-admin-dashboard
```

## Monitoring

```powershell
# View logs (live)
fly logs --app voicechat-admin-dashboard

# View logs (past 100 lines)
fly logs --app voicechat-admin-dashboard --no-tail

# Check metrics
fly dashboard voicechat-admin-dashboard
```
