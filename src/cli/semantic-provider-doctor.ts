import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEMANTIC_LANGUAGE_PROTOCOL_ID,
  SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
  SEMANTIC_LANGUAGE_REGISTRY_ID,
  SEMANTIC_LANGUAGE_REGISTRY_VERSION,
  semanticLanguageRegistryDocument,
} from "./semantic-language.js";

const SEMANTIC_PROVIDER_DOCTOR_SCHEMA_ID = "agent.semantic-protocols.semantic-provider-doctor";
const SEMANTIC_PROVIDER_DOCTOR_SCHEMA_VERSION = "1";
const CANONICAL_SCHEMA_AUTHORITY = "https://tao3k.github.io/agent-semantic-protocols/schemas/";

interface ProviderIdentity {
  readonly languageId: string;
  readonly providerId: string;
  readonly binary: string;
  readonly execution: string;
}

function providerManifestPath(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDirectory, "..", "..", "provider", "asp-provider-registration.json");
}

function providerIdentity(): ProviderIdentity {
  const document = JSON.parse(readFileSync(providerManifestPath(), "utf8")) as Record<
    string,
    unknown
  >;
  const identity = {
    languageId: document.languageId,
    providerId: document.providerId,
    binary: document.binary,
    execution: document.execution,
  };
  for (const [field, value] of Object.entries(identity)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`provider manifest ${field} must be a non-empty string`);
    }
  }
  return identity as ProviderIdentity;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported canonical JSON value: ${typeof value}`);
}

export function semanticProviderDoctorDocument(): Record<string, unknown> {
  const identity = providerIdentity();
  const registry = semanticLanguageRegistryDocument();
  const registryDigest = `sha256:${createHash("sha256")
    .update(canonicalJson(registry), "utf8")
    .digest("hex")}`;
  return {
    schemaId: SEMANTIC_PROVIDER_DOCTOR_SCHEMA_ID,
    schemaVersion: SEMANTIC_PROVIDER_DOCTOR_SCHEMA_VERSION,
    schemaAuthority: CANONICAL_SCHEMA_AUTHORITY,
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
    languageId: identity.languageId,
    providerId: identity.providerId,
    binary: identity.binary,
    execution: identity.execution,
    registrySchemaId: SEMANTIC_LANGUAGE_REGISTRY_ID,
    registrySchemaVersion: SEMANTIC_LANGUAGE_REGISTRY_VERSION,
    registry,
    registryDigest,
  };
}
