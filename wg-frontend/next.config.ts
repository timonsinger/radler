import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bilder vom Backend erlauben
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wg.radler-deutschland.de',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4001',
      },
    ],
  },
};

export default nextConfig;
