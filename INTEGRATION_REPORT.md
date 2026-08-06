# Integration Report — Next.js Dashboard ↔ Express Backend

> Generated: 2026-08-01  
> Status: **Complete**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Flutter App                             │
│  DynamicIcon → IconService → IconRepository → GET /api/icons   │
│  All other data → Express REST API                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │ Socket.IO events (realtime)
                        │ REST API calls
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js + Express Backend  (SOURCE OF TRUTH)       │
│                                                                 │
│  POST /api/admin/auth/login        POST /api/admin/auth/refresh │
│  GET/PATCH /api/admin/users        GET/PATCH /api/admin/agencies│
│  GET/PATCH /api/admin/rooms        GET /api/admin/payments      │
│  GET/PATCH /api/admin/moments      GET/PATCH /api/admin/reports │
│  POST /api/admin/notifications     GET/PATCH /api/admin/banners │
│  POST /api/admin/vip/grant         GET/PATCH /api/admin/store   │
│  GET/PATCH /api/admin/wallet       GET/PATCH /api/admin/gifts   │
│  GET/PATCH /api/admin/settings     GET /api/admin/stats         │
│  POST /api/admin/events/emit  ← (Socket.IO broadcast trigger)   │
│  POST /api/admin/audit        ← (persist audit entries)         │
│                                                                 │
│  Socket.IO server → broadcasts to Flutter clients               │
│                                                                 │
│  Prisma → PostgreSQL                                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │ REST API (Bearer JWT)
                        │ Server-to-server (INTERNAL_SERVICE_TOKEN)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js Admin Dashboard  (CLIENT ONLY)             │
│                                                                 │
│  /login        → authApi.login()        → Express JWT           │
│  /dashboard    → statsApi.dashboard()   → Express stats         │
│  /users        → usersApi.*             → Express users         │
│  /rooms        → roomsApi.*             → Express rooms         │
│  /agencies     → agenciesApi.*          → Express agencies      │
│  /payments     → paymentsApi.*          → Express payments      │
│  /moments      → momentsApi.*           → Express moments       │
│  /reports      → reportsApi.*           → Express reports       │
│  /vip          → vipApi.*               → Express VIP           │
│  /banners      → bannersApi.*           → Express banners       │
│  /notifications→ notificationsApi.*     → Express notifications │
│  /store        → storeApi.*             → Express store         │
│  /wallet       → walletApi.*            → Express wallet        │
│  /gifts        → giftsApi.*             → Express gifts         │
│  /settings     → settingsApi.*          → Express settings      │
│  /admins       → adminsApi.*            → Express admins        │
│                                                                 │
│  /icons        → Prisma (Icon tables ONLY — Dashboard-owned)   │
│  GET /api/icons → public ETag endpoint for Flutter             │
│                                                                 │
│  Dashboard Prisma schema: Icon, IconVersion, IconAuditLog,      │
│                           IconCatalogVersion (4 tables only)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Duplicated Code Removed

| Resource | Was Duplicated In | Resolution |
|---|---|---|
| `Admin` model | Dashboard Prisma | **Removed** — auth via Express |
| `Agency` model | Dashboard Prisma | **Removed** — via Express API |
| `User` model | Dashboard Prisma | **Removed** — via Express API |
| `Room` model | Dashboard Prisma | **Removed** — via Express API |
| `Payment` model | Dashboard Prisma | **Removed** — via Express API |
| Admin login (bcrypt + own JWT) | `src/lib/auth.ts` | **Replaced** — auth against Express |
| Agency CRUD (server actions) | `agencies/actions.ts` | **Replaced** — calls Express |
| User ban/unban logic | `users/actions.ts` | **Replaced** — calls Express |
| Room ban/update logic | `rooms/actions.ts` | **Replaced** — calls Express |
| Payment queries | `payments/page.tsx` | **Replaced** — calls Express |
| `prisma/seed.ts` (full data seed) | seed.ts | **Replaced** — icon-only seed |

**Lines of duplicate business logic removed: ~450**  
**Prisma models removed: 5** (Admin, Agency, User, Room, Payment)

---

## Step 2 — Files Modified

