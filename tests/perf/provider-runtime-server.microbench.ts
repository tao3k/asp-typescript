import assert from "node:assert/strict";
import { once } from "node:events";
import { Agent, request } from "node:http";
import { performance } from "node:perf_hooks";
import { PassThrough } from "node:stream";
import test from "node:test";

import { serveProviderRuntime } from "../../src/cli/provider-runtime.js";
import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
} from "../../src/cli/semantic-language.js";

const DIGEST = `blake3-256:${"0".repeat(64)}`;
const RUNTIME_ENV = {
  ASP_PROVIDER_ID: TYPE_SCRIPT_PROVIDER_ID,
  ASP_PROVIDER_LANGUAGE_ID: TYPE_SCRIPT_LANGUAGE_ID,
  ASP_PROVIDER_ARTIFACT_DIGEST: DIGEST,
  ASP_PROVIDER_REGISTRATION_DIGEST: DIGEST,
  ASP_PROVIDER_RUNTIME_CONTRACT_DIGEST: DIGEST,
  ASP_CLIENT_SERVER_HOST: "127.0.0.1:0",
} as const;

test("resident TypeScript provider projection live corpus p99 is below 1ms", async () => {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(RUNTIME_ENV)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }

  const output = new PassThrough();
  let endpoint: string | undefined;
  let serving: Promise<number> | undefined;
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  try {
    const bootstrapChunk = once(output, "data");
    serving = serveProviderRuntime(output, process.cwd());
    const [chunk] = await bootstrapChunk;
    const bootstrap = JSON.parse(Buffer.from(chunk).toString("utf8")) as {
      readonly endpoint: string;
    };
    endpoint = bootstrap.endpoint;

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
    const invoke = async (requestId: string): Promise<void> => {
      const body = JSON.stringify({
        schemaId: "agent.semantic-protocols.provider-runtime-request-frame",
        schemaVersion: "1",
        requestId,
        operation: "projection-batch",
        payload,
      });
      const frame = await new Promise<{ readonly outcome: string }>((resolve, reject) => {
        const outgoing = request(
          new URL("/v1/provider-runtime", endpoint),
          {
            agent,
            method: "POST",
            headers: {
              "content-length": Buffer.byteLength(body),
              "content-type": "application/json",
            },
          },
          (incoming) => {
            const chunks: Buffer[] = [];
            incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
            incoming.on("end", () => {
              try {
                assert.equal(incoming.statusCode, 200);
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
              } catch (error) {
                reject(error);
              }
            });
          },
        );
        outgoing.on("error", reject);
        outgoing.end(body);
      });
      assert.equal(frame.outcome, "ready");
    };

    for (let index = 0; index < 32; index += 1) await invoke(`warm-${index}`);
    const samplesMicros: number[] = [];
    for (let index = 0; index < 128; index += 1) {
      const started = performance.now();
      await invoke(`sample-${index}`);
      samplesMicros.push((performance.now() - started) * 1_000);
    }
    samplesMicros.sort((left, right) => left - right);
    const percentile = (fraction: number): number =>
      samplesMicros[Math.ceil(samplesMicros.length * fraction) - 1]!;
    const receipt = {
      sampleCount: samplesMicros.length,
      p50Micros: percentile(0.5),
      p95Micros: percentile(0.95),
      p99Micros: percentile(0.99),
      maxMicros: samplesMicros.at(-1)!,
    };
    process.stdout.write(`typescript-provider-live-corpus ${JSON.stringify(receipt)}\n`);
    assert.ok(receipt.p99Micros < 1_000, `provider p99 ${receipt.p99Micros}µs exceeds 1ms`);
  } finally {
    agent.destroy();
    if (endpoint !== undefined) {
      await fetch(new URL("/shutdown", endpoint), { method: "POST" }).catch(() => undefined);
    }
    if (serving !== undefined) await serving;
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
