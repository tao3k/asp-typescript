import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { jsonPacket, semanticSearchFixture } from "./semantic_search_schema_fixture.js";
import {
  expectedSearchCapabilities,
  expectedSearchIngestRequiredFor,
} from "./semantic_search_registry_expectations.js";
import {
  assertAllowedKeys,
  assertRequiredKeys,
  assertSchemaObject,
  assertSemanticSearchPacket,
  assertString,
  array,
  record,
  stringArray,
} from "./semantic_search_schema_assertions.js";

type JsonObject = Record<string, unknown>;

const TYPE_SCRIPT_SEARCH_VIEWS = [
  "workspace",
  "prime",
  "owner",
  "dependency",
  "deps",
  "api",
  "public-external-types",
  "policy",
  "symbol",
  "callsite",
  "import",
  "tests",
  "lexical",
  "reasoning",
  "env",
  "runtime-source",
  "lang",
  "std",
  "capability",
  "extension",
  "pattern",
  "compare",
  "ingest",
] as const;

test("semantic-search JSON packets conform to the shared schema envelope", () => {
  const schema = sharedSemanticSearchSchema();
  const typeSurfaceSchema = sharedSemanticTypeSurfaceSchema();
  const semanticHandleSchema = sharedSemanticHandleSchema();
  const viewEnum = stringArray(
    record(record(schema.properties).view).enum,
    "schema.properties.view.enum",
  );
  for (const view of TYPE_SCRIPT_SEARCH_VIEWS) {
    assert.ok(viewEnum.includes(view), `schema view enum includes ${view}`);
  }
  const fieldProperties = record(
    record(record(schema.$defs, "schema.$defs").fields, "schema.$defs.fields").properties,
    "schema.$defs.fields.properties",
  );
  assert.deepEqual(
    stringArray(
      record(fieldProperties.versionScope, "versionScope schema").enum,
      "versionScope enum",
    ),
    ["current", "external", "unknown"],
  );
  assert.ok(Object.hasOwn(fieldProperties, "currentWorkspaceVersion"));
  assert.equal(Object.hasOwn(fieldProperties, "workspaceResolvedVersion"), false);
  assert.equal(Object.hasOwn(fieldProperties, "resolvedVersion"), false);

  const root = semanticSearchFixture();
  const doctor = jsonPacket(root, ["agent", "doctor", "--json", "."]);
  const registry = record(doctor.registry, "doctor.registry");
  const provider = record(
    array(registry.languages, "registry.languages")[0],
    "registry.languages[0]",
  );
  const methods = stringArray(provider.methods, "registry.languages[0].methods");
  const packets = [
    jsonPacket(root, ["search", "workspace", "--json", "."]),
    jsonPacket(root, ["search", "prime", "--json", "."]),
    jsonPacket(root, ["search", "owner", "src/index.ts", "--json", "."]),
    jsonPacket(root, ["search", "dependency", "react", "--json", "."]),
    jsonPacket(root, ["search", "deps", "react::jsx", "--json", "."]),
    jsonPacket(root, ["search", "api", "findOrderStatus", "--json", "."]),
    jsonPacket(root, ["search", "public-external-types", "react", "--json", "."]),
    jsonPacket(root, ["search", "policy", "TS-AGENT-POLICY-001", "--json", "."]),
    jsonPacket(root, ["search", "symbol", "findOrderStatus", "--json", "."]),
    jsonPacket(root, ["search", "callsite", "findOrderStatus", "--json", "."]),
    jsonPacket(root, ["search", "import", "./index", "--json", "."]),
    jsonPacket(root, ["search", "tests", "src/index.ts", "--json", "."]),
    jsonPacket(root, ["search", "lexical", "findOrderStatus", "--json", "."]),
    jsonPacket(root, [
      "search",
      "reasoning",
      "owner-query",
      "--owner",
      "src/index.ts",
      "--query",
      "findOrderStatus",
      "--json",
      ".",
    ]),
    jsonPacket(root, ["search", "env", "package", "--json", "."]),
    jsonPacket(root, ["search", "runtime-source", "source", "--json", "."]),
    jsonPacket(root, ["search", "lang", "module", "import", "--json", "."]),
    jsonPacket(root, ["search", "std", "Promise", "--json", "."]),
    jsonPacket(root, ["search", "capability", "owner", "--json", "."]),
    jsonPacket(root, ["search", "extension", "react", "--json", "."]),
    jsonPacket(root, ["search", "pattern", "dependency", "--json", "."]),
    jsonPacket(root, ["search", "compare", "esm", "cjs", "--json", "."]),
    jsonPacket(root, ["search", "ingest", "--json", "."], "src/index.ts:1:findOrderStatus\n"),
  ];

  assert.deepEqual(
    packets.map((packet) => packet.view),
    [...TYPE_SCRIPT_SEARCH_VIEWS],
  );
  for (const packet of packets) {
    assertSemanticSearchPacket(schema, packet, typeSurfaceSchema, semanticHandleSchema);
    assert.equal(packet.languageId, provider.languageId);
    assert.equal(packet.providerId, provider.providerId);
    assert.equal(packet.binary, provider.binary);
    assert.equal(packet.namespace, provider.namespace);
    assert.ok(
      methods.includes(String(packet.method)),
      `registry includes ${String(packet.method)}`,
    );
  }
});

