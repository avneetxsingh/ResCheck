import type { NextConfig } from "next";
import path from "path";

// The app loads nothing from a third party: fonts are self-hosted by
// next/font, there are no external scripts, images or stylesheets, and the
// only outbound calls are same-origin to /api/*. That makes a tight policy
// cheap — connect-src can be 'self' alone, and frame-ancestors 'none' stops
// the résumé and the API-key field being framed by anyone.
//
// 'unsafe-inline' is required in two places and cannot currently be dropped:
// next-themes injects an inline script to set the theme before first paint
// (removing it reintroduces a flash of the wrong theme), and Next injects
// inline styles. Nonces would need middleware and a dynamic-rendering
// tradeoff; that is the upgrade path if this ever warrants it.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No feature this app has needs any of these, and a résumé parser asking
  // for the camera would be alarming.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Two years, and only meaningful over HTTPS — harmless on localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
