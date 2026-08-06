/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  // Optional storage provider SDKs — loaded at runtime only when configured
  serverExternalPackages: ["@aws-sdk/client-s3", "cloudinary"],

  webpack(config, { isServer }) {
    if (isServer) {
      const optionalPeers = ["@aws-sdk/client-s3", "cloudinary"];
      for (const pkg of optionalPeers) {
        config.resolve ??= {};
        config.resolve.alias ??= {};
        try {
          require.resolve(pkg);
        } catch {
          config.resolve.alias[pkg] = false;
        }
      }
    }
    return config;
  },

  async headers() {
    return [
      // ── Icon files CDN (immutable) ─────────────────────────────────────
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control",           value: "public, max-age=31536000, immutable" },
          // Restrict SVG execution — defence-in-depth on top of server sanitization
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
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
