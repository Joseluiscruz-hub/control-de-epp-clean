import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const script = resolve(".github/scripts/create-cloud-run-config.mjs");

function run(extra: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "cr-config-"));
  execFileSync(process.execPath, [script], {
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? "",
      PROJECT_ID: "p", FIREBASE_PROJECT_ID: "p", FIREBASE_DATABASE_ID: "(default)",
      DEPLOYMENT_ENVIRONMENT: "staging", EXPECTED_DEPLOYMENT_ENVIRONMENT: "staging",
      FIREBASE_APP_CHECK_REQUIRED: "false", FIREBASE_API_KEY: "k", FIREBASE_AUTH_DOMAIN: "d",
      FIREBASE_STORAGE_BUCKET: "b", FIREBASE_MESSAGING_SENDER_ID: "1", FIREBASE_APP_ID: "a",
      DEPLOYMENT_TEMP_DIR: dir,
      ...extra,
    },
    stdio: "pipe",
  });
  return {
    build: readFileSync(join(dir, "build-env-vars.yaml"), "utf8"),
    runtime: readFileSync(join(dir, "runtime-env-vars.yaml"), "utf8"),
  };
}

describe("config de Cloud Run: Sentry", () => {
  it("reenvia SENTRY_TRACES_SAMPLE_RATE al build del cliente y al runtime", () => {
    const { build, runtime } = run({ SENTRY_DSN: "https://k@o1.ingest.sentry.io/1", SENTRY_TRACES_SAMPLE_RATE: "0" });
    assert.match(build, /^NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0'$/m);
    assert.match(runtime, /^SENTRY_TRACES_SAMPLE_RATE: '0'$/m);
    assert.match(build, /^NEXT_PUBLIC_SENTRY_DSN: /m);
    assert.match(build, /^NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'staging'$/m);
  });
  it("sin DSN no agrega variables de Sentry", () => {
    const { build, runtime } = run({});
    assert.doesNotMatch(build + runtime, /SENTRY/);
  });
});
