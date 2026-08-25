import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultTypeScriptHarnessConfig,
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarnessAgentCompactText,
  renderTypeScriptProjectHarness,
  renderTypeScriptReasoningTree,
  runTypeScriptProjectHarness,
  typeScriptExtensionPolicyRules,
  withDisabledTypeScriptRulePack,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("Effect dependency activates extension snapshot and async domain advice", () => {
  const root = effectProject("dependency-active", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      'import { Effect } from "effect";',
      "export function loadOwner(): Promise<string> {",
      "  return Promise.resolve('owner');",
      "}",
      "export declare function loadOwnerEffect(): Effect.Effect<string, Error>;",
    ],
  });

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
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
  assert.deepEqual(
    report.projectResolution?.packageJson.packageExtensions.map((extension) => ({
      name: extension.name,
      activation: extension.activation,
      coverage: extension.coverage,
      dependencySource: extension.dependencySource,
    })),
    [
      {
        name: "effect",
        activation: "dependency",
        coverage: "project",
        dependencySource: "dependencies",
      },
    ],
  );
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-EXT-EFFECT-R002:info"],
  );
  assert.match(rendered, /\[TS-EXT-EFFECT-R002\] Info/u);
  assert.match(rendered, /Effect extension is active/u);
  assert.match(snapshot, /Extensions:/u);
  assert.match(
    snapshot,
    /effect activation=dependency capabilities=typed-async,domain-effects,policy/u,
  );
  assert.match(snapshot, /coverage=project/u);
});

test("Effect dependency gives project-wide async migration advice", () => {
  const root = effectProject("dependency-project-wide", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: {
      "retired.ts": [
        "export async function loadRetiredOwner(): Promise<string> {",
        "  return 'owner';",
        "}",
      ],
      "effect-owner.ts": [
        'import { Effect } from "effect";',
        "export async function loadEffectOwner(): Promise<string> {",
        "  return 'owner';",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId === "TS-EXT-EFFECT-R002")
      .map((finding) => `${path.basename(finding.location.path ?? "")}:${finding.severity}`),
    ["effect-owner.ts:info", "retired.ts:info"],
  );
  assert.match(advice, /AgentCompactText: mode=advice findings=2 tasks=1/u);
  assert.match(
    advice,
    /\[TS-EXT-EFFECT-R002\] Info x2: Migrate public async domain APIs to Effect/u,
  );
  assert.match(advice, /raw Promise instead of Effect\.Effect; facts: package\.json Effect/u);
  assert.match(advice, /coverage: project activation=dependency dependency=dependencies/u);
  assert.match(advice, /target_groups:\n   - src\/effect-owner\.ts x1 first=loadEffectOwner/u);
  assert.match(advice, /\n   - src\/retired\.ts x1 first=loadRetiredOwner/u);
  assert.match(advice, /add `import \{ Effect \} from "effect"`/u);
  assert.match(advice, /Effect\.Effect<Success, DomainError, Requirements>/u);
  assert.match(advice, /Effect\.tryPromise\(\{ try: \(\) => promise, catch:/u);
  assert.match(advice, /targets:\n   - @ src\/effect-owner\.ts:\d+:\d+ apis=loadEffectOwner/u);
  assert.doesNotMatch(advice, /RuleIndex:/u);
  assert.doesNotMatch(advice, /Help:/u);
  assert.doesNotMatch(advice, /Contract:/u);
  assert.doesNotMatch(advice, /\n  rule:/u);
  assert.doesNotMatch(advice, /\n  problem:/u);
  assert.doesNotMatch(advice, /\n  facts:/u);
});

test("Effect compact advice is prioritized before generic agent shape advice", () => {
  const root = effectProject("effect-advice-priority", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      "export type OwnerId = string;",
      "export async function loadOwner(ownerId: OwnerId): Promise<string> {",
      "  return ownerId;",
      "}",
    ],
  });

  const report = runTypeScriptProjectHarness(root);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report);

  assert.deepEqual(
    report.findings
      .filter(
        (finding) =>
          finding.ruleId === "TS-EXT-EFFECT-R002" || finding.ruleId === "TS-AGENT-POLICY-010",
      )
      .map((finding) => finding.ruleId)
      .sort(),
    ["TS-AGENT-POLICY-010", "TS-EXT-EFFECT-R002"],
  );
  assert.match(
    advice,
    /RepairTasks:\n- \[TS-EXT-EFFECT-R002\] Info x1: Migrate public async domain APIs to Effect/u,
  );
  assert.match(advice, /\n- \[TS-AGENT-POLICY-010\] Info x1:/u);
});

