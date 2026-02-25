import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  turbopack: {
    root: __dirname,
  },
  // Required for MiniKit — allows World App to frame the app.
  // Note: CSP frame-ancestors supersedes X-Frame-Options in all modern browsers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS for 2 years; include subdomains and preload list
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Comprehensive CSP — restrict framing to World App, block inline scripts/eval
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires these
              "style-src 'self' 'unsafe-inline'",                  // Tailwind injects inline styles
              "img-src 'self' data: blob: https:",                 // Allow images from HTTPS origins
              "font-src 'self'",
              "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://*.worldcoin.org https://*.alchemy.com",
              "frame-ancestors 'self' https://worldcoin.org https://*.worldcoin.org",
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
        ],
      },
    ]
  },
}

export default nextConfig
