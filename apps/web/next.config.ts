import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.NEXT_PUBLIC_API_URL) {
  loadEnv({ path: path.resolve(currentDir, "../../.env") });
}

process.env.NEXT_PUBLIC_API_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;

function normalizeApiBaseUrl(value: string | undefined) {
  const fallback = "http://127.0.0.1:3001/api";
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  const collapsedApiSuffix = withoutTrailingSlash.replace(/(?:\/api)+$/, "/api");

  if (collapsedApiSuffix.endsWith("/api")) {
    return collapsedApiSuffix;
  }

  return `${collapsedApiSuffix}/api`;
}