test("explicit Effect enablement without dependency is an error-level blocking finding", () => {
  const root = effectProject("config-missing-dependency", {
    packageJson: {
      typescriptProjectHarness: { extensions: { Effect: "enable" } },
    },
    source: "export const ok = 1;\n",
  });

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), false);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) => `${finding.ruleId}:${finding.severity}:${finding.label}`),
    ["TS-EXT-EFFECT-R001:error:declare effect before enforcing Effect extension policy"],
  );
  assert.match(rendered, /\[TS-EXT-EFFECT-R001\] Error/u);
  assert.match(rendered, /package\.json enables the Effect extension/u);
  assert.match(snapshot, /effect activation=config-enabled-missing-dependency/u);
});

test("configured Effect dependency is active and can be disabled through the extension pack", () => {
  const root = effectProject("config-active", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
      typescriptProjectHarness: { extensions: { effect: "enable" } },
    },
    source: ["export async function loadOwner(): Promise<string> {", "  return 'owner';", "}"],
  });
  const defaultReport = runTypeScriptProjectHarness(root);
  const configuredReport = runTypeScriptProjectHarness(
    root,
    withDisabledTypeScriptRulePack(defaultTypeScriptHarnessConfig(), "extension_policy"),
  );

  assert.equal(isTypeScriptHarnessClean(defaultReport), true);
  assert.deepEqual(
    defaultReport.projectResolution?.packageJson.packageExtensions.map((extension) => ({
      activation: extension.activation,
      coverage: extension.coverage,
      configSource: extension.configSource,
    })),
    [
      {
        activation: "config-enabled",
        coverage: "project",
        configSource: "typescriptProjectHarness",
      },
    ],
  );
  assert.ok(defaultReport.findings.some((finding) => finding.ruleId === "TS-EXT-EFFECT-R002"));
  assert.ok(
    configuredReport.findings.every((finding) => !finding.ruleId.startsWith("TS-EXT-EFFECT")),
  );
});

