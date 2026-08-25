import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_SEARCH_VIEW_DESCRIPTORS,
  typeScriptSemanticLanguageRegistration,
} from "../../src/cli/semantic-language.js";
import { runCliCapture } from "./cli_helpers.js";

test("semantic graph facts descriptor is graph-turbo owned", () => {
  const descriptor = TYPE_SCRIPT_SEARCH_VIEW_DESCRIPTORS.find(
    (candidate) => candidate.method === "search/semantic-facts",
  );

  assert.ok(descriptor, "semantic facts descriptor should exist");
  assert.equal(descriptor.requiresQuery, true);
  assert.equal(descriptor.acceptsStdin, true);
  assert.deepEqual(descriptor.outputModes, ["json"]);
  assert.deepEqual(descriptor.packetSchemas, [
    "semantic-fact-graph.v1",
    "semantic-fact-ontology.v1",
  ]);
  const methodDescriptor = typeScriptSemanticLanguageRegistration().methodDescriptors.find(
    (candidate) => candidate.method === "search/semantic-facts",
  );
  assert.deepEqual(methodDescriptor?.benchmarkInvocation, {
    args: ["search", "semantic-facts", "{query}", "--workspace", "{workspace}", "--json"],
    stdinTemplate: "{owner}:1:{query}\n",
    expectsJson: true,
    maxElapsedMs: 15_000,
  });
  const externalTypesDescriptor = typeScriptSemanticLanguageRegistration().methodDescriptors.find(
    (candidate) => candidate.method === "search/public-external-types",
  );
  assert.deepEqual(externalTypesDescriptor?.benchmarkInvocation, {
    args: [
      "search",
      "public-external-types",
      "{dependency}",
      "--workspace",
      "{workspace}",
      "--view",
      "seeds",
    ],
    expectsJson: false,
    maxElapsedMs: 15_000,
  });
});

test("semantic graph facts renders field type and collection graph facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-semantic-graph-facts-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(
    path.join(root, "model.ts"),
    [
      "interface Catalog {",
      "  names: string[];",
      "  readonly tags: readonly string[];",
      "  byId: Map<string, number>;",
      "}",
      "",
      "class Store {",
      "  readonly items: Array<Catalog>;",
      "}",
    ].join("\n"),
  );

  const command = [
    "search",
    "semantic-facts",
    "array collection fields",
    "--json",
    "--workspace",
    ".",
  ];
  const result = runCliCapture(command, root, "model.ts:2:1:names\n");

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly schemaId: string;
    readonly languageId: string;
    readonly providerId: string;
    readonly nodes: readonly {
      readonly id: string;
      readonly kind: string;
      readonly role?: string;
      readonly value?: string;
      readonly fields?: Record<string, unknown>;
    }[];
    readonly edges: readonly {
      readonly source: string;
      readonly target: string;
      readonly relation: string;
    }[];
  };
  assert.equal(payload.schemaId, "agent.semantic-protocols.semantic-fact-graph");
  assert.equal(payload.languageId, TYPE_SCRIPT_LANGUAGE_ID);
  assert.equal(payload.providerId, TYPE_SCRIPT_PROVIDER_ID);
  const fieldNode = payload.nodes.find(
    (node) => node.kind === "field" && node.value === "names: string[]",
  );
  assert.ok(fieldNode, "expected interface field node");
  assert.equal(fieldNode.role, "interface-field");
  assert.deepEqual(fieldNode.fields, {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    semanticFactKind: "field",
    provenance: "parser",
    confidence: "exact",
    freshness: "fresh",
    containerKind: "interface",
    containerName: "Catalog",
    fieldName: "names",
    typeValue: "string[]",
    elementShape: "collection",
    contextLocator: "model.ts:1:5",
    contextStartLine: 1,
    contextEndLine: 5,
    field: {
      ownerKind: "interface",
      name: "names",
      ownerPath: "model.ts",
      access: ["read", "append", "validate"],
    },
    collectionKind: "array",
    collectionFamily: "sequence",
    collectionImpl: "array",
  });

  const typeNode = payload.nodes.find((node) => node.kind === "type" && node.value === "string[]");
  assert.ok(typeNode, "expected field type node");
  assert.deepEqual(typeNode.fields, {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    semanticFactKind: "type",
    provenance: "parser",
    confidence: "exact",
    freshness: "fresh",
    containerKind: "interface",
    containerName: "Catalog",
    fieldName: "names",
    typeValue: "string[]",
    elementShape: "collection",
    contextLocator: "model.ts:1:5",
    contextStartLine: 1,
    contextEndLine: 5,
    collectionKind: "array",
    collectionFamily: "sequence",
    collectionImpl: "array",
    type: { name: "string[]" },
  });
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "field" &&
        node.value === "tags: readonly string[]" &&
        node.fields?.collectionKind === "array" &&
        node.fields?.collectionFamily === "sequence",
    ),
    "expected readonly array field node",
  );
  const collectionNode = payload.nodes.find(
    (node) => node.kind === "collection" && node.value === "array",
  );
  assert.ok(collectionNode, "expected array collection node");
  assert.deepEqual(collectionNode.fields, {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    semanticFactKind: "collection",
    provenance: "parser",
    confidence: "exact",
    freshness: "fresh",
    collectionKind: "array",
    collectionFamily: "sequence",
    collectionImpl: "array",
    collection: {
      family: "sequence",
      impl: "array",
      mutation: ["append", "insert", "remove"],
    },
  });
  assert.ok(payload.edges.some((edge) => edge.relation === "has_type"));
  assert.ok(payload.edges.some((edge) => edge.relation === "collection_of"));
});

