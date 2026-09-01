import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  loadProviderDescriptorIdentity,
  loadProviderRegistration,
  TYPE_SCRIPT_PROVIDER_DESCRIPTOR,
  TYPE_SCRIPT_PROVIDER_REGISTRATION,
} from "../../src/cli/provider-descriptor.js";

test("provider identity is projected from the ASP registration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-provider-descriptor-"));
  const descriptorPath = path.join(root, "asp-provider-registration.json");
  fs.writeFileSync(
    descriptorPath,
    JSON.stringify({
      languageId: "fixture-language",
      providerId: "fixture-provider",
      binary: "fixture-binary",
      namespace: "example.fixture.provider",
    }),
  );

  assert.deepEqual(loadProviderDescriptorIdentity(pathToFileURL(descriptorPath)), {
    languageId: "fixture-language",
    providerId: "fixture-provider",
    binary: "fixture-binary",
    namespace: "example.fixture.provider",
  });
});

test("provider registration rejects missing identity fields", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-provider-descriptor-"));
  const descriptorPath = path.join(root, "asp-provider-registration.json");
  fs.writeFileSync(descriptorPath, JSON.stringify({ languageId: "typescript" }));

  assert.throws(
    () => loadProviderDescriptorIdentity(pathToFileURL(descriptorPath)),
    /field 'providerId' must be a non-empty string/,
  );
});

test("provider registration schemas are loaded from JSON", () => {
  assert.ok(TYPE_SCRIPT_PROVIDER_REGISTRATION.schemas.length > 0);
  assert.ok(
    TYPE_SCRIPT_PROVIDER_REGISTRATION.schemas.some(
      ({ schemaId }) => schemaId === "agent.semantic-protocols.provider-route",
    ),
  );
});

test("SchemaManager bundle owns every registered schema in a standalone checkout", () => {
  const membership = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "schemas/.asp-schema-manager-membership.json"),
      "utf8",
    ),
  ) as { readonly schemas: readonly { readonly name: string }[] };
  const distributedNames = new Set(membership.schemas.map(({ name }) => name));

  assert.deepEqual(
    TYPE_SCRIPT_PROVIDER_REGISTRATION.schemas
      .map(({ path: schemaPath }) => schemaPath.slice("schemas/".length))
      .filter((schemaName) => !distributedNames.has(schemaName)),
    [],
  );
});

test("provider registration cannot drift from its descriptor", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-provider-registration-"));
  const registrationPath = path.join(root, "asp-provider-registration.json");
  fs.writeFileSync(
    registrationPath,
    JSON.stringify({
      ...TYPE_SCRIPT_PROVIDER_DESCRIPTOR,
      providerId: "drifted-provider",
      schemas: [],
    }),
  );

  assert.throws(
    () =>
      loadProviderRegistration(pathToFileURL(registrationPath), TYPE_SCRIPT_PROVIDER_DESCRIPTOR),
    /field 'providerId' does not match its descriptor/,
  );
});