test("Effect runtime execution advice stays out of entrypoints", () => {
  const root = effectProject("runtime-boundary", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: {
      "domain.ts": [
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<string>;",
        "export function loadOwner(): Promise<string> {",
        "  return Effect.runPromise(program);",
        "}",
      ],
      "main.ts": [
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<void>;",
        "export function main(): Promise<void> {",
        "  return Effect.runPromise(program);",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map(
        (finding) => `${finding.ruleId}:${finding.severity}:${finding.labels.module_role ?? ""}`,
      ),
    ["TS-EXT-EFFECT-R002:info:source", "TS-EXT-EFFECT-R003:info:source"],
  );
});

test("Effect runtime execution advice treats React Query callbacks as runtime boundaries", () => {
  const root = effectProject("react-query-runtime-boundary", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: {
      "component.ts": [
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<string, Error>;",
        "declare function useQuery(options: {",
        "  readonly queryKey: readonly string[];",
        "  readonly queryFn: () => Promise<string>;",
        "}): unknown;",
        "declare function useMutation(options: {",
        "  readonly mutationFn: () => Promise<string>;",
        "}): unknown;",
        "export function OwnerPanel() {",
        "  const direct = Effect.runPromise(program);",
        "  useQuery({",
        "    queryKey: ['owner'],",
        "    queryFn: () => Effect.runPromise(program),",
        "  });",
        "  useMutation({",
        "    mutationFn() {",
        "      return Effect.runPromise(program);",
        "    },",
        "  });",
        "  return direct;",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) =>
        [
          finding.ruleId,
          finding.severity,
          relativePath(root, finding.location.path ?? ""),
          finding.labels.runtime_calls ?? "",
        ].join(":"),
      ),
    ["TS-EXT-EFFECT-R003:info:src/component.ts:Effect.runPromise"],
  );
});

test("Effect policy treats package script TypeScript targets as entrypoint adapters", () => {
  const root = effectProject("script-entrypoint", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
      scripts: {
        bench: 'RUN_LIVE=1 jiti src/cli/bench.ts --live "$@"',
      },
    },
    source: {
      "cli/bench.ts": [
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<void, Error>;",
        "export function runBench(): Promise<void> {",
        "  return Effect.runPromise(program);",
        "}",
      ],
      "cli/bench-helper.ts": [
        "export async function prepareBench(): Promise<string> {",
        "  return 'ready';",
        "}",
      ],
      "domain.ts": [
        "export async function loadDomainOwner(): Promise<string> {",
        "  return 'owner';",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const roleByPath = new Map(
    report.reasoningTree.modules.map((moduleReport) => [
      relativePath(root, moduleReport.path),
      moduleReport.role,
    ]),
  );

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(roleByPath.get("src/cli/bench.ts"), "entrypoint");
  assert.equal(roleByPath.get("src/cli/bench-helper.ts"), "entrypoint");
  assert.equal(roleByPath.get("src/domain.ts"), "source");
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) =>
        [
          finding.ruleId,
          finding.severity,
          relativePath(root, finding.location.path ?? ""),
          finding.labels.module_role ?? "",
        ].join(":"),
      ),
    ["TS-EXT-EFFECT-R002:info:src/domain.ts:source"],
  );
});

test("Effect policy treats parser-visible HTTP middleware adapters as entrypoint boundaries", () => {
  const root = effectProject("http-adapter-entrypoint", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: {
      "node-http.d.ts": [
        'declare module "node:http" {',
        "  export interface IncomingMessage {}",
        "  export interface ServerResponse {}",
        "}",
      ],
      "server/http/wendaoApi.ts": [
        'import type { IncomingMessage, ServerResponse } from "node:http";',
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<string, Error>;",
        "export function createWendaoApiMiddleware(): (",
        "  request: IncomingMessage,",
        "  response: ServerResponse,",
        ") => void {",
        "  return () => {",
        "    void Effect.runPromise(program);",
        "  };",
        "}",
      ],
      "domain.ts": [
        "export async function loadDomainOwner(): Promise<string> {",
        "  return 'owner';",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const roleByPath = new Map(
    report.reasoningTree.modules.map((moduleReport) => [
      relativePath(root, moduleReport.path),
      moduleReport.role,
    ]),
  );

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(roleByPath.get("src/server/http/wendaoApi.ts"), "entrypoint");
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) =>
        [
          finding.ruleId,
          finding.severity,
          relativePath(root, finding.location.path ?? ""),
          finding.labels.module_role ?? "",
        ].join(":"),
      ),
    ["TS-EXT-EFFECT-R002:info:src/domain.ts:source"],
  );
});

test("Effect object config remains project-wide and does not suppress modules", () => {
  const root = effectProject("object-config-project-wide", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
      typescriptProjectHarness: {
        extensions: {
          effect: {
            enabled: true,
            adapterModules: ["src/adapters/**/*.ts", "src/*.functions.ts"],
          },
        },
      },
    },
    source: {
      "adapters/http.ts": [
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<string, Error>;",
        "export function handleHttp(): Promise<string> {",
        "  return Effect.runPromise(program);",
        "}",
      ],
      "domain.ts": [
        'import { Effect } from "effect";',
        "declare const program: Effect.Effect<string, Error>;",
        "export function loadDomain(): Promise<string> {",
        "  return Effect.runPromise(program);",
        "}",
      ],
      "query.functions.ts": [
        "export async function loadQuery(): Promise<string> {",
        "  return 'query';",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.projectResolution?.packageJson.packageExtensions.map((extension) => [
      extension.activation,
      extension.coverage,
      extension.configSource,
    ]),
    [["config-enabled", "project", "typescriptProjectHarness"]],
  );
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) =>
        [
          finding.ruleId,
          finding.severity,
          relativePath(root, finding.location.path ?? ""),
          finding.labels.module_role ?? "",
        ].join(":"),
      ),
    [
      "TS-EXT-EFFECT-R002:info:src/adapters/http.ts:source",
      "TS-EXT-EFFECT-R002:info:src/domain.ts:source",
      "TS-EXT-EFFECT-R002:info:src/query.functions.ts:source",
      "TS-EXT-EFFECT-R003:info:src/adapters/http.ts:source",
      "TS-EXT-EFFECT-R003:info:src/domain.ts:source",
    ],
  );
  assert.match(snapshot, /config=typescriptProjectHarness/u);
  assert.doesNotMatch(snapshot, /adapters=/u);
});

