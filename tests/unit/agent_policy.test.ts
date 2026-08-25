import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarness,
  runTypeScriptProjectHarness,
  typeScriptAgentPolicyRules,
  typeScriptExtensionPolicyRules,
  typeScriptModularityRules,
  typeScriptRulePackDescriptors,
  typeScriptSemanticRules,
  typeScriptTestLayoutRules,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("rule catalog keeps deterministic pack order and agent advice severity", () => {
  assert.deepEqual(
    typeScriptRulePackDescriptors().map((pack) => `${pack.id}:${pack.defaultMode}`),
    [
      "typescript.syntax:blocking",
      "typescript.semantic:advisory",
      "typescript.project_policy:blocking",
      "typescript.modularity:advisory",
      "typescript.test_layout:advisory",
      "typescript.agent_policy:advisory",
      "typescript.extension_policy:blocking",
    ],
  );
  assert.deepEqual(
    typeScriptModularityRules().map((rule) => `${rule.ruleId}:${rule.severity}`),
    ["TS-MOD-R001:info", "TS-MOD-R002:info"],
  );
  assert.deepEqual(
    typeScriptSemanticRules().map((rule) => `${rule.ruleId}:${rule.severity}`),
    ["TS-SEM-R001:info"],
  );
  assert.deepEqual(
    typeScriptTestLayoutRules().map((rule) => `${rule.ruleId}:${rule.severity}`),
    ["TS-TEST-R001:info"],
  );
  assert.deepEqual(
    typeScriptAgentPolicyRules().map((rule) => `${rule.ruleId}:${rule.severity}`),
    [
      "TS-AGENT-POLICY-001:info",
      "TS-AGENT-POLICY-002:info",
      "TS-AGENT-POLICY-003:info",
      "TS-AGENT-POLICY-004:info",
      "TS-AGENT-POLICY-005:info",
      "TS-AGENT-POLICY-006:info",
      "TS-AGENT-POLICY-007:info",
      "TS-AGENT-POLICY-008:info",
      "TS-AGENT-POLICY-009:info",
      "TS-AGENT-POLICY-010:info",
      "TS-AGENT-POLICY-011:info",
      "TS-AGENT-POLICY-012:info",
      "TS-AGENT-POLICY-013:info",
      "TS-AGENT-POLICY-014:info",
      "TS-AGENT-POLICY-015:info",
      "TS-AGENT-POLICY-016:info",
    ],
  );
  assert.deepEqual(
    typeScriptExtensionPolicyRules().map((rule) => `${rule.ruleId}:${rule.severity}`),
    [
      "TS-EXT-EFFECT-R001:error",
      "TS-EXT-EFFECT-R002:info",
      "TS-EXT-EFFECT-R003:info",
      "TS-EXT-EFFECT-R004:info",
      "TS-EXT-EFFECT-R005:info",
      "TS-EXT-EFFECT-R006:info",
      "TS-EXT-EFFECT-R007:info",
      "TS-EXT-EFFECT-R008:info",
      "TS-EXT-EFFECT-R009:info",
      "TS-EXT-EFFECT-R010:info",
      "TS-EXT-EFFECT-R011:warning",
      "TS-EXT-EFFECT-R012:warning",
      "TS-EXT-EFFECT-R013:warning",
      "TS-EXT-REACT-R001:error",
      "TS-EXT-REACT-R002:info",
      "TS-EXT-REACT-R003:error",
      "TS-EXT-REACT-R004:info",
      "TS-EXT-SHADCN-R001:error",
      "TS-EXT-SHADCN-R002:info",
      "TS-EXT-SHADCN-R003:info",
    ],
  );
});

test("agent policy reports unresolved project imports without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@app/*": ["src/*"],
        },
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    ['import "./missing.js";', 'import "#missing";', 'import "@app/missing";'].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    typeScriptAgentPolicyRules().map((rule) => rule.ruleId),
    [
      "TS-AGENT-POLICY-001",
      "TS-AGENT-POLICY-002",
      "TS-AGENT-POLICY-003",
      "TS-AGENT-POLICY-004",
      "TS-AGENT-POLICY-005",
      "TS-AGENT-POLICY-006",
      "TS-AGENT-POLICY-007",
      "TS-AGENT-POLICY-008",
      "TS-AGENT-POLICY-009",
      "TS-AGENT-POLICY-010",
      "TS-AGENT-POLICY-011",
      "TS-AGENT-POLICY-012",
      "TS-AGENT-POLICY-013",
      "TS-AGENT-POLICY-014",
      "TS-AGENT-POLICY-015",
      "TS-AGENT-POLICY-016",
    ],
  );
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId === "TS-AGENT-POLICY-001")
      .map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-AGENT-POLICY-001:info", "TS-AGENT-POLICY-001:info", "TS-AGENT-POLICY-001:info"],
  );
  assert.match(rendered, /\[TS-AGENT-POLICY-001\] Info/u);
  assert.match(rendered, /Project import '\.\/missing\.js' does not resolve/u);
  assert.match(rendered, /Project import '#missing' does not resolve/u);
  assert.match(rendered, /Project import '@app\/missing' does not resolve/u);
});

