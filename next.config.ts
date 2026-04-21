import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // `turbopack: {}` silences the Next.js 16 error that fires when a webpack
  // plugin (injected by withSentryConfig) is present without a matching
  // turbopack config. Production builds are forced to webpack via the
  // `--webpack` flag in the `build` npm script; this declaration has no effect
  // on those builds.
  turbopack: {},

  webpack(config) {
    // react-plotly.js@2 does `require("plotly.js/dist/plotly")` at runtime but
    // the project installs plotly.js-dist-min (a lighter standalone bundle)
    // instead of the full plotly.js package. Alias the missing path so webpack
    // can resolve it without needing a second Plotly install.
    config.resolve.alias = {
      ...config.resolve.alias,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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