test("semantic graph facts preserves candidate-owner facts for concurrency API queries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-semantic-graph-context-facts-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(
    path.join(root, "service.ts"),
    [
      "interface RuntimeOptions {",
      "  readonly storeId: string;",
      "  readonly handlers: Array<(input: string) => void>;",
      "  readonly embedMany: (input: ReadonlyArray<string>, options?: { readonly concurrency?: number }) => Effect.Effect<Array<Array<number>>, Error>;",
      "}",
      "",
      "export const makeService = Effect.gen(function* () {",
      "  const stream = Stream.empty;",
      "  return { stream };",
      "});",
    ].join("\n"),
  );

  const result = runCliCapture(
    [
      "search",
      "semantic-facts",
      "Effect concurrency Fiber Queue Stream Scope",
      "--json",
      "--workspace",
      ".",
    ],
    root,
    "service.ts:6:1:Effect\nservice.ts:7:1:Stream\n",
  );

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly nodes: readonly {
      readonly id: string;
      readonly kind: string;
      readonly value?: string;
      readonly fields?: Record<string, unknown>;
    }[];
    readonly edges: readonly {
      readonly source?: string;
      readonly relation: string;
    }[];
  };
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "field" &&
        node.value === "handlers: Array<(input: string) => void>" &&
        node.fields?.containerName === "RuntimeOptions",
    ),
    "expected candidate owner field fact",
  );
  assert.ok(
    payload.nodes.some(
      (node) => node.kind === "type" && node.value === "Array<(input: string) => void>",
    ),
    "expected candidate owner type fact",
  );
  const embedMany = payload.nodes.find(
    (node) =>
      node.kind === "field" &&
      node.value?.startsWith(
        "embedMany: (input: ReadonlyArray<string>, options?: { readonly concurrency?: number })",
      ) &&
      node.fields?.collectionKind === "array",
  );
  assert.ok(embedMany, "expected function field collection fact");
  assert.ok(
    payload.nodes.some((node) => node.kind === "collection" && node.value === "array"),
    "expected candidate owner collection fact",
  );
  assert.ok(payload.edges.some((edge) => edge.relation === "has_type"));
  assert.ok(payload.edges.some((edge) => edge.relation === "collection_of"));
  assert.ok(
    payload.edges.some((edge) => edge.relation === "collection_of" && edge.source === embedMany.id),
    "expected function field collection edge",
  );
});

