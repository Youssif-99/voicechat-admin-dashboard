# Vercel Environment Variables Setup

**CRITICAL:** The admin dashboard MUST have `EXPRESS_API_URL` set to the production backend URL in Vercel's environment settings.

## Required Environment Variables

Set these in Vercel Project Settings → Environment Variables:

### 1. EXPRESS_API_URL (REQUIRED)
- **Variable Name:** `EXPRESS_API_URL`
- **Value:** `https://voicechat-backend.fly.dev`
- **Environments:** Production, Preview, Development (all)
- **Purpose:** Points the admin dashboard to the real backend API

### 2. INTERNAL_SERVICE_TOKEN (REQUIRED)
- **Variable Name:** `INTERNAL_SERVICE_TOKEN`
- **Value:** `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0`
- **Environments:** Production, Preview, Development
- **Purpose:** Authenticates server-to-server communication with backend

### 3. SESSION_SECRET (REQUIRED)
- **Variable Name:** `SESSION_SECRET`
- **Value:** `d3v-s3cr3t-v0ice-adm1n-2026-ch4nge-b3f0re-pr0d-d3pl0yment`
- **Environments:** Production, Preview, Development
- **Purpose:** Signs admin session cookies

### 4. DATABASE_URL (REQUIRED)
- **Variable Name:** `DATABASE_URL`
- **Value:** `postgresql://neondb_owner:npg_i3rnohlUeHY7@ep-steep-sky-b4hv2ocm-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15`
- **Environments:** Production, Preview, Development
- **Purpose:** Prisma database connection (for icon management)

### 5. DIRECT_URL (REQUIRED for migrations)
- **Variable Name:** `DIRECT_URL`
- **Value:** `postgresql://neondb_owner:npg_i3rnohlUeHY7@ep-steep-sky-b4hv2ocm.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15`
- **Environments:** Production, Preview, Development
- **Purpose:** Prisma migrations (direct connection, no pooler)

### 6. NEXT_PUBLIC_SOCKET_URL (Optional)
- **Variable Name:** `NEXT_PUBLIC_SOCKET_URL`
- **Value:** `https://voicechat-backend.fly.dev`
- **Environments:** Production, Preview, Development
- **Purpose:** Real-time Socket.IO connection

### 7. NEXT_PUBLIC_EXPRESS_URL (Optional)
- **Variable Name:** `NEXT_PUBLIC_EXPRESS_URL`
- **Value:** `https://voicechat-backend.fly.dev`
- **Environments:** Production, Preview, Development
- **Purpose:** Client-side API calls (if any)

### 8. NEXT_PUBLIC_BASE_URL (Optional)
- **Variable Name:** `NEXT_PUBLIC_BASE_URL`
- **Value:** `https://voicechat-admin-dashboard.vercel.app`
- **Environments:** Production
- **Purpose:** Asset URLs, redirects

## How to Set These Variables

### Option 1: Via Vercel Dashboard (Recommended)
1. Go to https://vercel.com/dashboard
2. Select the `voicechat-admin-dashboard` project
3. Click **Settings** → **Environment Variables**
4. Add each variable above with the specified value
5. Select all environments (Production, Preview, Development)
6. Click **Save**
7. **Redeploy** the project for changes to take effect

### Option 2: Via Vercel CLI
```bash
cd e:\voicechat\voice-admin-dashboard

# Set production environment
vercel env add EXPRESS_API_URL production
# When prompted, enter: https://voicechat-backend.fly.dev

vercel env add INTERNAL_SERVICE_TOKEN production
# When prompted, enter: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0

vercel env add SESSION_SECRET production
# When prompted, enter: d3v-s3cr3t-v0ice-adm1n-2026-ch4nge-b3f0re-pr0d-d3pl0yment

vercel env add DATABASE_URL production
# Enter the full DATABASE_URL from above

# Repeat for preview and development if needed
```

## Verification After Setup

After setting environment variables and redeploying:

1. **Check Build Logs:**
   - Vercel dashboard → Deployments → Latest → View Function Logs
   - Look for `EXPRESS_API_URL` being set correctly

2. **Test Login:**
   - Go to https://voicechat-admin-dashboard.vercel.app/login
   - **Before fix:** "Failed to connect to server — make sure Express Backend is running on http://localhost:4000"
   - **After fix:** Login should work or show proper authentication error

3. **Verify API Calls:**
   - Open browser DevTools → Network tab
   - Login to dashboard
   - Check API requests go to `https://voicechat-backend.fly.dev/api/...` NOT `localhost`

## Troubleshooting

### Still seeing localhost:4000 error
- Clear Vercel build cache: Settings → General → Clear Cache
- Force redeploy: Deployments → Latest → ... → Redeploy

### Environment variable not taking effect
- Ensure variable is set for **Production** environment
- Redeploy is REQUIRED after adding/changing env vars
- Check deployment logs for the actual value being used

### Database connection errors
- Verify `DATABASE_URL` includes `connect_timeout=15`
- Check Neon database is not suspended
- Ensure IP allowlist includes Vercel IPs (or is disabled)

## Security Notes

⚠️ **IMPORTANT:** The `SESSION_SECRET` and `INTERNAL_SERVICE_TOKEN` shown here are development values.

**Before going to production, generate new secrets:**

```bash
# Generate a new SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate a new INTERNAL_SERVICE_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then update:
1. Vercel environment variables
2. Backend `.env` file (INTERNAL_SERVICE_TOKEN must match)
3. Redeploy both admin dashboard and backend