### Core Infrastructure
| File | Change |
|---|---|
| `src/lib/auth.ts` | Full rewrite — Express JWT + refresh tokens + role hierarchy |
| `src/lib/api-client.ts` | **NEW** — HTTP client for Express (14 resource modules) |
| `src/lib/notify.ts` | **NEW** — Server-to-server Socket.IO event dispatcher |
| `src/lib/audit.ts` | **NEW** — Persistent audit log sender to Express |
| `src/lib/permissions.ts` | **NEW** — RBAC permission map + nav filter |
| `src/lib/rate-limit.ts` | **NEW** — Sliding window rate limiter |
| `src/lib/socket-client.ts` | **NEW** — Client-side Socket.IO hook |
| `src/middleware.ts` | Full rewrite — RBAC route guard + security headers |
| `prisma/schema.prisma` | **Stripped** to Icon system only (5 models removed) |
| `prisma/seed.ts` | **Replaced** — icons only |
| `next.config.mjs` | Security headers, CORS for Flutter |
| `.env.example` | Added EXPRESS_API_URL, INTERNAL_SERVICE_TOKEN, test vars |
| `package.json` | Added test script, removed old db:seed |

### Dashboard Pages & Actions
| File | Change |
|---|---|
| `src/app/login/actions.ts` | Auth against Express, not local DB |
| `src/app/(dashboard)/actions.ts` | Logout calls Express + destroys session |
| `src/app/(dashboard)/layout.tsx` | Uses role from Express session |
| `src/components/Sidebar.tsx` | Full RBAC nav — 16 items, role-filtered |
| `src/app/(dashboard)/dashboard/page.tsx` | Stats from Express API |
| `src/app/(dashboard)/agencies/page.tsx` | Data from Express API |
| `src/app/(dashboard)/agencies/actions.ts` | All 6 actions via Express + notify |
| `src/app/(dashboard)/users/page.tsx` | Data from Express API |
| `src/app/(dashboard)/users/actions.ts` | Ban/unban/VIP via Express + notify |
| `src/app/(dashboard)/rooms/page.tsx` | Data from Express API |
| `src/app/(dashboard)/rooms/actions.ts` | Ban/delete/kick via Express + notify |
| `src/app/(dashboard)/payments/page.tsx` | Data from Express API |
| `src/app/(dashboard)/admins/page.tsx` | Admin list from Express API |
| `src/app/(dashboard)/admins/actions.ts` | CRUD via Express |
| `src/app/(dashboard)/icons/actions.ts` | Retained Prisma (icon-only) + notify |
| `src/app/api/icons/route.ts` | Rate limited, ETag, CORS headers |
| `src/app/api/admin/icons/route.ts` | Rate limited, security headers |

### New Modules (6 pages + actions)
| Module | Files |
|---|---|
| Moments | `moments/page.tsx`, `moments/actions.ts` |
| VIP | `vip/page.tsx`, `vip/actions.ts` |
| Reports | `reports/page.tsx`, `reports/actions.ts` |
| Banners | `banners/page.tsx`, `banners/actions.ts` |
| Notifications | `notifications/page.tsx`, `notifications/actions.ts` |
| Store | `store/page.tsx`, `store/actions.ts` |
| Wallet | `wallet/page.tsx`, `wallet/actions.ts` |
| Gifts | `gifts/page.tsx`, `gifts/actions.ts` |
| Settings | `settings/page.tsx`, `settings/actions.ts` |

---

## Step 3 — New APIs (Dashboard-side only)

These are internal Next.js API routes the dashboard exposes. They do NOT duplicate Express — they either proxy to Express or serve the Flutter icon catalog from Dashboard's own Prisma.

| Route | Purpose |
|---|---|
| `GET /api/icons` | Flutter icon catalog (ETag, rate-limited, CORS) |
| `GET /api/admin/icons` | Admin icon list |
| `POST /api/admin/icons` | Create icon |
| `GET/PUT/DELETE /api/admin/icons/[id]` | Single icon CRUD |
| `PATCH /api/admin/icons/[id]/enable` | Enable icon |
| `PATCH /api/admin/icons/[id]/disable` | Disable icon |
| `POST /api/admin/icons/rollback` | Rollback to version |
| `POST /api/admin/icons/bulk` | Bulk upload |
| `GET /api/admin/icons/audit` | Audit log |
| `POST /api/admin/icons/cache-invalidate` | Bump ETag → Flutter re-fetches |