test("semantic graph facts renders package build dependency and test facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-semantic-project-facts-"));
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@scope/fact-pkg",
      dependencies: { zod: "^4.0.0" },
      devDependencies: { "node:test": "*" },
    }),
  );
  fs.writeFileSync(
    path.join(root, "tests", "api.test.ts"),
    ['import test from "node:test";', "", 'test("api", () => {', "  // fixture", "});"].join("\n"),
  );
  fs.writeFileSync(path.join(root, "model.ts"), "interface Cache {\n  entries: string[];\n}\n");

  const result = runCliCapture(
    ["search", "semantic-facts", "field", "--json", "--workspace", "."],
    root,
    "model.ts:2:1:entries\n",
  );

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly nodes: readonly {
      readonly id: string;
      readonly kind: string;
      readonly action?: string;
      readonly path?: string;
      readonly value?: string;
      readonly fields?: Record<string, unknown>;
    }[];
    readonly edges: readonly {
      readonly source: string;
      readonly target: string;
      readonly relation: string;
    }[];
  };
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "package" &&
        node.value === "@scope/fact-pkg" &&
        node.action === "package" &&
        node.fields?.semanticFactKind === "package" &&
        node.fields?.manifestPath === "package.json",
    ),
    "expected package node",
  );
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "build" &&
        node.action === "build" &&
        node.fields?.semanticFactKind === "build" &&
        node.fields?.command === "npm test",
    ),
    "expected build node",
  );
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "dependency" &&
        node.value === "zod" &&
        node.action === "deps" &&
        node.fields?.semanticFactKind === "dependency" &&
        node.fields?.dependencyKind === "normal" &&
        node.fields?.versionReq === "^4.0.0",
    ),
    "expected normal dependency node",
  );
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "dependency" &&
        node.value === "node:test" &&
        node.fields?.dependencyKind === "dev",
    ),
    "expected dev dependency node",
  );
  assert.ok(
    payload.nodes.some(
      (node) =>
        node.kind === "test" &&
        node.path === "tests/api.test.ts" &&
        node.action === "tests" &&
        node.fields?.semanticFactKind === "test" &&
        node.fields?.functionCount === 1,
    ),
    "expected test node",
  );
  for (const relation of ["builds", "depends_on", "tests", "belongs_to"]) {
    assert.ok(
      payload.edges.some((edge) => edge.relation === relation),
      relation,
    );
  }
  const fieldNode = payload.nodes.find(
    (node) => node.kind === "field" && node.value === "entries: string[]",
  );
  const packageNode = payload.nodes.find((node) => node.kind === "package");
  assert.ok(fieldNode, "expected field node");
  assert.ok(packageNode, "expected package node");
  assert.ok(
    payload.edges.some(
      (edge) =>
        edge.source === fieldNode.id &&
        edge.target === packageNode.id &&
        edge.relation === "belongs_to",
    ),
    "expected field to package bridge",
  );
});

test("semantic graph facts skips parse-error files without dropping valid owner facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-semantic-invalid-source-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(root, "invalid.ts"), "interface Broken { value: ; }\n");
  fs.writeFileSync(path.join(root, "model.ts"), "interface Cache {\n  entries: string[];\n}\n");

  const result = runCliCapture(
    ["search", "semantic-facts", "field", "--json", "--workspace", "."],
    root,
  );

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly nodes: readonly { readonly kind: string; readonly value?: string }[];
  };
  assert.ok(
    payload.nodes.some((node) => node.kind === "field" && node.value === "entries: string[]"),
    "expected valid file facts despite a parse-error peer",
  );
});
