# Dynamic Icon Management System

Production-grade system for remotely managing all application UI icons from the Admin Dashboard — no rebuild, no app update required.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD (Next.js)                    │
│  /icons page  ──►  Server Actions  ──►  IconRepository  ──►  DB    │
│                                    └──►  Storage (S3/CDN/local)     │
└─────────────────────────────────────────────────────────────────────┘
                              │  REST API
                    GET /api/icons (ETag)
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUTTER APP                                 │
│                                                                     │
│  main()                                                             │
│   └── IconProvider.initialize()                                     │
│        ├── IconDiskCache.loadCatalog()     (warm from disk)         │
│        └── IconRepository.getCatalog()    (background fetch)        │
│             ├── CatalogNotModified (304) → use disk                 │
│             └── CatalogFetched (200)    → save disk + notify        │
│                                                                     │
│  DynamicIcon(iconKey: IconKeys.navHome)                             │
│   └── resolveSource(key)                                            │
│        1. Memory cache hit         → render immediately             │
│        2. Disk file (hash match)   → render SvgPicture.file         │
│        3. Remote URL               → render SvgPicture.network      │
│        4. Bundled asset            → render SvgPicture.asset        │
│        5. Generic fallback         → render Icon.image_not_supported│
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Map

### Backend / Admin Dashboard (`src/`)

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 4 models: `Icon`, `IconVersion`, `IconAuditLog`, `IconCatalogVersion` |
| `src/lib/storage.ts` | Upload/delete with S3, Cloudinary, or local storage; MIME validation; SVG sanitization |
| `src/lib/icon-repository.ts` | All DB operations: CRUD, versioning, rollback, bulk, audit, ETag |
| `src/lib/icon-groups.ts` | Canonical key registry (90+ icons across 17 categories) |
| `src/app/api/icons/route.ts` | `GET /api/icons` — public, ETag-aware, consumed by Flutter |
| `src/app/api/admin/icons/route.ts` | `GET /api/admin/icons` (filtered list) + `POST` (create) |
| `src/app/api/admin/icons/[id]/route.ts` | `GET`, `PUT` (replace), `DELETE` (soft) |
| `src/app/api/admin/icons/[id]/enable/route.ts` | `PATCH` — enable icon |
| `src/app/api/admin/icons/[id]/disable/route.ts` | `PATCH` — disable icon |
| `src/app/api/admin/icons/[id]/restore/route.ts` | `PATCH` — un-delete icon |
| `src/app/api/admin/icons/rollback/route.ts` | `POST` — rollback to version N |
| `src/app/api/admin/icons/bulk/route.ts` | `POST` — bulk upload (up to 100 icons) |
| `src/app/api/admin/icons/audit/route.ts` | `GET` — audit log with optional iconId filter |
| `src/app/api/admin/icons/cache-invalidate/route.ts` | `POST` — bump ETag, triggers Flutter re-download |
| `src/app/(dashboard)/icons/page.tsx` | Server component: 5-tab page with stats |
| `src/app/(dashboard)/icons/components.tsx` | Client components: table, forms, version history, audit log |
| `src/app/(dashboard)/icons/actions.ts` | Server actions: all mutations + seedDefaultIconsAction |
| `next.config.mjs` | Webpack aliases for optional S3/Cloudinary peer dependencies |
| `tailwind.config.ts` | Added `warning` colour token |

### Flutter (`flutter/`)

