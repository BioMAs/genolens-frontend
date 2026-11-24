import * as Sentry from "@sentry/nextjs";
import { scrubTokens } from "./src/utils/sentryScrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  // The token of an e-mailed link is a credential until it is used, and the pageload
  // transaction has recorded `location.href` before the page strips it from the bar.
  beforeSend: scrubTokens,
  beforeSendTransaction: scrubTokens,
  beforeBreadcrumb: scrubTokens,
});
