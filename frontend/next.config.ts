import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  htmlLimitedBots: /.*/,
  /* config options here */
};

export default nextConfig;
