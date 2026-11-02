/**
 * Depuracion de datos personales antes de enviar eventos a Sentry.
 * Quita nombres de colaboradores, PINs, codigos de activacion, tokens y cookies.
 * Funciona en servidor, edge y navegador (sin dependencias).
 */
export const REDACTED = "[Filtrado]";

const SENSITIVE_KEY_SOURCE =
  "pin|password|passwd|secret|token|authorization|cookie|activation|codigo|employeename|fullname|displayname|username|firstname|lastname|nombre|apellido|email|correo|phone|telefono|curp|rfc|nss|uid|userid";

const SENSITIVE_KEY = new RegExp(`(${SENSITIVE_KEY_SOURCE})`, "i");

/** Pares llave:valor o llave=valor con llave sensible dentro de texto libre (JSON, query, logs). */
const SENSITIVE_PAIR = new RegExp(
  `(["']?[\\w.-]*(?:${SENSITIVE_KEY_SOURCE})[\\w.-]*["']?\\s*[:=]\\s*)("(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^\\s,;&}\\]]+)`,
  "gi",
);
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** PINs (6 digitos) y codigos de activacion (8 digitos) sueltos dentro de texto. */
const DIGIT_RUN = /\b\d{6,8}\b/g;

function maskText(value: string): string {
  return value
    .replace(EMAIL, REDACTED)
    .replace(SENSITIVE_PAIR, (_m, key: string, val: string) => `${key}${val.startsWith('"') ? `"${REDACTED}"` : REDACTED}`)
    .replace(DIGIT_RUN, REDACTED);
}

/** Si el texto contiene JSON (completo o despues de un prefijo, p. ej. "Firestore Error: {...}"), lo depura estructuralmente. */
function scrubEmbeddedJson(value: string, depth: number): string | null {
  const start = value.search(/[{[]/);
  if (start < 0) return null;
  const candidate = value.slice(start).trim();
  if (!/[}\]]$/.test(candidate)) return null;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object") return null;
    return maskText(value.slice(0, start)) + JSON.stringify(scrubValue(parsed, depth + 1));
  } catch {
    return null;
  }
}

export function scrubText(value: string, depth = 0): string {
  return scrubEmbeddedJson(value, depth) ?? maskText(value);
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return scrubText(value, depth);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

type ScrubbableEvent = {
  user?: unknown;
  message?: string;
  request?: { data?: unknown; cookies?: unknown; headers?: Record<string, string>; query_string?: unknown; url?: string };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
};

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.user;
  if (event.message) event.message = scrubText(event.message);
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) event.request.headers = scrubValue(event.request.headers) as Record<string, string>;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as Record<string, unknown>;
  if (event.tags) event.tags = scrubValue(event.tags) as Record<string, unknown>;
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubText(crumb.message);
    if (crumb.data) crumb.data = scrubValue(crumb.data) as Record<string, unknown>;
  }
  return event;
}

/** Muestreo de trazas: 10% por defecto, configurable con SENTRY_TRACES_SAMPLE_RATE (0..1). */
export function resolveTracesSampleRate(raw: string | undefined, fallback = 0.1): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

/** Spans transmitidos (traceLifecycle "stream"): depura atributos y nombre. */
export function scrubSpan<T extends { name?: string; attributes?: Record<string, unknown> }>(span: T): T {
  if (span.name) span.name = scrubText(span.name);
  if (span.attributes) span.attributes = scrubValue(span.attributes) as Record<string, unknown>;
  return span;
}
