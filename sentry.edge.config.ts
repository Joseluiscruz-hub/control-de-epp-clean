import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

Sentry.init(sentryOptions(process.env.SENTRY_DSN, process.env.SENTRY_ENVIRONMENT, process.env.SENTRY_TRACES_SAMPLE_RATE));
