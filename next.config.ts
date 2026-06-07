import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Cursor SDK is a Node-only package that spawns a local executor; keep it
  // out of the bundler and let it run as a native server dependency.
  serverExternalPackages: ["@cursor/sdk", "better-sqlite3"],
};

export default nextConfig;