test("agent policy reports unresolved package entries without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/package-agent",
      exports: { ".": "./dist/missing.js" },
      imports: { "#missing": "./src/missing.ts" },
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        rootDir: ".",
        outDir: "dist",
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-POLICY-002", "TS-AGENT-POLICY-002"],
  );
  assert.match(rendered, /Package exports '\.' target '\.\/dist\/missing\.js'/u);
  assert.match(rendered, /Package imports '#missing' target '\.\/src\/missing\.ts'/u);
});

test("agent policy reports multi-owner facades without intent docs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-facade-agent-"));
  fs.mkdirSync(path.join(root, "src", "domain"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "transport"), { recursive: true });
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "domain", "model.ts"), "export const model = 1;\n");
  fs.writeFileSync(path.join(root, "src", "transport", "http.ts"), "export const http = 1;\n");
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    [
      'export { model } from "./domain/model.js";',
      'export { http } from "./transport/http.js";',
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-POLICY-003"],
  );
  assert.match(rendered, /Facade re-exports 2 owners without a local intent doc/u);
});

test("agent policy reports missing module docs for broad public surfaces only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-module-doc-agent-"));
  fs.mkdirSync(path.join(root, "src", "domain"), { recursive: true });
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "small.ts"),
    ["export const one = 1;", "export const two = 2;", "export const three = 3;"].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "src", "broad.ts"),
    Array.from({ length: 8 }, (_, index) => `export const broad${index} = ${index};`).join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "src", "documented.ts"),
    [
      "/** Documents the broad module responsibility before exports. */",
      ...Array.from({ length: 8 }, (_, index) => `export const documented${index} = ${index};`),
    ].join("\n"),
  );
  for (const owner of ["alpha", "beta", "gamma"]) {
    fs.writeFileSync(path.join(root, "src", "domain", `${owner}.ts`), `export const ${owner} = 1;`);
  }
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    [
      'export { alpha } from "./domain/alpha.js";',
      'export { beta } from "./domain/beta.js";',
      'export { gamma } from "./domain/gamma.js";',
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const missingDocPaths = report.findings
    .filter((finding) => finding.ruleId === "TS-AGENT-POLICY-013")
    .flatMap((finding) =>
      finding.location.path === undefined ? [] : [relativePath(root, finding.location.path)],
    )
    .sort();

  assert.deepEqual(missingDocPaths, ["src/broad.ts", "src/index.ts"]);
});

test("agent policy reports parser-native public API shape advice without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-api-shape-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "api.ts"),
    [
      "export function loadOwner(",
      "  ownerId: string,",
      "  includeDrafts: boolean,",
      "  forceRefresh: boolean,",
      "  region: string,",
      "  timeoutMs: number,",
      "  traceId: string",
      "): [string, number] {",
      "  return [ownerId, timeoutMs];",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-POLICY-004", "TS-AGENT-POLICY-005", "TS-AGENT-POLICY-006"],
  );
  assert.match(rendered, /multiple flag parameters/u);
  assert.match(rendered, /exposes 6 positional parameters/u);
  assert.match(rendered, /anonymous tuple with primitive elements: string, number/u);
});

test("agent policy reports parser-native algorithm shape advice without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-algorithm-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "algorithm.ts"),
    [
      "export function nestedAlgorithm(value: number): number {",
      "  if (value > 0) {",
      "    if (value > 1) {",
      "      if (value > 2) {",
      "        if (value > 3) {",
      "          if (value > 4) {",
      "            return value;",
      "          }",
      "        }",
      "      }",
      "    }",
      "  }",
      "  return 0;",
      "}",
      "export function broadLinearAlgorithm(value: number): number {",
      ...Array.from({ length: 92 }, (_, index) =>
        index < 30 ? `  const step${index} = value + ${index};` : "  void value;",
      ),
      "  return step29;",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-POLICY-007", "TS-AGENT-POLICY-008"],
  );
  assert.equal(
    report.findings.find((finding) => finding.ruleId === "TS-AGENT-POLICY-007")?.labels
      .softwareCriteria,
    "control-flow.decision-stack",
  );
  assert.equal(
    report.findings.find((finding) => finding.ruleId === "TS-AGENT-POLICY-008")?.labels
      .softwareCriteria,
    "control-flow.broad-linear-phase",
  );
  assert.match(rendered, /hides algorithm shape/u);
  assert.match(rendered, /broadLinearAlgorithm/u);
});

