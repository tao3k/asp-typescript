import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Writable } from "node:stream";

import { projectProjectionBatch } from "./projection-batch.js";
import { projectExactRequest } from "./exact-projection.js";
import { resolveProjectResolutionRequest } from "../parser/project-resolution.js";
import {
  TYPE_SCRIPT_PROVIDER_REGISTRATION,
  TYPE_SCRIPT_PROVIDER_RUNTIME_CONTRACT,
} from "./provider-descriptor.js";

const REQUEST_SCHEMA_ID = "agent.semantic-protocols.provider-runtime-request-frame";
const RESPONSE_SCHEMA_ID = "agent.semantic-protocols.provider-runtime-response-frame";
const RECEIPT_SCHEMA_ID = "agent.semantic-protocols.provider-runtime-contract-receipt";
const MAX_REQUEST_BYTES = 896 * 1024;
const MAX_STREAM_FRAMES = 1024;
const MAX_STREAMS = 64;
const OPERATIONS = TYPE_SCRIPT_PROVIDER_RUNTIME_CONTRACT.operations;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`resident TypeScript provider omitted ${name}`);
  }
  return value;
}

function runtimeContractReceipt(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schemaId: RECEIPT_SCHEMA_ID,
    schemaVersion: "1",
    providerId: TYPE_SCRIPT_PROVIDER_REGISTRATION.providerId,
    languageId: TYPE_SCRIPT_PROVIDER_REGISTRATION.languageId,
    artifactDigest: requiredEnv("ASP_PROVIDER_ARTIFACT_DIGEST"),
    registrationDigest: requiredEnv("ASP_PROVIDER_REGISTRATION_DIGEST"),
    contractDigest: requiredEnv("ASP_PROVIDER_RUNTIME_CONTRACT_DIGEST"),
    transport: TYPE_SCRIPT_PROVIDER_RUNTIME_CONTRACT.transport,
    operations: OPERATIONS,
  });
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(body.length),
  });
  response.end(body);
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_REQUEST_BYTES) {
      throw new Error(`provider runtime request exceeds ${MAX_REQUEST_BYTES} bytes`);
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length);
}

function parseListenAddress(value: string): { host: string; port: number } {
  const parsed = new URL(`http://${value}`);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`ASP_CLIENT_SERVER_HOST must be host:port, got ${value}`);
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  const port = Number(parsed.port);
  if (!host || !Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`ASP_CLIENT_SERVER_HOST must be host:port, got ${value}`);
  }
  return { host, port };
}

function executeOperation(operation: string, payload: unknown, cwd: string): unknown {
  if (!OPERATIONS.some((candidate) => candidate.operation === operation)) {
    throw new Error(`resident TypeScript provider operation is not admitted: ${operation}`);
  }
  if (operation === "projection-batch") {
    return projectProjectionBatch(payload);
  }
  if (operation === "project-resolution") {
    return resolveProjectResolutionRequest(payload, cwd);
  }
  if (operation === "query") return projectExactRequest(payload);
  throw new Error(`resident TypeScript provider operation is not implemented: ${operation}`);
}

interface StreamState {
  readonly frameCount: number;
  readonly chunks: string[];
  nextFrameIndex: number;
}

