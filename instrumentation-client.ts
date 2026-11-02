import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

// NEXT_PUBLIC_* se incrustan en el build: sin DSN en el build, el cliente no envia nada.
Sentry.init(
  sentryOptions(
    process.env.NEXT_PUBLIC_SENTRY_DSN,
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
