import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Explicitly declare turbopack config to avoid the "webpack config with no turbopack config" error
  // thrown when withSentryConfig injects its webpack plugin under Next.js 16 (Turbopack by default).
  turbopack: {},
};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress source map upload warnings in CI if token not set
  silent: !process.env.CI,
  // Disable source map upload if no auth token (local dev / CI without token)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