test("agent policy labels parser-native traversal knot advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-traversal-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "algorithm.ts"),
    [
      "export function traverse(groups: readonly (readonly number[])[]): number {",
      "  let total = 0;",
      "  for (const group of groups) {",
      "    for (const value of group) {",
      "      if (value > 10) {",
      "        total += value;",
      "      }",
      "      if (value < 0) {",
      "        total -= value;",
      "      }",
      "      if (value === 0) {",
      "        total += 0;",
      "      }",
      "      if (value === 1) {",
      "        total += 1;",
      "      }",
      "    }",
      "  }",
      "  return total;",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const traversalFinding = report.findings.find(
    (finding) => finding.ruleId === "TS-AGENT-POLICY-007",
  );

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(traversalFinding?.labels.softwareCriteria, "control-flow.traversal-knot");
});

test("agent policy labels parser-native literal dispatch advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-literal-dispatch-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "algorithm.ts"),
    [
      "export function route(kind: string): number {",
      '  if (kind === "alpha") {',
      "    return 1;",
      '  } else if (kind === "beta") {',
      "    return 2;",
      '  } else if (kind === "gamma") {',
      "    return 3;",
      '  } else if (kind === "delta") {',
      "    return 4;",
      "  }",
      "  return 0;",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const dispatchFinding = report.findings.find(
    (finding) => finding.ruleId === "TS-AGENT-POLICY-007",
  );

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(dispatchFinding?.labels.softwareCriteria, "control-flow.literal-dispatch-chain");
  assert.match(dispatchFinding?.summary ?? "", /control-flow\.literal-dispatch-chain/u);
});

test("agent policy reports parser-native public data shape advice without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-data-shape-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "events.ts"),
    [
      "interface Payload { value: unknown }",
      "export interface OwnerEvent {",
      "  ownerId: string;",
      "  requestId: string;",
      "  callbackUrl: string;",
      "  timeoutMs: number;",
      "  enabled: boolean;",
      "  payload: Payload;",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-POLICY-009"],
  );
  assert.match(rendered, /OwnerEvent/u);
  assert.match(rendered, /ownerId: string/u);
  assert.match(rendered, /callbackUrl: string/u);
  assert.match(rendered, /enabled: boolean/u);
});

test("agent policy keeps model schema modules out of public data shape advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-data-shape-model-"));
  fs.mkdirSync(path.join(root, "src", "verification"), { recursive: true });
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "verification", "model.ts"),
    [
      "export interface SchemaFact {",
      "  ownerId: string;",
      "  requestId: string;",
      "  artifactPath: string;",
      "  observedAtMs: number;",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(report.findings, []);
});

test("agent policy reports parser-native public type boundary advice without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-type-boundary-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "events.ts"),
    [
      "/** Domain event types for the owner lifecycle. */",
      "export type OwnerId = string;",
      "export type OwnerState = 'created' | 'deleted';",
      "export interface JobRecord {",
      "  status: string;",
      "  owner: OwnerId;",
      "}",
      "export type OwnerEvent =",
      "  | { kind: 'created'; ownerId: string; requestId: string; timeoutMs: number }",
      "  | { kind: 'deleted'; ownerId: string; reason: string };",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-POLICY-010", "TS-AGENT-POLICY-011", "TS-AGENT-POLICY-012"],
  );
  assert.match(rendered, /OwnerId/u);
  assert.doesNotMatch(rendered, /OwnerState/u);
  assert.match(rendered, /JobRecord/u);
  assert.match(rendered, /status: string/u);
  assert.match(rendered, /OwnerEvent/u);
  assert.match(rendered, /created/u);
  assert.match(rendered, /requestId: string/u);
});

test("agent policy keeps model schema modules out of public type boundary advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-type-boundary-model-"));
  fs.mkdirSync(path.join(root, "src", "verification"), { recursive: true });
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "verification", "model.ts"),
    [
      "/** Verification schema model types. Excluded from type boundary advice by the model-schema rule filter. */",
      "export type OwnerId = string;",
      "export interface SchemaFact {",
      "  status: string;",
      "}",
      "export type SchemaEvent =",
      "  | { kind: 'created'; ownerId: string; requestId: string }",
      "  | { kind: 'deleted'; ownerId: string; reason: string };",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((f) => f.ruleId),
    [],
  );
});
