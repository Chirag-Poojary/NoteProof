import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── Security + MIME headers ───────────────────────────────────────────────
  async headers() {
    return [
      // COEP / COOP removed. Since numThreads=1, we don't need SharedArrayBuffer.
      // Keeping them enabled was causing Android Chrome to block camera permissions
      // when served through localtunnel.
      // ── Explicit MIME type for WASM worker .mjs files ──────────────────
      // Browsers reject dynamically imported modules without a JavaScript
      // MIME type. Next.js static file serving defaults to text/plain for
      // unknown extensions; this forces application/javascript for .mjs.
      {
        source: "/ort-wasm/:file*.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ];
  },

  // ── Development Server Options ───────────────────────────────────────────
  // Next.js 15/16 blocks cross-origin dev resources by default. We allow
  // wildcard subdomains for localtunnel and ngrok.
  allowedDevOrigins: [
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],

  // ── Turbopack (Next.js 16 default bundler) ────────────────────────────────
  turbopack: {},
};

export default nextConfig;
