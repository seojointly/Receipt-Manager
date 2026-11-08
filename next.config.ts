import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.0.16',
    '*.trycloudflare.com',
  ],
};

export default nextConfig;