test("semantic language registry JSON documents the TypeScript provider identity", () => {
  const schema = sharedSemanticLanguageRegistrySchema();
  const root = semanticSearchFixture();
  const doctor = jsonPacket(root, ["agent", "doctor", "--json", "."]);
  const registry = record(doctor.registry, "doctor.registry");
  const properties = record(schema.properties, "registry schema.properties");
  assertAllowedKeys(registry, Object.keys(properties), "registry");
  assertRequiredKeys(
    registry,
    stringArray(schema.required, "registry schema.required"),
    "registry",
  );

  assert.equal(registry.registryId, record(properties.registryId, "registryId schema").const);
  assert.equal(
    registry.registryVersion,
    record(properties.registryVersion, "registryVersion schema").const,
  );
  assert.equal(registry.protocolId, record(properties.protocolId, "protocolId schema").const);
  assert.equal(
    registry.protocolVersion,
    record(properties.protocolVersion, "protocolVersion schema").const,
  );

  const defs = record(schema.$defs, "registry schema.$defs");
  const languageRegistrationSchema = record(
    defs.languageRegistration,
    "registry schema languageRegistration",
  );
  const typeScriptCapabilitySchema = sharedTypeScriptCapabilitiesSchema();
  const typeScriptCapabilityDescriptorSchema = record(
    record(typeScriptCapabilitySchema.$defs, "typescript capability schema.$defs")
      .capabilityDescriptor,
    "typescript capabilityDescriptor",
  );
  const typeScriptIngestSurfaceSchema = record(
    record(typeScriptCapabilitySchema.$defs, "typescript capability schema.$defs")
      .ingestSurfaceDescriptor,
    "typescript ingestSurfaceDescriptor",
  );
  const languages = array(registry.languages, "registry.languages");
  assert.equal(languages.length, 1);
  const language = record(languages[0], "registry.languages[0]");
  assertSchemaObject(language, languageRegistrationSchema, "registry.languages[0]");
  assert.equal(language.languageId, "typescript");
  assert.equal(language.providerId, "ts-harness");
  assert.equal(language.binary, "ts-harness");
  assert.equal(language.namespace, "agent.semantic-protocols.languages.typescript.ts-harness");
  assert.equal(language.displayName, "TypeScript");
  assert.deepEqual(stringArray(language.methods, "registry.languages[0].methods"), [
    "search/workspace",
    "search/prime",
    "search/owner",
    "search/dependency",
    "search/deps",
    "search/docs",
    "search/api",
    "search/public-external-types",
    "search/policy",
    "search/symbol",
    "search/callsite",
    "search/import",
    "search/tests",
    "search/lexical",
    "search/reasoning",
    "search/env",
    "search/runtime-source",
    "search/lang",
    "search/std",
    "search/capability",
    "search/extension",
    "search/pattern",
    "search/compare",
    "search/semantic-facts",
    "search/ingest",
    "query",
    "check/changed",
    "check/full",
    "ast-patch/dry-run",
    "evidence/graph",
    "evidence/analyze",
    "agent/doctor",
    "agent/guide",
  ]);
  const methodDescriptors = array(
    language.methodDescriptors,
    "registry.languages[0].methodDescriptors",
  ).map((descriptor, index) =>
    record(descriptor, `registry.languages[0].methodDescriptors[${index}]`),
  );
  assert.equal(
    new Set(methodDescriptors.map((descriptor) => descriptor.method)).size,
    methodDescriptors.length,
    "registry methodDescriptors must not duplicate methods",
  );
  assert.deepEqual(
    methodDescriptors.map((descriptor) => descriptor.method),
    stringArray(language.methods, "registry.languages[0].methods"),
  );
  for (const descriptor of methodDescriptors) {
    assert.equal(descriptor.supportsJson, descriptor.method === "agent/guide" ? false : true);
    assert.equal(
      descriptor.supportsCompact,
      descriptor.method === "ast-patch/dry-run" || descriptor.method === "search/semantic-facts"
        ? false
        : true,
    );
    assert.ok(
      ["search", "query", "check", "ast-patch", "evidence", "agent"].includes(
        String(descriptor.command),
      ),
    );
    if (String(descriptor.method).startsWith("search/")) {
      assert.equal(descriptor.command, "search");
      assert.equal(descriptor.view, String(descriptor.method).slice("search/".length));
      assert.deepEqual(
        descriptor.outputSchemaIds,
        String(descriptor.method) === "search/public-external-types"
          ? [
              "agent.semantic-protocols.semantic-search-packet",
              "agent.semantic-protocols.semantic-type-surface",
            ]
          : String(descriptor.method) === "search/policy"
            ? [
                "agent.semantic-protocols.semantic-search-packet",
                "agent.semantic-protocols.semantic-handle",
              ]
            : String(descriptor.method) === "search/semantic-facts"
              ? ["agent.semantic-protocols.semantic-fact-graph"]
              : ["agent.semantic-protocols.semantic-search-packet"],
      );
      assert.equal(
        descriptor.requiresQuery,
        [
          "search/owner",
          "search/dependency",
          "search/deps",
          "search/docs",
          "search/api",
          "search/public-external-types",
          "search/policy",
          "search/symbol",
          "search/callsite",
          "search/import",
          "search/tests",
          "search/lexical",
          "search/reasoning",
          "search/extension",
          "search/pattern",
          "search/compare",
          "search/semantic-facts",
        ].includes(String(descriptor.method)),
      );
      assert.equal(
        descriptor.acceptsStdin,
        descriptor.method === "search/ingest" || descriptor.method === "search/semantic-facts",
      );
      assert.equal(descriptor.supportsPackageScope, true);
      const benchmarkInvocation = record(
        descriptor.benchmarkInvocation,
        `${String(descriptor.method)} benchmarkInvocation`,
      );
      const benchmarkArgs = stringArray(
        benchmarkInvocation.args,
        `${String(descriptor.method)} benchmarkInvocation.args`,
      );
      assert.deepEqual(benchmarkArgs.slice(0, 2), ["search", descriptor.view]);
      assert.ok(benchmarkArgs.includes("{workspace}"));
      assert.equal(typeof benchmarkInvocation.expectsJson, "boolean");
      assert.ok(Number(benchmarkInvocation.maxElapsedMs) > 0);
      assert.deepEqual(
        descriptor.acceptedPipes === undefined
          ? []
          : stringArray(descriptor.acceptedPipes, `${String(descriptor.method)} acceptedPipes`),
        String(descriptor.method) === "search/policy" ||
          String(descriptor.method) === "search/lexical"
          ? ["owner", "tests"]
          : String(descriptor.method) === "search/owner"
            ? ["items"]
            : String(descriptor.method) === "search/ingest"
              ? ["items", "tests"]
              : [],
      );
      assert.deepEqual(
        descriptor.packetSchemas === undefined
          ? []
          : stringArray(descriptor.packetSchemas, `${String(descriptor.method)} packetSchemas`),
        String(descriptor.method) === "search/owner"
          ? ["semantic-search-packet.v1", "semantic-tree-sitter-query.v1"]
          : String(descriptor.method) === "search/semantic-facts"
            ? ["semantic-fact-graph.v1", "semantic-fact-ontology.v1"]
            : [],
      );
      assert.equal(
        descriptor.grammarId,
        String(descriptor.method) === "search/owner" ? "tree-sitter-typescript" : undefined,
      );
      assert.equal(
        descriptor.supportsQuerySet,
        String(descriptor.method) === "query/owner-items" ||
          String(descriptor.method) === "search/lexical"
          ? true
          : undefined,
      );
      assert.deepEqual(
        descriptor.acceptedQuerySetSelectors === undefined
          ? []
          : stringArray(
              descriptor.acceptedQuerySetSelectors,
              `${String(descriptor.method)} acceptedQuerySetSelectors`,
            ),
        String(descriptor.method) === "query/owner-items"
          ? ["exact-set"]
          : String(descriptor.method) === "search/lexical"
            ? ["lexical-set"]
            : [],
      );
      assert.deepEqual(
        descriptor.querySetScopes === undefined
          ? []
          : stringArray(descriptor.querySetScopes, `${String(descriptor.method)} querySetScopes`),
        String(descriptor.method) === "query/owner-items"
          ? ["owner"]
          : String(descriptor.method) === "search/lexical"
            ? ["project", "owner"]
            : [],
      );
      const capabilities = array(
        descriptor.capabilities,
        `${String(descriptor.method)} capabilities`,
      ).map((capability, index) =>
        record(capability, `${String(descriptor.method)} capabilities[${index}]`),
      );
      for (const capability of capabilities) {
        assertSchemaObject(
          capability,
          typeScriptCapabilityDescriptorSchema,
          `${String(descriptor.method)} TypeScript capability`,
        );
      }
      if (descriptor.method === "ast-patch/dry-run") {
        assert.equal(descriptor.command, "ast-patch");
        assert.deepEqual(descriptor.outputSchemaIds, [
          "agent.semantic-protocols.semantic-ast-patch-receipt",
        ]);
        assert.equal(descriptor.mutationAvailable, false);
      }
      assert.deepEqual(capabilities, expectedSearchCapabilities(String(descriptor.method)));
      const ingestRequiredFor = descriptor.ingestRequiredFor;
      const surfaces =
        ingestRequiredFor === undefined
          ? []
          : array(ingestRequiredFor, `${String(descriptor.method)} ingestRequiredFor`).map(
              (surface, index) =>
                record(surface, `${String(descriptor.method)} ingestRequiredFor[${index}]`),
            );
      for (const surface of surfaces) {
        assertSchemaObject(
          surface,
          typeScriptIngestSurfaceSchema,
          `${String(descriptor.method)} TypeScript ingest surface`,
        );
      }
      assert.deepEqual(surfaces, expectedSearchIngestRequiredFor(String(descriptor.method)));
    } else if (descriptor.method === "query") {
      assert.equal(descriptor.command, "query");
      assert.equal(Object.hasOwn(descriptor, "view"), false);
      assert.deepEqual(descriptor.outputSchemaIds, [
        "agent.semantic-protocols.semantic-tree-sitter-query",
      ]);
      assert.deepEqual(descriptor.packetSchemas, ["semantic-tree-sitter-query.v1"]);
      assert.equal(descriptor.input, "tree-sitter-compatible syntax query");
      assert.deepEqual(descriptor.requiredOptions, ["--catalog|--treesitter-query"]);
      assert.deepEqual(descriptor.queryInputForms, ["catalog-id", "s-expression"]);
      assert.equal(descriptor.grammarId, "tree-sitter-typescript");
      assert.equal(descriptor.grammarProfileVersion, "2026-06-05.v1");
      assert.equal(descriptor.grammarProfileSchema, "semantic-tree-sitter-grammar-profile.v1");
      assert.equal(
        descriptor.grammarProfilePath,
        "tree-sitter/tree-sitter-typescript/grammar-profile.json",
      );
      assert.deepEqual(descriptor.supportedPredicates, [
        "#eq?",
        "#any-eq?",
        "#any-of?",
        "#match?",
        "#any-match?",
        "#not-eq?",
        "#not-match?",
      ]);
      assert.deepEqual(descriptor.unsupportedPredicates, []);
      assert.equal(descriptor.cacheReplay, true);
      assert.deepEqual(descriptor.outputModes, ["frontier", "json", "code"]);
      const queryCatalogs = array(descriptor.queryCatalogs, "query queryCatalogs").map(
        (catalog, index) => record(catalog, `query queryCatalogs[${index}]`),
      );
      assert.deepEqual(
        queryCatalogs.map((catalog) => catalog.id),
        ["declarations", "imports", "calls"],
      );
      for (const catalog of queryCatalogs) {
        assert.equal(catalog.sourceDelivery, "provider-binary-embedded");
        assert.ok(String(catalog.path).startsWith("tree-sitter/tree-sitter-typescript/queries/"));
        assert.ok(array(catalog.captures, "query catalog captures").length > 0);
      }
    } else if (String(descriptor.method).startsWith("query/")) {
      const method = String(descriptor.method);
      assert.equal(descriptor.command, "query");
      assert.equal(Object.hasOwn(descriptor, "view"), false);
      assert.deepEqual(
        descriptor.outputSchemaIds,
        method === "query/direct-source-read"
          ? [
              "agent.semantic-protocols.semantic-query-packet",
              "agent.semantic-protocols.semantic-read-packet",
            ]
          : ["agent.semantic-protocols.semantic-query-packet"],
      );
      assert.equal(descriptor.input, "owner-path");
      assert.deepEqual(
        descriptor.requiredOptions,
        method === "query/direct-source-read" ? ["--from-hook", "--selector"] : ["--term"],
      );
      assert.deepEqual(
        descriptor.outputModes,
        method === "query/direct-source-read"
          ? ["frontier", "json", "code", "names", "read-packet"]
          : ["frontier", "json", "code", "names"],
      );
      assert.deepEqual(
        descriptor.packetSchemas,
        method === "query/direct-source-read"
          ? ["semantic-query-packet.v1", "semantic-read-packet.v1", "semantic-tree-sitter-query.v1"]
          : ["semantic-query-packet.v1", "semantic-tree-sitter-query.v1"],
      );
      assert.equal(descriptor.grammarId, "tree-sitter-typescript");
      assert.deepEqual(
        descriptor.queryInputForms === undefined ? [] : descriptor.queryInputForms,
        method === "query/direct-source-read"
          ? ["selector"]
          : method === "query/owner-items"
            ? ["selector", "code-shaped"]
            : [],
      );
      assert.equal(descriptor.supportsQuerySet, method === "query/owner-items" ? true : undefined);
      assert.deepEqual(
        descriptor.acceptedQuerySetSelectors === undefined
          ? []
          : descriptor.acceptedQuerySetSelectors,
        method === "query/owner-items" ? ["exact-set"] : [],
      );
      assert.deepEqual(
        descriptor.querySetScopes === undefined ? [] : descriptor.querySetScopes,
        method === "query/owner-items" ? ["owner"] : [],
      );
    } else if (String(descriptor.method).startsWith("check/")) {
      assert.equal(descriptor.command, "check");
      assert.equal(Object.hasOwn(descriptor, "view"), false);
      assert.equal(Object.hasOwn(descriptor, "outputSchemaIds"), false);
      assert.equal(Object.hasOwn(descriptor, "requiresQuery"), false);
      assert.equal(Object.hasOwn(descriptor, "acceptsStdin"), false);
      assert.equal(Object.hasOwn(descriptor, "supportsPackageScope"), false);
      assert.equal(Object.hasOwn(descriptor, "acceptedPipes"), false);
      assert.equal(Object.hasOwn(descriptor, "capabilities"), false);
      assert.equal(Object.hasOwn(descriptor, "ingestRequiredFor"), false);
    } else if (String(descriptor.method).startsWith("evidence/")) {
      const method = String(descriptor.method);
      assert.equal(descriptor.command, "evidence");
      assert.equal(Object.hasOwn(descriptor, "view"), false);
      assert.equal(descriptor.input, "provider project root");
      assert.deepEqual(
        descriptor.outputSchemaIds,
        method === "evidence/analyze"
          ? ["agent.semantic-protocols.semantic-graph-turbo-request"]
          : ["agent.semantic-protocols.semantic-evidence-graph"],
      );
      assert.deepEqual(
        descriptor.packetSchemas === undefined ? [] : descriptor.packetSchemas,
        method === "evidence/analyze" ? ["semantic-graph-turbo-request.v1"] : [],
      );
      assert.deepEqual(
        descriptor.clients === undefined ? [] : descriptor.clients,
        method === "evidence/analyze" ? ["asp-graph-turbo"] : [],
      );
      assert.equal(Object.hasOwn(descriptor, "requiresQuery"), false);
      assert.equal(Object.hasOwn(descriptor, "acceptsStdin"), false);
      assert.equal(Object.hasOwn(descriptor, "supportsPackageScope"), false);
      assert.equal(Object.hasOwn(descriptor, "acceptedPipes"), false);
      assert.equal(Object.hasOwn(descriptor, "capabilities"), false);
      assert.equal(Object.hasOwn(descriptor, "ingestRequiredFor"), false);
    } else if (String(descriptor.method).startsWith("agent/")) {
      assert.equal(descriptor.command, "agent");
      assert.equal(Object.hasOwn(descriptor, "view"), false);
      assert.deepEqual(
        descriptor.outputSchemaIds === undefined
          ? []
          : stringArray(descriptor.outputSchemaIds, `${String(descriptor.method)} outputSchemaIds`),
        descriptor.method === "agent/doctor"
          ? ["agent.semantic-protocols.semantic-provider-doctor"]
          : [],
      );
      assert.equal(Object.hasOwn(descriptor, "requiresQuery"), false);
      assert.equal(Object.hasOwn(descriptor, "acceptsStdin"), false);
      assert.equal(Object.hasOwn(descriptor, "supportsPackageScope"), false);
      assert.equal(Object.hasOwn(descriptor, "acceptedPipes"), false);
      assert.equal(Object.hasOwn(descriptor, "capabilities"), false);
      assert.equal(Object.hasOwn(descriptor, "ingestRequiredFor"), false);
      assert.equal(Object.hasOwn(descriptor, "clients"), false);
      assert.equal(Object.hasOwn(descriptor, "requiredOptions"), false);
      assert.equal(Object.hasOwn(descriptor, "input"), false);
    }
  }
  const schemas = array(language.schemas, "registry.languages[0].schemas").map((schema, index) =>
    record(schema, `registry.languages[0].schemas[${index}]`),
  );
  const schemasById = new Map(schemas.map((schema) => [String(schema.schemaId), schema]));
  assert.equal(schemasById.size, schemas.length, "registry schemas must not duplicate schemaId");
  const assertRegisteredSchema = (
    schemaId: string,
    expectedVersion: string,
    schemaPath: string,
  ): void => {
    const schemaRecord = record(schemasById.get(schemaId), `registry schema ${schemaId}`);
    assert.equal(schemaRecord.schemaId, schemaId);
    assert.equal(schemaRecord.schemaVersion, expectedVersion);
    assert.equal(schemaRecord.path, schemaPath);
  };
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-search-packet",
    "1",
    "schemas/semantic-search-packet.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-query-packet",
    "1",
    "schemas/semantic-query-packet.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-read-packet",
    "1",
    "schemas/semantic-read-packet.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-tree-sitter-provenance",
    "1",
    "schemas/semantic-tree-sitter-provenance.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-tree-sitter-query",
    "1",
    "schemas/semantic-tree-sitter-query.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-tree-sitter-grammar-profile",
    "1",
    "schemas/semantic-tree-sitter-grammar-profile.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-graph",
    "1",
    "schemas/semantic-graph.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-graph-turbo-request",
    "1",
    "schemas/semantic-graph-turbo-request.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-fact-graph",
    "1",
    "schemas/semantic-fact-graph.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-fact-ontology",
    "1",
    "schemas/semantic-fact-ontology.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-verification-receipt",
    "1",
    "schemas/semantic-verification-receipt.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-behavior-snapshot",
    "1",
    "schemas/semantic-behavior-snapshot.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-determinism-readiness",
    "1",
    "schemas/semantic-determinism-readiness.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.dev-command-log",
    "1",
    "schemas/semantic-dev-command-log.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-formal-proof-pilot",
    "1",
    "schemas/semantic-formal-proof-pilot.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-review-packet",
    "1",
    "schemas/semantic-review-packet.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-evidence-graph",
    "1",
    "schemas/semantic-evidence-graph.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-assurance-case",
    "1",
    "schemas/semantic-assurance-case.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-type-surface",
    "1",
    "schemas/semantic-type-surface.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-handle",
    "1",
    "schemas/semantic-handle.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-source-location",
    "1",
    "schemas/semantic-source-location.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.semantic-language-registry",
    "1",
    "schemas/semantic-language-registry.v1.schema.json",
  );
  assertRegisteredSchema(
    "agent.semantic-protocols.languages.typescript.ts-harness.capabilities",
    "1",
    "schemas/typescript-semantic-capabilities.v1.schema.json",
  );
});

