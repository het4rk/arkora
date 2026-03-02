// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3e455c94fc22b1e3a306a522dbf5362e@o4510957485162496.ingest.us.sentry.io/4510957486080000",

  tracesSampleRate: 0.1,
  enableLogs: true,

  // Never send PII - Arkora is an anonymity-first platform
  sendDefaultPii: false,
});
