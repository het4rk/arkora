// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3e455c94fc22b1e3a306a522dbf5362e@o4510957485162496.ingest.us.sentry.io/4510957486080000",

  tracesSampleRate: 0.1,
  enableLogs: true,

  // Never send PII - Arkora is an anonymity-first platform
  sendDefaultPii: false,
});
