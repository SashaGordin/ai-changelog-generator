import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['postgres'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