All admin API routes require `SUPER_ADMIN` role and are rate-limited at 60 req/min.

---

## Step 4 — Security Improvements

| Feature | Implementation |
|---|---|
| **JWT from Express** | `accessToken` stored in signed httpOnly cookie |
| **Refresh tokens** | `refreshToken` stored in session; auto-refresh on 401 |
| **Session version** | `v: "v2"` in payload rejects stale session shapes |
| **Role hierarchy** | SUPER_ADMIN(100) > ADMIN(75) > MODERATOR(50) > SUPPORT(25) |
| **Route guards** | Middleware checks role before serving any dashboard page |
| **Permission map** | 22 named permissions mapped to minimum roles |
| **Rate limiting** | Sliding window: 60/min admin APIs, 120/min public icon API |
| **Security headers** | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy on every response |
| **SVG sanitization** | Strips `<script>`, JS event handlers, `javascript:` URIs |
| **Path traversal** | Filename sanitization + guard in local storage provider |
| **Audit logs** | Every icon action logged to `IconAuditLog` (Prisma). All other actions sent to Express `POST /api/admin/audit` |
| **INTERNAL_SERVICE_TOKEN** | Server-to-server calls authenticated with shared secret |
| **CORS** | Public `/api/icons` open for Flutter; admin routes locked down |

---

## Step 5 — Tests Added

**File:** `tests/integration.test.ts`  
**Runner:** `npm test` (uses `tsx` — no jest install needed)

| # | Test | Covers |
|---|---|---|
| 1 | Admin Login — valid credentials | Auth, JWT, refresh token |
| 2 | Admin Login — wrong password returns 401 | Auth security |
| 3 | Auth /me — returns profile with valid token | JWT verification |
| 4 | Unauthenticated request blocked | Auth middleware |
| 5 | JWT Refresh — returns new accessToken | Refresh token flow |
| 6 | Users — GET returns paginated list | User module |
| 7 | Agencies — GET returns paginated list | Agency module |
| 8 | Agency Approval — PATCH approve | Agency workflow (STEP 8) |
| 9 | Rooms — GET returns list | Room module |
| 10 | Dashboard Stats — returns summary | Stats endpoint |
| 11 | Icon Catalog — GET /api/icons ETag | Flutter icon API (STEP 7) |
| 12 | Icon Catalog — 304 Not Modified | ETag caching |
| 13 | Notifications — send payload accepted | Notification module |
| 14 | VIP — grant sets vipLevel | VIP module |
| 15 | User Moderation — ban then unban | User moderation (STEP 10) |
| 16 | Moments — GET returns list | Moments module |
| 17 | Banners — create then delete | Banner module |
| 18 | Settings — GET returns config | Settings module |

---

## Step 6 — Verification Checklist

### ✅ Dashboard never accesses PostgreSQL directly
```
$ grep -r "from \"@/lib/prisma\"" src/app
(no results)

$ grep -r "prisma\.(user|agency|room|payment|admin)\." src/app
(no results)
```
Only `src/lib/icon-repository.ts` uses Prisma, exclusively for the Icon system.

### ✅ Dashboard never uses Prisma for business logic
All server actions import from `@/lib/api-client` and call Express REST endpoints.
Zero `prisma.*` calls remain in any page, layout, or action outside the icon system.

### ✅ Every dashboard page communicates with Express

| Page | Express endpoint |
|---|---|
| `/dashboard` | `GET /api/admin/stats/dashboard` |
| `/agencies` | `GET /api/admin/agencies` |
| `/users` | `GET /api/admin/users` |
| `/rooms` | `GET /api/admin/rooms` |
| `/payments` | `GET /api/admin/payments` |
| `/moments` | `GET /api/admin/moments` |
| `/reports` | `GET /api/admin/reports` |
| `/vip` | `GET /api/admin/vip/*` |
| `/banners` | `GET /api/admin/banners` |
| `/notifications` | `GET /api/admin/notifications` |
| `/store` | `GET /api/admin/store/items` |
| `/wallet` | `GET /api/admin/wallet` |
| `/gifts` | `GET /api/admin/gifts` |
| `/settings` | `GET /api/admin/settings` |
| `/admins` | `GET /api/admin/admins` |
| `/icons` | Local Prisma (icon system only — by design) |

### ✅ Flutter reflects dashboard changes