function handleStreamFrame(
  encoded: Buffer,
  streams: Map<string, StreamState>,
  cwd: string,
): Record<string, unknown> {
  const frame = JSON.parse(encoded.toString("utf8")) as Record<string, unknown>;
  const streamId = frame.streamId;
  const frameIndex = frame.frameIndex;
  const frameCount = frame.frameCount;
  const requestChunk = frame.requestChunk;
  if (
    frame.schemaId !== "agent.semantic-protocols.provider-runtime-request-stream-frame" ||
    frame.schemaVersion !== "1" ||
    typeof streamId !== "string" ||
    streamId.length === 0 ||
    typeof frameIndex !== "number" ||
    !Number.isInteger(frameIndex) ||
    typeof frameCount !== "number" ||
    !Number.isInteger(frameCount) ||
    frameCount <= 1 ||
    frameCount > MAX_STREAM_FRAMES ||
    frameIndex < 0 ||
    frameIndex >= frameCount ||
    typeof requestChunk !== "string"
  )
    throw new Error("provider runtime request stream identity drift");
  let state = streams.get(streamId);
  if (state === undefined) {
    if (frameIndex !== 0) throw new Error("provider runtime request stream is absent");
    if (streams.size >= MAX_STREAMS)
      throw new Error("provider runtime request stream capacity exceeded");
    state = { frameCount, nextFrameIndex: 0, chunks: [] };
    streams.set(streamId, state);
  }
  if (state.frameCount !== frameCount || state.nextFrameIndex !== frameIndex) {
    streams.delete(streamId);
    throw new Error("provider runtime request stream order drift");
  }
  state.chunks.push(requestChunk);
  state.nextFrameIndex += 1;
  if (state.nextFrameIndex < frameCount) {
    return {
      schemaId: "agent.semantic-protocols.provider-runtime-request-stream-ack",
      schemaVersion: "1",
      streamId,
      frameIndex,
      state: "accepted",
    };
  }
  streams.delete(streamId);
  return handleRequest(Buffer.from(state.chunks.join(""), "utf8"), cwd);
}

function handleRequest(encoded: Buffer, cwd: string): Record<string, unknown> {
  let requestId = "invalid-request";
  try {
    const request = JSON.parse(encoded.toString("utf8")) as Record<string, unknown>;
    if (
      request.schemaId !== REQUEST_SCHEMA_ID ||
      request.schemaVersion !== "1" ||
      typeof request.requestId !== "string" ||
      request.requestId.length === 0 ||
      typeof request.operation !== "string" ||
      request.payload === null ||
      typeof request.payload !== "object" ||
      Array.isArray(request.payload)
    ) {
      throw new Error("resident TypeScript provider request identity is invalid");
    }
    requestId = request.requestId;
    const response = executeOperation(request.operation, request.payload, cwd);
    return {
      schemaId: RESPONSE_SCHEMA_ID,
      schemaVersion: "1",
      requestId,
      outcome: "ready",
      payload: response,
    };
  } catch (error) {
    return {
      schemaId: RESPONSE_SCHEMA_ID,
      schemaVersion: "1",
      requestId,
      outcome: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function serveProviderRuntime(output: Writable, cwd: string): Promise<number> {
  const listen = parseListenAddress(requiredEnv("ASP_CLIENT_SERVER_HOST"));
  const healthReceipt = runtimeContractReceipt();
  const healthBody = Buffer.from(JSON.stringify(healthReceipt), "utf8");
  const requestStreams = new Map<string, StreamState>();
  const server = createServer(async (request, response) => {
    try {
      const method = request.method ?? "";
      const path = new URL(request.url ?? "/", "http://provider.local").pathname;
      if (method === "GET" && path === "/health") {
        response.writeHead(200, {
          "content-type": "application/json",
          "content-length": String(healthBody.length),
        });
        response.end(healthBody);
        return;
      }
      if (method === "POST" && path === "/v1/provider-runtime") {
        writeJson(response, 200, handleRequest(await readRequestBody(request), cwd));
        return;
      }
      if (method === "POST" && path === "/v1/provider-runtime-stream") {
        writeJson(
          response,
          200,
          handleStreamFrame(await readRequestBody(request), requestStreams, cwd),
        );
        return;
      }
      if (method === "POST" && path === "/shutdown") {
        writeJson(response, 200, { state: "draining" });
        response.once("finish", () => {
          server.close();
          server.closeIdleConnections();
        });
        return;
      }
      writeJson(response, 404, { error: "provider runtime route not found" });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  server.on("connection", (socket) => socket.setNoDelay(true));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(listen.port, listen.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  output.write(
    `${JSON.stringify({
      schemaId: "agent.semantic-protocols.asp-client-server-bootstrap",
      schemaVersion: "1",
      providerId: healthReceipt.providerId,
      languageId: healthReceipt.languageId,
      transport: "http-json",
      state: "ready",
      endpoint: `http://${address.address}:${address.port}`,
    })}\n`,
  );
  await new Promise<void>((resolve) => server.once("close", resolve));
  return 0;
}
