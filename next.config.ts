import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  turbopack: {
    root: __dirname,
  },
  // Required for MiniKit — allows World App to frame the app
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
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