test("package-local semantic schemas stay synchronized with the protocol repository", () => {
  for (const schemaFileName of [
    "semantic-search-packet.v1.schema.json",
    "semantic-query-packet.v1.schema.json",
    "semantic-read-packet.v1.schema.json",
    "semantic-source-location.v1.schema.json",
    "semantic-tree-sitter-provenance.v1.schema.json",
    "semantic-tree-sitter-query.v1.schema.json",
    "semantic-tree-sitter-grammar-profile.v1.schema.json",
    "semantic-graph.v1.schema.json",
    "semantic-graph-turbo-request.v1.schema.json",
    "semantic-fact-graph.v1.schema.json",
    "semantic-fact-ontology.v1.schema.json",
    "semantic-type-surface.v1.schema.json",
    "semantic-handle.v1.schema.json",
    "semantic-dev-command-log.v1.schema.json",
    "semantic-review-packet.v1.schema.json",
    "semantic-evidence-graph.v1.schema.json",
    "semantic-assurance-case.v1.schema.json",
    "semantic-language-registry.v1.schema.json",
    "semantic-owner-item-evidence.v1.schema.json",
  ]) {
    const repoSchemaPath = protocolRepositorySchemaPath(schemaFileName);
    if (repoSchemaPath === undefined) {
      continue;
    }
    assert.deepEqual(
      readJson(packageSchemaPath(schemaFileName)),
      readJson(repoSchemaPath),
      `${schemaFileName} matches the protocol repository schema`,
    );
  }

  const typeScriptCapabilityTemplatePath = protocolRepositorySchemaPath(
    "typescript-semantic-capabilities-template.v1.schema.json",
  );
  if (typeScriptCapabilityTemplatePath !== undefined) {
    const local = sharedTypeScriptCapabilitiesSchema();
    const template = readJson(typeScriptCapabilityTemplatePath);
    assert.deepEqual(
      record(local.$defs, "local TypeScript capabilities $defs"),
      record(template.$defs, "template TypeScript capabilities $defs"),
      "TypeScript capability vocabulary matches the protocol repository template",
    );
  }
});