test("Effect service methods with requirement leaks receive layer-boundary advice", () => {
  const root = effectProject("service-requirements", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      'import { Effect } from "effect";',
      "export interface OwnerService {",
      "  load(id: string): Effect.Effect<string, Error, OwnerRepository>;",
      "  save(id: string): Effect.Effect<void, Error, never>;",
      "}",
    ],
  });

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map((finding) => `${finding.ruleId}:${finding.severity}:${finding.labels.method ?? ""}`),
    ["TS-EXT-EFFECT-R004:info:load"],
  );
});

test("Effect public APIs with weak error channels receive typed-error advice", () => {
  const root = effectProject("typed-errors", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      'import { Effect } from "effect";',
      "export declare function loadOwner(): Effect.Effect<string, string, never>;",
      "export interface OwnerService {",
      "  save(id: string): Effect.Effect<void, unknown, never>;",
      "  remove(id: string): Effect.Effect<void, OwnerError, never>;",
      "}",
    ],
  });

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map(
        (finding) => `${finding.ruleId}:${finding.severity}:${finding.labels.error_surfaces ?? ""}`,
      ),
    ["TS-EXT-EFFECT-R005:info:loadOwner,OwnerService.save"],
  );
});

test("Effect.promise rejection-capable interop receives tryPromise advice", () => {
  const root = effectProject("promise-interop", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      'import { Effect } from "effect";',
      "export const loadOwner = Effect.promise(async () => {",
      "  if (Math.random() > 0.5) {",
      "    throw new Error('boom');",
      "  }",
      "  return 'owner';",
      "}).pipe(Effect.withSpan('owner.load'), Effect.timeout('1 second'));",
    ],
  });

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map(
        (finding) =>
          `${finding.ruleId}:${finding.severity}:${finding.labels.promise_interop ?? ""}`,
      ),
    ["TS-EXT-EFFECT-R006:info:loadOwner"],
  );
});

test("Effect.acquireRelease without local scoped boundary receives resource advice", () => {
  const root = effectProject("resource-scope", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      'import { Effect } from "effect";',
      "declare const acquireOwner: Effect.Effect<string, OwnerOpenError, never>;",
      "declare const releaseOwner: (owner: string) => Effect.Effect<void, never, never>;",
      "export const ownerResource = Effect.acquireRelease(acquireOwner, releaseOwner);",
      "export const scopedOwnerResource = Effect.scoped(",
      "  Effect.acquireRelease(acquireOwner, releaseOwner)",
      ");",
    ],
  });

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-EFFECT"))
      .map(
        (finding) => `${finding.ruleId}:${finding.severity}:${finding.labels.resource_scope ?? ""}`,
      ),
    ["TS-EXT-EFFECT-R007:info:ownerResource"],
  );
});