| File | Purpose |
|------|---------|
| `lib/features/icons/core/icon_keys.dart` | `abstract final class IconKeys` — 90+ typed string constants |
| `lib/features/icons/core/icon_constants.dart` | Runtime config (API URL, cache limits, fallback paths) |
| `lib/features/icons/data/models/icon_model.dart` | `IconModel` + `IconCatalog` JSON models |
| `lib/features/icons/data/models/icon_catalog.dart` | `IconCatalogX` extension (findByKey, byCategory, toKeyMap) |
| `lib/features/icons/cache/icon_disk_cache.dart` | Singleton disk cache: catalog JSON, ETag, per-icon files by hash, eviction |
| `lib/features/icons/cache/icon_memory_cache.dart` | LRU memory cache (200 entries), `IconDisplaySource` type |
| `lib/features/icons/repository/icon_remote_data_source.dart` | HTTP client: ETag conditional GET, retry+backoff, sealed result types |
| `lib/features/icons/repository/icon_repository.dart` | Orchestrates memory→disk→remote, concurrent fetch coalescing |
| `lib/features/icons/service/icon_service.dart` | Startup init, resolveSource (full fallback chain), 15-min background refresh |
| `lib/features/icons/provider/icon_provider.dart` | `ChangeNotifier` wrapping `IconService` |
| `lib/features/icons/provider/icon_provider_scope.dart` | `InheritedNotifier` root scope, `IconProviderScope.of(context)` |
| `lib/features/icons/widgets/dynamic_icon.dart` | `DynamicIcon` widget — zero-flicker, full fallback chain, tinting, semantics |
| `lib/features/icons/widgets/icon_loading_gate.dart` | Startup gate widget |
| `lib/features/icons/icons.dart` | Single barrel export for the entire feature |
| `lib/main.dart` | Complete integration example |
| `pubspec.yaml` | Dependencies: `http`, `flutter_svg`, `path`, `path_provider` |
| `assets/icons/fallback/generic.svg` | Generic fallback SVG (absolute last resort) |

---

## Database Schema

```prisma
model Icon {
  id          String    @id @default(cuid())
  key         String    @unique          // e.g. "nav.home", "gift.rose"
  displayName String
  category    String                     // e.g. "bottom_nav", "gifts"
  type        String    @default("svg")  // "svg" | "png" | "both"
  svgUrl      String?
  pngUrl      String?
  svgHash     String?                    // MD5 — used for ETag / dedup
  pngHash     String?
  enabled     Boolean   @default(true)
  version     Int       @default(1)      // increments on every mutation
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  updatedBy   String?                    // adminId
  deletedAt   DateTime?                  // soft delete
  versions    IconVersion[]
  auditLogs   IconAuditLog[]
}

model IconVersion {
  // Full snapshot of each previous state — enables rollback
  iconId, version, svgUrl, pngUrl, svgHash, pngHash,
  type, updatedBy, updatedByName, changeNote, createdAt
}

model IconAuditLog {
  // Every CREATE/UPDATE/DELETE/ENABLE/DISABLE/ROLLBACK/BULK_UPLOAD/CACHE_CLEAR
  iconId, action, adminId, adminName, adminEmail,
  metadata (JSON), ipAddress, userAgent, createdAt
}

model IconCatalogVersion {
  id        String @id @default("singleton")
  version   Int    // bumped on every icon mutation + cache-invalidate
  etag      String // SHA-256 fragment — used as HTTP ETag
  updatedAt DateTime
}
```

---

## REST API Reference

All admin endpoints require a valid `SUPER_ADMIN` session cookie.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/icons` | Public catalog (Flutter). Supports `If-None-Match` → 304. |
| `GET` | `/api/admin/icons` | Admin list. Query: `q`, `category`, `enabled`, `includeDeleted`, `page`, `pageSize` |
| `POST` | `/api/admin/icons` | Create icon. `multipart/form-data`: `key`, `displayName`, `category`, `type`, `svg?`, `png?`, `changeNote?` |
| `GET` | `/api/admin/icons/:id` | Single icon with version history + 50 recent audit logs |
| `PUT` | `/api/admin/icons/:id` | Replace/update. Same multipart schema as POST. |
| `DELETE` | `/api/admin/icons/:id` | Soft-delete (reversible) |
| `PATCH` | `/api/admin/icons/:id/enable` | Enable icon |
| `PATCH` | `/api/admin/icons/:id/disable` | Disable icon |
| `PATCH` | `/api/admin/icons/:id/restore` | Restore soft-deleted icon |
| `POST` | `/api/admin/icons/rollback` | `{ iconId, targetVersion, changeNote? }` |
| `POST` | `/api/admin/icons/bulk` | Bulk upload. `meta` JSON array + `svg_{key}` / `png_{key}` files. Max 100. |
| `GET` | `/api/admin/icons/audit` | Audit log. Query: `iconId?`, `limit` (max 500) |
| `POST` | `/api/admin/icons/cache-invalidate` | Bumps ETag → all Flutter clients re-download on next poll |

---

## Admin Dashboard — Icon Management Page (`/icons`)

Five tabs, accessible to `SUPER_ADMIN` only:

### Tab 1: Icons
- Filter by text search, category dropdown, active/disabled/all, include-deleted toggle
- Per-category stats grid (collapsible) showing total / enabled / with-file counts
- Paginated table (30/page) with columns: preview, key+name, category, type, version, status, last-modified, actions
- **Preview**: live thumbnail from SVG/PNG URL or placeholder if no file uploaded
- **Version badge**: click to expand inline version history with rollback buttons
- **Actions per row**: Edit (inline form with file replace + preview), Enable/Disable toggle, Delete
- **Edit form**: replace SVG/PNG with live preview of current vs new file
- **Cache invalidate** button (confirms before executing)

### Tab 2: Add Icon
- Form: key, display name, category, type, SVG file, PNG file, change note
- Live preview of uploaded files before saving

### Tab 3: Bulk Upload
- Dynamic row builder — add up to 100 rows, each with key/name/category/type/SVG/PNG
- Single submit uploads all at once, skipping existing keys

### Tab 4: Default Icons
- Shows all icons without an uploaded file (using bundled Flutter fallback)
- Seed button to create DB records for all 90+ defined keys at once
- Quick links to upload individual icons

### Tab 5: Audit Log
- Full history table: time, action badge, admin name+email, icon key+name, expandable metadata JSON
- Click any row to expand the full metadata payload
- Color-coded action badges: green=create/enable, gold=update/rollback, red=delete/disable/cache-clear, blue=restore/bulk

---

## Flutter Integration

### 1. Setup — `pubspec.yaml`
```yaml
dependencies:
  http: ^1.2.1
  flutter_svg: ^2.0.10+1
  path: ^1.9.0
  path_provider: ^2.1.3

