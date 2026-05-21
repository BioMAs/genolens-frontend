import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  // Only initialise when DSN is provided
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Don't send PII
  sendDefaultPii: false,
  // Ignore common noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    /ChunkLoadError/,
  ],
});
