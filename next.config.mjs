/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  
  // Mark sharp as external for server-side (Next.js 15+ serverExternalPackages syntax)
  serverExternalPackages: ['sharp'],
  
  // رفع حد حجم جسم الطلب في Server Actions إلى 11 MB
  // (أكبر بقليل من الحد المسموح 10 MB لاستيعاب multipart overhead)
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  webpack(config, { isServer }) {
    if (isServer) {
      // ── Native addons that must never be bundled ──────────────────────────
      // sharp is a native addon (C++ binding). Webpack cannot bundle it.
      // Mark it as external so Node requires it at runtime instead of
      // trying to bundle it at build time.
      //
      // Same treatment for optional peer dependencies that may not be installed.
      const nativeExternals = ["sharp"];
      const optionalPeers   = ["@aws-sdk/client-s3", "cloudinary"];

      config.externals = config.externals ?? [];

      // Add native externals (sharp, etc.)
      for (const pkg of nativeExternals) {
        if (Array.isArray(config.externals)) {
          config.externals.push(pkg);
        }
      }

      // Alias optional peers to false (empty module) only when not installed
      config.resolve       ??= {};
      config.resolve.alias ??= {};
      for (const pkg of optionalPeers) {
        try {
          require.resolve(pkg);
        } catch {
          // Not installed — replace with an empty module so the build never fails
          config.resolve.alias[pkg] = false;
        }
      }
    }
    return config;
  },

  async rewrites() {
    // Proxy backend APIs to Express on port 3000.
    // Exclude dashboard-owned routes: /api/icons, /api/assets, /api/admin
    //
    // CRITICAL: `/api/rooms/:path*` does NOT match POST /api/rooms (no extra
    // segment). That left room creation on the Next.js app, which has no
    // handler and never ran Express JWT middleware. Every collection root
    // needs an exact rewrite PLUS a :path* rewrite.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const proxy = (route) => [
      { source: route, destination: `${backendUrl}${route}` },
      { source: `${route}/:path*`, destination: `${backendUrl}${route}/:path*` },
    ];

    return [
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
      ...proxy('/api/auth'),
      ...proxy('/api/users'),
      ...proxy('/api/rooms'),
      ...proxy('/api/banners'),
      ...proxy('/api/gifts'),
      ...proxy('/api/coins'),
      ...proxy('/api/wallet'),
      ...proxy('/api/rankings'),
      ...proxy('/api/vip'),
      ...proxy('/api/shop'),
      ...proxy('/api/rewards'),
      ...proxy('/api/notifications'),
      ...proxy('/api/follow'),
      ...proxy('/api/posts'),
      ...proxy('/api/loyalty'),
      ...proxy('/api/chat'),
      ...proxy('/api/settings'),
      ...proxy('/api/agents'),
      ...proxy('/api/hosts'),
      ...proxy('/api/agent'),
      ...proxy('/api/payment'),
      ...proxy('/api/moderation'),
      ...proxy('/api/recordings'),
      ...proxy('/api/agency-types'),
      ...proxy('/api/financial'),
      ...proxy('/api/hierarchy'),
      ...proxy('/api/recharge'),
    ];
  },

  async headers() {
    return [
      // ── Asset files CDN (immutable) ────────────────────────────────────
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control",           value: "public, max-age=31536000, immutable" },
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
        ],
      },

      // ── Icon files CDN (immutable) ─────────────────────────────────────
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control",           value: "public, max-age=31536000, immutable" },
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
        ],
      },

      // ── Public asset catalog API — Flutter CORS ───────────────────────
      {
        source: "/api/assets",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "If-None-Match, Accept" },
          { key: "Vary",                         value: "Accept-Encoding" },
        ],
      },

      // ── Public icon catalog API — Flutter CORS ─────────────────────────
      {
        source: "/api/icons",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "If-None-Match, Accept" },
          { key: "Vary",                         value: "Accept-Encoding" },
        ],
      },

      // ── Admin API routes — dashboard origin only ───────────────────────
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY"    },
          { key: "Cache-Control",          value: "no-store, no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
