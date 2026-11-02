import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REDACTED, resolveTracesSampleRate, scrubEvent, scrubSpan, scrubText } from "./sentry-scrub";
import { SENTRY_DATA_COLLECTION, sentryOptions } from "./sentry-options";

describe("depuracion de PII para Sentry", () => {
  it("quita usuario, cookies, cuerpo y query de la solicitud", () => {
    const e = scrubEvent({
      user: { id: "1001", username: "Juan Perez" },
      request: { url: "https://x/api/kiosk/pin/verify?pin=123456", data: { pin: "123456" }, cookies: { s: "abc" }, query_string: "pin=123456", headers: { cookie: "s=abc", authorization: "Bearer t", "user-agent": "ua" } },
    });
    assert.equal(e.user, undefined);
    assert.equal(e.request?.data, undefined);
    assert.equal(e.request?.cookies, undefined);
    assert.equal(e.request?.query_string, undefined);
    assert.equal(e.request?.url, "https://x/api/kiosk/pin/verify");
    assert.equal(e.request?.headers?.cookie, REDACTED);
    assert.equal(e.request?.headers?.authorization, REDACTED);
    assert.equal(e.request?.headers?.["user-agent"], "ua");
  });

  it("filtra nombres de colaborador, PINs y codigos en extra, contextos y breadcrumbs", () => {
    const e = scrubEvent({
      extra: { employeeName: "Juan Perez", pin: "123456", activationCode: "12345678", nested: { nombre: "Ana", plantaId: "sur" } },
      breadcrumbs: [{ message: "PIN 654321 rechazado", data: { employeeName: "Ana", status: 401 } }],
      exception: { values: [{ value: "PIN invalido 112233" }] },
      message: "codigo 87654321",
    });
    assert.deepEqual(e.extra, { employeeName: REDACTED, pin: REDACTED, activationCode: REDACTED, nested: { nombre: REDACTED, plantaId: "sur" } });
    assert.equal(e.breadcrumbs?.[0].message, `PIN ${REDACTED} rechazado`);
    assert.deepEqual(e.breadcrumbs?.[0].data, { employeeName: REDACTED, status: 401 });
    assert.equal(e.exception?.values?.[0].value, `PIN invalido ${REDACTED}`);
    assert.equal(e.message, `codigo ${REDACTED}`);
  });
});

describe("contextos tecnicos", () => {
  it("conserva os/runtime name (no son PII)", () => {
    const e = scrubEvent({ contexts: { os: { name: "Linux" }, runtime: { name: "node" } } });
    assert.deepEqual(e.contexts, { os: { name: "Linux" }, runtime: { name: "node" } });
  });
});

describe("opciones de Sentry", () => {
  it("sin DSN queda deshabilitado (el build y la app funcionan igual)", () => {
    const o = sentryOptions(undefined, undefined, undefined);
    assert.equal(o.enabled, false);
    assert.equal(o.dsn, undefined);
    assert.equal(sentryOptions("  ", "staging", undefined).enabled, false);
  });
  it("con DSN se habilita sin PII por defecto", () => {
    const o = sentryOptions("https://k@o1.ingest.sentry.io/1", "staging", undefined);
    assert.equal(o.enabled, true);
    assert.equal("sendDefaultPii" in o, false);
    assert.equal(o.dataCollection, SENTRY_DATA_COLLECTION);
    assert.equal(o.environment, "staging");
  });
  it("tracesSampleRate: 0.1 por defecto y valida el rango", () => {
    assert.equal(resolveTracesSampleRate(undefined), 0.1);
    assert.equal(resolveTracesSampleRate("0.25"), 0.25);
    assert.equal(resolveTracesSampleRate("2"), 0.1);
    assert.equal(resolveTracesSampleRate("abc"), 0.1);
    assert.equal(resolveTracesSampleRate("0"), 0);
  });
});

describe("dataCollection v11 (seguimiento Codex #73)", () => {
  it("apaga usuario/IP, cookies, headers, cuerpos, query y GenAI", () => {
    assert.deepEqual(SENTRY_DATA_COLLECTION, {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
  });
});

describe("PII dentro de texto serializado (seguimiento Codex #73)", () => {
  const firestoreLog = 'Firestore Error:  {"error":"Missing permissions","authInfo":{"userId":"aB3xYz9QkLm2","email":"usuario.demo@example.com","emailVerified":true},"operationType":"get","path":"employees/1001"}';

  it("depura el JSON embebido de handleFirestoreError en breadcrumbs", () => {
    const e = scrubEvent({ breadcrumbs: [{ message: firestoreLog, data: { arguments: [firestoreLog] } }] });
    for (const text of [e.breadcrumbs?.[0].message ?? "", JSON.stringify(e.breadcrumbs?.[0].data)]) {
      assert.doesNotMatch(text, /ana\.lopez|aB3xYz9QkLm2/);
    }
    const parsed = JSON.parse((e.breadcrumbs?.[0].message ?? "").replace(/^Firestore Error:\s*/, ""));
    assert.equal(parsed.authInfo.email, REDACTED);
    assert.equal(parsed.authInfo.userId, REDACTED);
    assert.equal(parsed.operationType, "get");
  });

  it("depura strings JSON en extra de forma recursiva", () => {
    const e = scrubEvent({ extra: { payload: JSON.stringify({ nombre: "Ana", plantaId: "sur", items: [{ uid: "x1" }] }) } });
    assert.deepEqual(JSON.parse(e.extra?.payload as string), { nombre: REDACTED, plantaId: "sur", items: [{ uid: REDACTED }] });
  });

  it("enmascara correos, pares llave:valor sensibles y secuencias de digitos en texto libre", () => {
    const out = scrubText("fallo para ana@x.com nombre=Ana pin: 123456 employeeName='Juan' email:\"j@x.mx\" planta=sur codigo 87654321");
    assert.doesNotMatch(out, /ana@x\.com|=Ana|123456|Juan|j@x\.mx|87654321/);
    assert.match(out, /planta=sur/);
  });

  it("texto no JSON con llaves no truena", () => {
    assert.equal(scrubText("objeto {incompleto"), "objeto {incompleto");
  });

  it("depura atributos de spans transmitidos", () => {
    const span = scrubSpan({ name: "GET /api/kiosk 123456", attributes: { "user.email": "a@b.co", "http.route": "/api/kiosk" } });
    assert.equal(span.attributes?.["user.email"], REDACTED);
    assert.equal(span.attributes?.["http.route"], "/api/kiosk");
    assert.equal(span.name, `GET /api/kiosk ${REDACTED}`);
  });
});
