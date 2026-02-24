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
          // Restrict framing to World App only (overrides any X-Frame-Options header)
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://worldcoin.org https://*.worldcoin.org",
          },
        ],
      },
    ]
  },
}

export default nextConfig
