// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3e455c94fc22b1e3a306a522dbf5362e@o4510957485162496.ingest.us.sentry.io/4510957486080000",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Sample 10% of traces — 100% creates noise and potential data volume issues
  tracesSampleRate: 0.1,

  // Session replay: 5% of sessions, 50% on error
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 0.5,

  // Do not automatically send PII (IP addresses, user IDs) — users are pseudonymous
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