test("Effect async batch advice asks agents to declare concurrency policy", () => {
  const root = effectProject("concurrency-policy", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: [
      'import { Effect } from "effect";',
      "declare function loadOne(id: string): Promise<string>;",
      "declare function loadOneEffect(id: string): Effect.Effect<string, Error>;",
      "export async function loadAllOwners(ids: readonly string[]): Promise<readonly string[]> {",
      "  return Promise.all(ids.map((id) => loadOne(id)));",
      "}",
      "export async function loadOwnersSequentially(ids: readonly string[]): Promise<readonly string[]> {",
      "  const owners: string[] = [];",
      "  for (const id of ids) {",
      "    owners.push(await loadOne(id));",
      "  }",
      "  return owners;",
      "}",
      "export function loadOwnerEffects(ids: readonly string[]): Effect.Effect<readonly string[], Error> {",
      "  return Effect.forEach(ids, loadOneEffect);",
      "}",
      "export function loadOwnerEffectsWithBudget(ids: readonly string[]): Effect.Effect<readonly string[], Error> {",
      "  return Effect.forEach(ids, loadOneEffect, { concurrency: 4 });",
      "}",
    ],
  });

  const report = runTypeScriptProjectHarness(root);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report);
  const finding = report.findings.find((candidate) => candidate.ruleId === "TS-EXT-EFFECT-R008");

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.notEqual(finding, undefined);
  assert.equal(
    finding?.labels.concurrency_kinds,
    "effect-combinator-missing-concurrency,promise-combinator,sequential-await-loop",
  );
  assert.match(
    finding?.labels.concurrency_signals ?? "",
    /loadAllOwners:Promise\.all.*loadOwnersSequentially:for-of-await.*loadOwnerEffects:Effect\.forEach/u,
  );
  assert.doesNotMatch(finding?.labels.concurrency_signals ?? "", /loadOwnerEffectsWithBudget/u);
  assert.match(
    advice,
    /\[TS-EXT-EFFECT-R008\] Info x1: Declare Effect concurrency and failure policy for async batches/u,
  );
  assert.match(
    advice,
    /Effect\.forEach\(items, item => workEffect\(item\), \{ concurrency: n \}\)/u,
  );
  assert.match(advice, /Effect\.all\(effects, \{ concurrency: n \}\)/u);
  assert.match(advice, /Effect\.allSuccesses/u);
  assert.match(advice, /concurrency budget/u);
});