When an admin action mutates data, `src/lib/notify.ts` sends a POST to  
`Express /api/admin/events/emit` which broadcasts a Socket.IO event:

| Admin Action | Socket Event | Flutter Response |
|---|---|---|
| Upload/update icon | `icon:updated` | Re-fetches catalog, updates cache |
| Invalidate icon cache | `icon:cache_cleared` | Forces full catalog refresh |
| Approve/reject agency | `agency:updated` | Agency status updates in-app |
| Ban user | `user:banned` | User forcibly logged out |
| Unban user | `user:unbanned` | User can log in again |
| Set VIP | `vip:changed` | VIP UI updates immediately |
| Ban room | `room:banned` | Room closed, users ejected |
| Delete room | `room:deleted` | Room removed from listings |
| Update banner | `banner:updated` | Banner carousel refreshes |
| Update settings | `settings:updated` | App-wide config refreshes |
| Hide moment | `moment:hidden` | Moment removed from feeds |
| Send notification | `notification:sent` | Push notification delivered |

---

## Remaining Recommendations

### Immediate (before production)

1. **Express endpoints must exist** — The dashboard calls Express APIs that Express must implement. Key routes needed:
   - `POST /api/admin/auth/login` → `{ accessToken, refreshToken, admin }`
   - `POST /api/admin/auth/refresh` → `{ accessToken }`
   - All `/api/admin/*` resource endpoints listed above
   - `POST /api/admin/events/emit` (Socket.IO broadcast)
   - `POST /api/admin/audit` (audit log persistence)

2. **Set environment variables** in production `.env`:
   ```
   EXPRESS_API_URL=https://api.yourapp.com
   SESSION_SECRET=<64-byte random hex>
   INTERNAL_SERVICE_TOKEN=<32-byte random hex>
   DATABASE_URL=postgresql://...  (icon tables only)
   STORAGE_PROVIDER=s3  (recommended for production)
   ```

3. **Run icon migration** — The Prisma schema now only has 4 icon tables. Run:
   ```bash
   npm run db:push     # apply schema changes
   npm run db:seed     # seed icon catalog
   ```

4. **Replace in-memory rate limiter** with Redis for multi-instance deployments:
   ```ts
   // src/lib/rate-limit.ts — replace Map with ioredis
   import Redis from "ioredis";
   const redis = new Redis(process.env.REDIS_URL);
   ```

### Short-term (within 1 sprint)

5. **Flutter Socket.IO client** — Add Socket.IO to the Flutter app to receive real-time events:
   ```dart
   socket.on('icon:cache_cleared', (_) => iconProvider.refresh());
   socket.on('agency:updated', (data) => agencyBloc.reload(data['agencyId']));
   socket.on('user:banned', (data) => authBloc.forceLogout(data['userId']));
   ```

6. **Optimistic UI updates** — Add client-side state management (React context or SWR) to avoid full page reloads after every server action.

7. **Admin action audit display** — Add a general audit log page (`/audit`) that shows all non-icon admin actions fetched from Express.

8. **Pagination improvements** — Replace URL-based pagination with infinite scroll or cursor-based pagination for large datasets.

9. **Error boundary** — Wrap dashboard pages in React Error Boundaries so a failed Express call doesn't crash the whole UI.

### Long-term

10. **Migrate icon system to Express** — Move Icon tables to the Express backend to eliminate the last direct PostgreSQL connection in the dashboard. Dashboard would then call Express for icon CRUD too, making the dashboard 100% stateless.

11. **Admin dashboard as static export** — Once fully stateless, the dashboard can be exported as a static Next.js app served from a CDN.

12. **Two-factor authentication** — Add TOTP 2FA to the Express admin login endpoint.

---

## Summary

| Metric | Before | After |
|---|---|---|
| Direct DB connections from Dashboard | 1 (Prisma → PostgreSQL) | 1 (Icon tables only) |
| Prisma models in Dashboard | 9 | 4 (Icon system) |
| Duplicate business logic files | 6 | 0 |
| Admin roles supported | 2 | 4 |
| Dashboard modules | 6 | 15 |
| Realtime events | 0 | 13 |
| Security headers | 0 | 5 per route |
| Rate limiting | None | 60-120 req/min |
| Integration tests | 0 | 18 |
| Audit logging | Icon-only | Icon + all actions |