function sharedSemanticSearchSchema(): JsonObject {
  return readJson(packageSchemaPath("semantic-search-packet.v1.schema.json"));
}

function sharedSemanticTypeSurfaceSchema(): JsonObject {
  return readJson(packageSchemaPath("semantic-type-surface.v1.schema.json"));
}

function sharedSemanticHandleSchema(): JsonObject {
  return readJson(packageSchemaPath("semantic-handle.v1.schema.json"));
}

function sharedTypeScriptCapabilitiesSchema(): JsonObject {
  return readJson(packageSchemaPath("typescript-semantic-capabilities.v1.schema.json"));
}

function sharedSemanticLanguageRegistrySchema(): JsonObject {
  return readJson(packageSchemaPath("semantic-language-registry.v1.schema.json"));
}

function packageRoot(): string {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(testDir, "..", "..", "..");
}

function packageSchemaPath(schemaFileName: string): string {
  return path.join(packageRoot(), "schemas", schemaFileName);
}

function protocolRepositorySchemaPath(schemaFileName: string): string | undefined {
  const packageRootPath = packageRoot();
  const repoRoot = path.resolve(packageRootPath, "..", "..");
  const requestedSchemaPath = path.join(repoRoot, "schemas", schemaFileName);
  return fs.existsSync(requestedSchemaPath) ? requestedSchemaPath : undefined;
}

function readJson(filePath: string): JsonObject {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonObject;
}