flutter:
  assets:
    - assets/icons/fallback/    # bundled fallback SVGs
```

### 2. App Bootstrap — `main.dart`
```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final iconProvider = IconProvider();
  await iconProvider.initialize();   // loads disk cache, starts bg fetch

  runApp(
    IconProviderScope(
      provider: iconProvider,
      child: const AppRoot(),
    ),
  );
}
```

### 3. Use in any widget
```dart
// Simple usage
DynamicIcon(
  iconKey: IconKeys.navHome,
  size:    24,
  color:   Theme.of(context).colorScheme.primary,
)

// With custom fallback
DynamicIcon(
  iconKey:        IconKeys.giftDiamond,
  size:           48,
  fallbackWidget: Icon(Icons.card_giftcard, size: 48),
)
```

### 4. Force refresh (e.g. after admin publishes)
```dart
await IconProviderScope.of(context).refresh();
```

### 5. Configure API base URL (no rebuild needed)
```bash
flutter run --dart-define=ICONS_API_BASE_URL=https://your-domain.com
flutter build apk --dart-define=ICONS_API_BASE_URL=https://your-domain.com
```

---

## Caching Architecture

```
Request: resolveSource("nav.home")
│
├─► Memory cache hit?           → return IconDisplaySource immediately (0ms)
│
├─► Memory miss → check catalog model
│    └─► model.svgHash exists?
│         ├─► Disk file with that hash exists? → return disk path (< 5ms)
│         └─► Download file → save to disk → return disk path
│
├─► No model in catalog → bundled asset ("assets/icons/fallback/nav_home.svg")
│
└─► Bundled asset missing → Material Icon.image_not_supported (never crashes)
```

### ETag flow
```
Flutter              Server
  │──── GET /api/icons ───────────────────────────────────►│
  │◄─── 200 {etag:"abc123", icons:[...]} ──────────────────│
  │  [saves etag to disk, updates memory cache]
  │
  │  [15 minutes later, or on forceRefresh()]
  │──── GET /api/icons (If-None-Match: "abc123") ──────────►│
  │◄─── 304 Not Modified ───────────────────────────────────│
  │  [no re-download, catalog unchanged]
  │
  │  [admin uploads new icon / cache-invalidate]
  │──── GET /api/icons (If-None-Match: "abc123") ──────────►│
  │◄─── 200 {etag:"def456", icons:[...]} ──────────────────│
  │  [new etag, updates disk + memory, pre-warms new files]
