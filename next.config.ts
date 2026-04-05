import type { NextConfig } from "next";

const defaultAllowedOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  "*.github.dev",
  "*.app.github.dev",
];

const envAllowedOrigins = process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS
  ? process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedOrigins,
  experimental: {
    serverActions: {
      allowedOrigins,
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
