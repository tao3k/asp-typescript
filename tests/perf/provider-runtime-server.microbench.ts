import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { executeProviderOperation } from "../../src/cli/provider-runtime.js";
import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
} from "../../src/cli/semantic-language.js";

const DIGEST = `blake3-256:${"0".repeat(64)}`;
test("resident TypeScript provider projection live corpus p99 is below 1ms", async () => {
  const payload = {
    schemaId: "agent.semantic-protocols.provider-language-projection-batch-request",
    schemaVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    workspaceIdentity: "live-corpus-typescript",
    generationRootDigest: DIGEST,
    parserIdentityDigest: DIGEST,
    queryPackDigest: DIGEST,
    owners: [
      {
        ownerPath: "src/service.ts",
        sourceLeafDigest: DIGEST,
        sourceEncoding: "utf8",
        sourceText: "export interface Service { run(): void }\n",
      },
    ],
  };
  const invoke = (): void => {
    const response = executeProviderOperation("projection-batch", payload, process.cwd()) as {
      readonly schemaId: string;
    };
    assert.equal(
      response.schemaId,
      "agent.semantic-protocols.provider-language-projection-batch-response",
    );
  };

  const operationsPerSample = 32;
  for (let index = 0; index < operationsPerSample * 4; index += 1) invoke();
  const samplesMicros: number[] = [];
  for (let index = 0; index < 128; index += 1) {
    const started = performance.now();
    for (let operation = 0; operation < operationsPerSample; operation += 1) invoke();
    samplesMicros.push(((performance.now() - started) * 1_000) / operationsPerSample);
  }
  samplesMicros.sort((left, right) => left - right);
  const percentile = (fraction: number): number =>
    samplesMicros[Math.ceil(samplesMicros.length * fraction) - 1]!;
  const receipt = {
    sampleCount: samplesMicros.length,
    operationsPerSample,
    p50Micros: percentile(0.5),
    p95Micros: percentile(0.95),
    p99Micros: percentile(0.99),
    maxMicros: samplesMicros.at(-1)!,
  };
  process.stdout.write(`typescript-provider-live-corpus ${JSON.stringify(receipt)}\n`);
  assert.ok(receipt.p99Micros < 1_000, `provider p99 ${receipt.p99Micros}µs exceeds 1ms`);
});