```

---

## Storage Configuration

Set `STORAGE_PROVIDER` in `.env`:

| Value | Description | Required env vars |
|-------|-------------|-------------------|
| `local` (default) | Writes to `public/icons/`, served by Next.js | `NEXT_PUBLIC_BASE_URL` |
| `s3` | AWS S3 + CloudFront CDN | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `CLOUDFRONT_BASE_URL` |
| `cloudinary` | Cloudinary media hosting | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |

### Upload constraints
- **SVG**: max 512 KB, MIME detected from magic bytes (not file extension)
- **PNG**: max 1 MB
- SVG content is sanitized: strips `<script>`, event handlers (`onclick`, `onload`, etc.), `javascript:` URIs, external `<use>` references
- Filenames are sanitized to `[a-z0-9_-]` + timestamp, path traversal is blocked

---

## Security

- All `/api/admin/*` endpoints require `SUPER_ADMIN` session (JWT cookie, verified server-side)
- Upload validation: magic-byte MIME detection, size limits, SVG sanitization
- Filename sanitization prevents path traversal at both the API and storage layer
- IP address and User-Agent logged in every audit entry
- Optional S3 ACL configuration — defaults to private (serve via CloudFront)
- CSP header on `/icons/:path*` prevents SVG script execution

---

## Operational Runbook

### Initial database setup
```bash
# Apply schema to database
npx prisma db push

# Seed all 90+ icon definitions (idempotent)
npm run db:seed-icons
```

### Adding a new icon
1. Add entry to `src/lib/icon-groups.ts` (`ICON_DEFINITIONS` array)
2. Add constant to `flutter/lib/features/icons/core/icon_keys.dart`
3. Place bundled fallback SVG at `flutter/assets/icons/fallback/<key_with_underscores>.svg`
4. Run `npm run db:seed-icons` to create the DB record
5. Upload the production file via Admin Dashboard → Add Icon tab

### Rolling back an icon
Admin Dashboard → Icons tab → click version badge (vN) → click "استرجاع" next to target version

### Forcing all Flutter clients to re-download
Admin Dashboard → Icons tab → "مسح الكاش وإعادة النشر" button
(Or: `POST /api/admin/icons/cache-invalidate`)

### Disabling an icon (hides from Flutter, shows bundled fallback)
Admin Dashboard → Icons tab → "تعطيل" button on the icon row

---

## Verification Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Upload SVG | `POST /api/admin/icons` with `svg` file | ✓ |
| Upload PNG | `POST /api/admin/icons` with `png` file | ✓ |
| Replace existing | `PUT /api/admin/icons/:id` with new file | ✓ |
| Preview before save | Live preview in Create/Edit forms (FileReader API) | ✓ |
| Search icons | `?q=` filter on admin list endpoint + UI filter bar | ✓ |
| Group by feature | Category filter dropdown, category stats grid | ✓ |
| Delete icons | `DELETE /api/admin/icons/:id` (soft delete, reversible) | ✓ |
| Restore default | "Defaults" tab shows missing uploads, seed button | ✓ |
| Enable/Disable | `PATCH /enable` / `PATCH /disable` + UI toggle | ✓ |
| Version history | Inline expandable panel per icon row | ✓ |
| Rollback | `POST /api/admin/icons/rollback` + UI button per version | ✓ |
| Last modified time | `updatedAt` column in table | ✓ |
| Modified by admin | `updatedBy` stored, shown in version history | ✓ |
| Audit log | `IconAuditLog` model + audit tab with full metadata | ✓ |
| Bulk upload | `POST /api/admin/icons/bulk` + Bulk Upload tab (100 max) | ✓ |
| Bulk replace | Bulk endpoint skips existing keys (update via PUT per key) | ✓ |
| Cache invalidation | `POST /cache-invalidate` bumps ETag + UI button | ✓ |
| Flutter loads at startup | `IconProvider.initialize()` in `main()` before `runApp` | ✓ |
| Auto refresh | 15-min `Timer.periodic` in `IconService` | ✓ |
| Offline fallback | disk cache → bundled asset → Material icon (never null) | ✓ |
| No UI flickering | Sync memory hit on first frame, async only on cold start | ✓ |
| No app update needed | `--dart-define=ICONS_API_BASE_URL` + remote catalog | ✓ |
| No crashes | 5-level fallback chain, every error is caught | ✓ |
| SUPER_ADMIN only | Auth guard on all admin routes + dashboard redirect | ✓ |
| TypeScript compiles | `tsc --noEmit` exits 0 | ✓ |
| Next.js builds | `next build` exits 0 | ✓ |
