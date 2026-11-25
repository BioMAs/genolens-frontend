import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * No page may be framed by another site (clickjacking: a sign-in form or a
 * "revoke this device" button under a decoy page). `frame-ancestors` is the
 * standard; `X-Frame-Options` covers the browsers that ignore it.
 */
const ANTI_FRAMING_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    // `/:path*` also matches `/`. Headers set by the middleware (the e-mailed
    // link pages' Referrer-Policy and Cache-Control) are added on top.
    return [{ source: "/:path*", headers: ANTI_FRAMING_HEADERS }];
  },

  // `turbopack` silences the Next.js 16 error that fires when a webpack
  // plugin (injected by withSentryConfig) is present without a matching
  // turbopack config. Production builds are forced to webpack via the
  // `--webpack` flag in the `build` npm script.
  // resolveAlias mirrors the webpack alias below so react-plotly.js can
  // resolve plotly.js/dist/plotly in Turbopack dev mode.
  turbopack: {
    resolveAlias: {
      "plotly.js/dist/plotly": "plotly.js-dist-min",
    },
  },

  webpack(config) {
    // react-plotly.js@2 does `require("plotly.js/dist/plotly")` at runtime but
    // the project installs plotly.js-dist-min (a lighter standalone bundle)
    // instead of the full plotly.js package. Alias the missing path so webpack
    // can resolve it without needing a second Plotly install.
    config.resolve.alias = {
      ...config.resolve.alias,
      "plotly.js/dist/plotly": require.resolve("plotly.js-dist-min"),
    };
    return config;
  },
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
