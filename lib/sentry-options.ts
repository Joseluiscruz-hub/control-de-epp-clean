import type { BrowserOptions } from "@sentry/nextjs";
import { resolveTracesSampleRate, scrubEvent, scrubSpan } from "./sentry-scrub";

/**
 * Coleccion de datos de @sentry/nextjs v11 (reemplaza a sendDefaultPii, que ya no existe).
 * Todo lo que podria contener datos personales queda apagado de forma explicita.
 */
export const SENTRY_DATA_COLLECTION: NonNullable<BrowserOptions["dataCollection"]> = {
  userInfo: false, // user.*, incluida la IP inferida
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

/** Opciones comunes de Sentry. Sin DSN, Sentry queda deshabilitado (no envia nada). */
export function sentryOptions(dsn: string | undefined, environment: string | undefined, rate: string | undefined) {
  const cleanDsn = (dsn ?? "").trim();
  return {
    dsn: cleanDsn || undefined,
    enabled: Boolean(cleanDsn),
    environment: environment || process.env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: resolveTracesSampleRate(rate),
    beforeSend: (event: any) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb: any) => scrubEvent({ breadcrumbs: [breadcrumb] }).breadcrumbs?.[0] ?? null,
    beforeSendSpan: (span: any) => scrubSpan(span),
  };
}
