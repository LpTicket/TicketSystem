import type { NextConfig } from "next";

// Content-Security-Policy — defense-in-depth against XSS.
// Shipped in REPORT-ONLY mode first: the browser reports violations to the
// console but blocks NOTHING, so we can confirm it doesn't break the app
// (Stripe, Google Fonts, OAuth, images, the API) before enforcing it.
//
// Notes on the chosen sources:
//  - script-src needs 'unsafe-inline' + 'unsafe-eval' because Next.js injects
//    inline hydration scripts and (in dev) eval-based React refresh. Tightening
//    this requires per-request nonces, which is a separate, larger change.
//  - connect-src lists the API hosts (Railway/Render) and Stripe.
//  - img-src allows data: (base64 avatars/banners) and any https image.
//  - frame-src allows Stripe (checkout/elements iframes).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://ticketsystembackend.up.railway.app https://ticketsystembackend-102j.onrender.com https://api.stripe.com https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // REPORT-ONLY: does not block anything yet. Flip the header name to
          // 'Content-Security-Policy' (without -Report-Only) to enforce once
          // verified clean.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