test("Effect JSON boundary advice asks agents to decode with Schema", () => {
  const root = effectProject("schema-boundary", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: {
      "json-boundary.ts": [
        'import { Effect, Schema } from "effect";',
        "declare const Owner: Schema.Schema<{ readonly id: string }>;",
        "export async function loadRawOwner(response: { json(): Promise<unknown> }): Promise<unknown> {",
        "  return response.json();",
        "}",
        "export function parseRawOwner(text: string): Effect.Effect<unknown, Error> {",
        "  return Effect.tryPromise({",
        "    try: async () => JSON.parse(text),",
        "    catch: (cause) => new Error('invalid owner', { cause }),",
        "  });",
        "}",
        "export async function loadDecodedOwner(response: { json(): Promise<unknown> }): Promise<unknown> {",
        "  const payload = await response.json();",
        "  return Schema.decodeUnknownSync(Owner)(payload);",
        "}",
        "export const parseRawOwnerProgram = Effect.tryPromise({",
        '  try: async () => JSON.parse(\'{"id":"owner-1"}\'),',
        "  catch: (cause) => new Error('invalid owner', { cause }),",
        "});",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const finding = report.findings.find((candidate) => candidate.ruleId === "TS-EXT-EFFECT-R009");
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report, { findings: "all" });

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(finding?.severity, "info");
  assert.equal(
    finding?.labels.schema_boundary_kinds,
    "json-parse-without-schema,response-json-without-schema",
  );
  assert.match(finding?.labels.schema_boundary ?? "", /loadRawOwner/u);
  assert.match(finding?.labels.schema_boundary ?? "", /parseRawOwner/u);
  assert.match(finding?.labels.schema_boundary ?? "", /parseRawOwnerProgram/u);
  assert.doesNotMatch(finding?.labels.schema_boundary ?? "", /loadDecodedOwner/u);
  assert.match(
    advice,
    /\[TS-EXT-EFFECT-R009\] Info x1: Decode JSON boundaries with Effect Schema/u,
  );
  assert.match(advice, /Schema\.decodeUnknown/u);
  assert.match(advice, /Schema\.parseJson/u);
});

test("Effect production boundary advice asks agents for observability and resilience", () => {
  const root = effectProject("production-boundary", {
    packageJson: {
      dependencies: { effect: "^3.0.0" },
    },
    source: {
      "production-boundary.ts": [
        'import { Effect, Metric, Schedule } from "effect";',
        "declare const httpDuration: Metric.Metric<number>;",
        "declare function requestOwner(id: string): Promise<string>;",
        "export const loadOwnerRaw = (id: string) =>",
        "  Effect.tryPromise({",
        "    try: () => requestOwner(id),",
        "    catch: (cause) => new Error('owner request failed', { cause }),",
        "  });",
        "export const loadOwnerWithPolicy = (id: string) =>",
        "  Metric.trackDuration(",
        "    Effect.tryPromise({",
        "      try: () => requestOwner(id),",
        "      catch: (cause) => new Error('owner request failed', { cause }),",
        "    }).pipe(",
        "      Effect.withSpan('owner.load'),",
        "      Effect.retry(Schedule.exponential('100 millis')),",
        "      Effect.timeout('2 seconds'),",
        "    ),",
        "    httpDuration,",
        "  );",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const finding = report.findings.find((candidate) => candidate.ruleId === "TS-EXT-EFFECT-R010");
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report, { findings: "all" });

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(finding?.severity, "info");
  assert.equal(finding?.labels.missing_capabilities, "observability,resilience");
  assert.match(finding?.labels.production_boundary ?? "", /loadOwnerRaw/u);
  assert.doesNotMatch(finding?.labels.production_boundary ?? "", /loadOwnerWithPolicy/u);
  assert.match(
    advice,
    /\[TS-EXT-EFFECT-R010\] Info x1: Add production policy to Effect external IO boundaries/u,
  );
  assert.match(advice, /Effect\.withSpan/u);
  assert.match(advice, /Effect\.retry\(Schedule\.exponential/u);
  assert.match(advice, /Effect\.timeout/u);
  assert.match(advice, /Metric\.trackDuration/u);
});

function effectProject(
  name: string,
  options: {
    readonly packageJson: Record<string, unknown>;
    readonly source:
      | string
      | readonly string[]
      | Readonly<Record<string, string | readonly string[]>>;
  },
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asp-typescript-effect-${name}-`));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: `@example/${name}`, type: "module", ...options.packageJson }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        lib: ["ES2020"],
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2020",
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "effect.d.ts"),
    [
      'declare module "effect" {',
      "  export namespace Effect {",
      "    export type Effect<Success = unknown, Failure = never, Requirements = never> = {",
      "      readonly _success?: Success;",
      "      readonly _failure?: Failure;",
      "      readonly _requirements?: Requirements;",
      "      readonly pipe: <Result>(...fns: ReadonlyArray<(effect: Effect<Success, Failure, Requirements>) => Result>) => Result;",
      "    };",
      "    export function runPromise<Success>(effect: Effect<Success, unknown, unknown>): Promise<Success>;",
      "    export function promise<Success>(thunk: () => Promise<Success>): Effect<Success, unknown, never>;",
      "    export function tryPromise<Success, Failure>(options: {",
      "      readonly try: () => Promise<Success>;",
      "      readonly catch: (cause: unknown) => Failure;",
      "    }): Effect<Success, Failure, never>;",
      "    export function retry<Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "      policy: unknown,",
      "    ): Effect<Success, Failure, Requirements>;",
      "    export function retry(policy: unknown): <Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "    ) => Effect<Success, Failure, Requirements>;",
      "    export function timeout<Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "      duration: string,",
      "    ): Effect<Success, Failure, Requirements>;",
      "    export function timeout(duration: string): <Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "    ) => Effect<Success, Failure, Requirements>;",
      "    export function withSpan<Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "      name: string,",
      "    ): Effect<Success, Failure, Requirements>;",
      "    export function withSpan(name: string): <Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "    ) => Effect<Success, Failure, Requirements>;",
      "    export function acquireRelease<Success, Failure, Requirements>(",
      "      acquire: Effect<Success, Failure, Requirements>,",
      "      release: (value: Success) => Effect<void, never, never>,",
      "    ): Effect<Success, Failure, Requirements>;",
      "    export function scoped<Success, Failure, Requirements>(",
      "      effect: Effect<Success, Failure, Requirements>,",
      "    ): Effect<Success, Failure, Requirements>;",
      "    export function all<Success, Failure, Requirements>(",
      "      effects: Iterable<Effect<Success, Failure, Requirements>>,",
      "      options?: { readonly concurrency?: number | 'unbounded' },",
      "    ): Effect<readonly Success[], Failure, Requirements>;",
      "    export function allSuccesses<Success, Failure, Requirements>(",
      "      effects: Iterable<Effect<Success, Failure, Requirements>>,",
      "      options?: { readonly concurrency?: number | 'unbounded' },",
      "    ): Effect<readonly Success[], never, Requirements>;",
      "    export function forEach<Item, Success, Failure, Requirements>(",
      "      items: Iterable<Item>,",
      "      f: (item: Item) => Effect<Success, Failure, Requirements>,",
      "      options?: { readonly concurrency?: number | 'unbounded' },",
      "    ): Effect<readonly Success[], Failure, Requirements>;",
      "  }",
      "  export namespace Runtime {",
      "    export function runPromise<Success>(effect: Effect.Effect<Success, unknown, unknown>): Promise<Success>;",
      "  }",
      "  export namespace Metric {",
      "    export interface Metric<A> { readonly _A?: A }",
      "    export function trackDuration<Success, Failure, Requirements>(",
      "      effect: Effect.Effect<Success, Failure, Requirements>,",
      "      metric: Metric<number>,",
      "    ): Effect.Effect<Success, Failure, Requirements>;",
      "  }",
      "  export namespace Schedule {",
      "    export function exponential(duration: string): unknown;",
      "  }",
      "  export namespace Schema {",
      "    export interface Schema<A> { readonly _A?: A }",
      "    export function decodeUnknown<A>(schema: Schema<A>): (input: unknown) => Effect.Effect<A, Error, never>;",
      "    export function decodeUnknownSync<A>(schema: Schema<A>): (input: unknown) => A;",
      "    export function parseJson<A>(schema: Schema<A>): Schema<A>;",
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  if (isSourceFileMap(options.source)) {
    for (const [fileName, source] of Object.entries(options.source)) {
      fs.mkdirSync(path.dirname(path.join(root, "src", fileName)), { recursive: true });
      fs.writeFileSync(path.join(root, "src", fileName), sourceText(source));
    }
  } else {
    fs.writeFileSync(path.join(root, "src", "index.ts"), sourceText(options.source));
  }
  return root;
}

function sourceText(source: string | readonly string[]): string {
  return typeof source === "string" ? source : source.join("\n");
}

function isSourceFileMap(
  source: string | readonly string[] | Readonly<Record<string, string | readonly string[]>>,
): source is Readonly<Record<string, string | readonly string[]>> {
  return typeof source === "object" && !Array.isArray(source);
}
