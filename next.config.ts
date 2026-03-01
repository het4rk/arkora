import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's3.hippius.com' },
      { protocol: 'https', hostname: 'worldcoin.org' },
      { protocol: 'https', hostname: '*.worldcoin.org' },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  // Required for MiniKit - allows World App to frame the app.
  // Note: CSP frame-ancestors supersedes X-Frame-Options in all modern browsers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS for 2 years; include subdomains and preload list
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Comprehensive CSP - restrict framing to World App, block inline scripts/eval
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",  // unsafe-inline required by Next.js; unsafe-eval removed for XSS hardening
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind + Google Fonts CSS
              "img-src 'self' data: blob: https:",                 // Allow images from HTTPS origins
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://*.worldcoin.org https://*.world.org https://*.alchemy.com",
              "frame-ancestors 'self' https://worldcoin.org https://*.worldcoin.org https://world.org https://*.world.org",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // Isolate browsing context from cross-origin popups (prevents window handle leaks)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Block cross-domain policy files (Flash/Acrobat, defense in depth)
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "arkora",

  project: "arkora",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
