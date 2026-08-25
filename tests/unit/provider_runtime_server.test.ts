import assert from "node:assert/strict";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import { serveProviderRuntime } from "../../src/cli/provider-runtime.js";
import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
} from "../../src/cli/semantic-language.js";

const REQUIRED_ENV = {
  ASP_PROVIDER_ID: "asp-typescript",
  ASP_PROVIDER_LANGUAGE_ID: "typescript",
  ASP_PROVIDER_ARTIFACT_DIGEST: "sha256:test-artifact",
  ASP_PROVIDER_REGISTRATION_DIGEST: "sha256:test-registration",
  ASP_PROVIDER_RUNTIME_CONTRACT_DIGEST: "sha256:test-contract",
  ASP_CLIENT_SERVER_HOST: "127.0.0.1:0",
} as const;

test("serve exposes the declared HTTP JSON lifecycle", async () => {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(REQUIRED_ENV)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }

  const output = new PassThrough();
  const bootstrapChunk = once(output, "data");
  const serving = serveProviderRuntime(output, process.cwd());
  let endpoint: string | undefined;
  try {
    const [chunk] = await bootstrapChunk;
    const bootstrap = JSON.parse(Buffer.from(chunk).toString("utf8"));
    assert.equal(bootstrap.schemaId, "agent.semantic-protocols.asp-client-server-bootstrap");
    assert.equal(bootstrap.providerId, TYPE_SCRIPT_PROVIDER_ID);
    assert.equal(bootstrap.languageId, TYPE_SCRIPT_LANGUAGE_ID);
    assert.equal(bootstrap.transport, "http-json");
    assert.equal(bootstrap.state, "ready");
    const serverEndpoint = String(bootstrap.endpoint);
    endpoint = serverEndpoint;

    const health = await fetch(new URL("/health", serverEndpoint));
    assert.equal(health.status, 200);
    const receipt = (await health.json()) as Record<string, unknown>;
    assert.equal(receipt.providerId, TYPE_SCRIPT_PROVIDER_ID);
    assert.equal(receipt.languageId, TYPE_SCRIPT_LANGUAGE_ID);
    assert.equal(receipt.transport, "http-json");
    assert.deepEqual(
      (receipt.operations as Array<{ operation: string }>).map(({ operation }) => operation),
      ["projection-batch", "project-resolution", "query"],
    );

    const projectionPayload = {
      schemaId: "agent.semantic-protocols.provider-language-projection-batch-request",
      schemaVersion: "1",
      languageId: TYPE_SCRIPT_LANGUAGE_ID,
      providerId: TYPE_SCRIPT_PROVIDER_ID,
      workspaceIdentity: "workspace-test",
      generationRootDigest: "blake3-256:generation",
      parserIdentityDigest: "blake3-256:parser",
      queryPackDigest: "blake3-256:query-pack",
      owners: [
        {
          ownerPath: "src/service.ts",
          sourceLeafDigest: "blake3-256:source",
          sourceEncoding: "utf8",
          sourceText: "export interface Service { run(): void }\n",
        },
      ],
    };
    const runtimeResponse = await fetch(new URL("/v1/provider-runtime", serverEndpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaId: "agent.semantic-protocols.provider-runtime-request-frame",
        schemaVersion: "1",
        requestId: "projection-1",
        operation: "projection-batch",
        payload: projectionPayload,
      }),
    });
    assert.equal(runtimeResponse.status, 200);
    const runtimeFrame = (await runtimeResponse.json()) as Record<string, unknown>;
    assert.equal(runtimeFrame.requestId, "projection-1");
    assert.equal(runtimeFrame.outcome, "ready");
    assert.equal(
      (runtimeFrame.payload as Record<string, unknown>).schemaId,
      "agent.semantic-protocols.provider-language-projection-batch-response",
    );

    const source = Buffer.from("export function run(value: number): number { return value; }\n");
    const exactResponse = await fetch(new URL("/v1/provider-runtime", serverEndpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaId: "agent.semantic-protocols.provider-runtime-request-frame",
        schemaVersion: "1",
        requestId: "query-1",
        operation: "query",
        payload: {
          schemaId: "agent.semantic-protocols.provider-native-exact-request",
          schemaVersion: "1",
          languageId: TYPE_SCRIPT_LANGUAGE_ID,
          providerId: TYPE_SCRIPT_PROVIDER_ID,
          structuralSelector: "typescript://src/service.ts#item/function/run",
          ownerPath: "src/service.ts",
          projectionKind: "source",
          generationIdentityDigest: "a".repeat(64),
          parserIdentityDigest: "b".repeat(64),
          queryPackDigest: "c".repeat(64),
          sourceDigest: "d".repeat(64),
          sourceByteLength: source.length,
          sourceEncoding: "base64",
          sourceBytesBase64: source.toString("base64"),
          transport: "stdin-json",
        },
      }),
    });
    const exactFrame = (await exactResponse.json()) as Record<string, unknown>;
    assert.equal(exactFrame.outcome, "ready");
    assert.match(
      String((exactFrame.payload as Record<string, unknown>).projectionText),
      /export function run/u,
    );

    const largeRequest = JSON.stringify({
      schemaId: "agent.semantic-protocols.provider-runtime-request-frame",
      schemaVersion: "1",
      requestId: "stream-1",
      operation: "projection-batch",
      payload: {
        ...projectionPayload,
        owners: [
          {
            ...projectionPayload.owners[0],
            sourceText: `//${"x".repeat(900 * 1024)}\nexport interface Service { run(): void }\n`,
          },
        ],
      },
    });
    const chunks = Array.from(
      { length: Math.ceil(largeRequest.length / (128 * 1024)) },
      (_, index) => largeRequest.slice(index * 128 * 1024, (index + 1) * 128 * 1024),
    );
    for (const [frameIndex, requestChunk] of chunks.entries()) {
      const streamed = await fetch(new URL("/v1/provider-runtime-stream", serverEndpoint), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaId: "agent.semantic-protocols.provider-runtime-request-stream-frame",
          schemaVersion: "1",
          streamId: "stream-1",
          frameIndex,
          frameCount: chunks.length,
          requestChunk,
        }),
      });
      const streamedFrame = (await streamed.json()) as Record<string, unknown>;
      assert.equal(
        streamedFrame[frameIndex + 1 === chunks.length ? "outcome" : "state"],
        frameIndex + 1 === chunks.length ? "ready" : "accepted",
      );
    }

    const concurrent = await Promise.all(
      Array.from({ length: 32 }, async (_, index) => {
        const response = await fetch(new URL("/v1/provider-runtime", serverEndpoint), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schemaId: "agent.semantic-protocols.provider-runtime-request-frame",
            schemaVersion: "1",
            requestId: `parallel-${index}`,
            operation: "projection-batch",
            payload: projectionPayload,
          }),
        });
        return (await response.json()) as Record<string, unknown>;
      }),
    );
    assert.ok(concurrent.every((frame) => frame.outcome === "ready"));

    const rejectedResponse = await fetch(new URL("/v1/provider-runtime", serverEndpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaId: "agent.semantic-protocols.provider-runtime-request-frame",
        schemaVersion: "1",
        requestId: "unknown-1",
        operation: "legacy-operation",
        payload: {},
      }),
    });
    const rejectedFrame = (await rejectedResponse.json()) as Record<string, unknown>;
    assert.equal(rejectedFrame.requestId, "unknown-1");
    assert.equal(rejectedFrame.outcome, "error");
    assert.match(String(rejectedFrame.error), /operation is not admitted/u);

    const shutdown = await fetch(new URL("/shutdown", serverEndpoint), { method: "POST" });
    assert.equal(shutdown.status, 200);
    assert.deepEqual(await shutdown.json(), { state: "draining" });
    assert.equal(await serving, 0);
  } finally {
    if (endpoint) {
      await fetch(new URL("shutdown", endpoint), { method: "POST" }).catch(() => undefined);
    }
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
