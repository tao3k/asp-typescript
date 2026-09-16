import { readFileSync } from "node:fs";

export interface ProviderDescriptorIdentity {
  readonly languageId: string;
  readonly providerId: string;
  readonly binary: string;
  readonly namespace: string;
}

export interface ProviderSchemaRegistration {
  readonly authority: "asp" | "provider";
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly path: string;
}

export interface ProviderRegistrationDocument extends ProviderDescriptorIdentity {
  readonly schemas: readonly ProviderSchemaRegistration[];
}

export interface ProviderRuntimeOperation {
  readonly operation: string;
  readonly requestSchema: ProviderSchemaReference;
  readonly responseSchema: ProviderSchemaReference;
}

export interface ProviderSchemaReference {
  readonly schemaId: string;
  readonly schemaVersion: string;
}

export interface ProviderRuntimeContract {
  readonly transport: string;
  readonly operations: readonly ProviderRuntimeOperation[];
  readonly aspClientServer: Readonly<Record<string, unknown>>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`ASP provider descriptor field '${field}' must be a non-empty string`);
  }
  return value;
}

function record(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${description} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export function loadProviderDescriptorIdentity(descriptorUrl: URL): ProviderDescriptorIdentity {
  const document: unknown = JSON.parse(readFileSync(descriptorUrl, "utf8"));
  const descriptor = record(document, "ASP provider descriptor");
  return Object.freeze({
    languageId: requiredString(descriptor.languageId, "languageId"),
    providerId: requiredString(descriptor.providerId, "providerId"),
    binary: requiredString(descriptor.binary, "binary"),
    namespace: requiredString(descriptor.namespace, "namespace"),
  });
}

export function loadProviderRuntimeContract(descriptorUrl: URL): ProviderRuntimeContract {
  const descriptor = record(
    JSON.parse(readFileSync(descriptorUrl, "utf8")),
    "ASP provider descriptor",
  );
  const contract = record(descriptor.runtimeContract, "ASP provider runtimeContract");
  if (!Array.isArray(contract.operations))
    throw new Error("ASP provider runtimeContract.operations must be an array");
  const operations = contract.operations.map((value, index) => {
    const operation = record(value, `runtimeContract.operations[${index}]`);
    const requestSchema = record(
      operation.requestSchema,
      `runtimeContract.operations[${index}].requestSchema`,
    );
    const responseSchema = record(
      operation.responseSchema,
      `runtimeContract.operations[${index}].responseSchema`,
    );
    return Object.freeze({
      operation: requiredString(operation.operation, "operation"),
      requestSchema: Object.freeze({
        schemaId: requiredString(requestSchema.schemaId, "requestSchema.schemaId"),
        schemaVersion: requiredString(requestSchema.schemaVersion, "requestSchema.schemaVersion"),
      }),
      responseSchema: Object.freeze({
        schemaId: requiredString(responseSchema.schemaId, "responseSchema.schemaId"),
        schemaVersion: requiredString(responseSchema.schemaVersion, "responseSchema.schemaVersion"),
      }),
    });
  });
  return Object.freeze({
    transport: requiredString(contract.transport, "runtimeContract.transport"),
    operations: Object.freeze(operations),
    aspClientServer: record(contract.aspClientServer, "runtimeContract.aspClientServer"),
  });
}

export function loadProviderRegistration(
  registrationUrl: URL,
  descriptor: ProviderDescriptorIdentity,
): ProviderRegistrationDocument {
  const registration = record(
    JSON.parse(readFileSync(registrationUrl, "utf8")) as unknown,
    "ASP provider registration",
  );
  const identity = {
    languageId: requiredString(registration.languageId, "languageId"),
    providerId: requiredString(registration.providerId, "providerId"),
    binary: requiredString(registration.binary, "binary"),
    namespace: requiredString(registration.namespace, "namespace"),
  };
  for (const field of ["languageId", "providerId", "binary", "namespace"] as const) {
    if (identity[field] !== descriptor[field]) {
      throw new Error(`ASP provider registration field '${field}' does not match its descriptor`);
    }
  }
  if (!Array.isArray(registration.schemas)) {
    throw new Error("ASP provider registration field 'schemas' must be an array");
  }
  const schemas = registration.schemas.map((value, index) => {
    const schema = record(value, `ASP provider registration schemas[${index}]`);
    const authority = requiredString(schema.authority, `schemas[${index}].authority`);
    if (authority !== "asp" && authority !== "provider") {
      throw new Error(
        `ASP provider registration schemas[${index}].authority must be 'asp' or 'provider'`,
      );
    }
    return Object.freeze({
      authority,
      schemaId: requiredString(schema.schemaId, `schemas[${index}].schemaId`),
      schemaVersion: requiredString(schema.schemaVersion, `schemas[${index}].schemaVersion`),
      path: requiredString(schema.path, `schemas[${index}].path`),
    });
  });
  return Object.freeze({ ...identity, schemas: Object.freeze(schemas) });
}

export const TYPE_SCRIPT_PROVIDER_DESCRIPTOR = loadProviderDescriptorIdentity(
  new URL("../../provider/asp-provider-registration.json", import.meta.url),
);

export const TYPE_SCRIPT_PROVIDER_REGISTRATION = loadProviderRegistration(
  new URL("../../provider/asp-provider-registration.json", import.meta.url),
  TYPE_SCRIPT_PROVIDER_DESCRIPTOR,
);

export const TYPE_SCRIPT_PROVIDER_RUNTIME_CONTRACT = loadProviderRuntimeContract(
  new URL("../../provider/asp-provider-registration.json", import.meta.url),
);
