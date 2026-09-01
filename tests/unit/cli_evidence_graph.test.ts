import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
} from "../../src/cli/semantic-language.js";

import { runCliCapture } from "./cli_helpers.js";

test("evidence graph renders semantic evidence graph JSON", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-evidence-graph-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@scope/evidence" }));
  fs.writeFileSync(path.join(root, "index.ts"), "export const value = 1;\n");

  const result = runCliCapture(["evidence", "graph", "--json", "."], root);

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly schemaId: string;
    readonly protocolId: string;
    readonly producer: { readonly languageId: string; readonly providerId: string };
    readonly project: { readonly package?: string };
    readonly summary: Record<string, number>;
    readonly nodes: readonly { readonly kind: string }[];
    readonly edges: readonly { readonly kind: string }[];
    readonly gaps: readonly { readonly fields?: Record<string, string> }[];
  };
  assert.equal(payload.schemaId, "agent.semantic-protocols.semantic-evidence-graph");
  assert.equal(payload.protocolId, "agent.semantic-protocols.evidence-graph");
  assert.equal(payload.producer.languageId, TYPE_SCRIPT_LANGUAGE_ID);
  assert.equal(payload.producer.providerId, TYPE_SCRIPT_PROVIDER_ID);
  assert.equal(payload.project.package, "@scope/evidence");
  assert.deepEqual(payload.summary, {
    nodes: 4,
    edges: 3,
    owners: 1,
    claims: 1,
    staleItems: 0,
    gaps: 1,
  });
  assert.ok(payload.nodes.some((node) => node.kind === "owner"));
  assert.ok(payload.edges.some((edge) => edge.kind === "requires-evidence"));
  assert.deepEqual(payload.gaps[0]?.fields, { requiredReceiptId: "typescript.policy.api" });
});

test("evidence analyze renders graph-turbo request JSON", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-evidence-analysis-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "analysis" }));
  fs.writeFileSync(path.join(root, "index.ts"), "export const value = 1;\n");

  const result = runCliCapture(["evidence", "analyze", "--json", "."], root);

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly schemaId: string;
    readonly packetKind: string;
    readonly surface: string;
    readonly profile: string;
    readonly producer: { readonly languageId: string };
    readonly summary: Record<string, number>;
    readonly graphs: readonly {
      readonly graphId: string;
      readonly edges: readonly { readonly relation: string }[];
    }[];
    readonly seedIds: readonly string[];
  };
  assert.equal(payload.schemaId, "agent.semantic-protocols.semantic-graph-turbo-request");
  assert.equal(payload.packetKind, "graph-turbo-request");
  assert.equal(payload.surface, "evidence-analyze");
  assert.equal(payload.profile, "evidence-quality");
  assert.equal(payload.producer.languageId, "typescript");
  assert.equal(payload.summary.graphs, 1);
  assert.equal(payload.summary.nodes, 4);
  assert.equal(payload.summary.gaps, 1);
  assert.equal(payload.graphs[0]?.graphId, "typescript.evidence.graph");
  assert.deepEqual(payload.seedIds, ["typescript:owner:package.json"]);
  assert.ok(payload.graphs[0]?.edges.some((edge) => edge.relation === "requires-evidence"));
});

test("agent registry advertises evidence methods", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-evidence-registry-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "registry" }));

  const result = runCliCapture(["agent", "doctor", "--json", "."], root);

  assert.equal(result.exitCode, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as {
    readonly registry: {
      readonly languages: readonly {
        readonly methods: readonly string[];
        readonly methodDescriptors: readonly {
          readonly method: string;
          readonly command: string;
          readonly outputSchemaIds?: readonly string[];
        }[];
      }[];
    };
  };
  const language = payload.registry.languages[0]!;
  assert.ok(language.methods.includes("evidence/graph"));
  assert.ok(language.methods.includes("evidence/analyze"));
  const analyze = language.methodDescriptors.find(
    (descriptor) => descriptor.method === "evidence/analyze",
  );
  assert.equal(analyze?.command, "evidence");
  assert.deepEqual(analyze?.outputSchemaIds, [
    "agent.semantic-protocols.semantic-graph-turbo-request",
  ]);
});

test("agent guide advertises evidence commands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-evidence-guide-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "guide" }));

  const result = runCliCapture(["agent", "guide"], root);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /evidence graph --json/);
  assert.match(result.stdout, /evidence analyze --json/);
});
