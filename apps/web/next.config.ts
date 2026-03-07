import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker / self-hosted deployments
  output: "standalone",
  transpilePackages: ["@whale-tracker/ui", "@whale-tracker/shared-types"],
  // Allow TradingView widget scripts
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://*.tradingview.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://*.tradingview.com",
              "frame-src 'self' https://*.tradingview.com",
              "connect-src 'self' https://*.tradingview.com https://*.binance.com ws: wss:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
