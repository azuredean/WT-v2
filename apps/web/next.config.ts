import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@whale-tracker/ui", "@whale-tracker/shared-types"],
};

export default nextConfig;
