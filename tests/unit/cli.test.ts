import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { hasCommand, runCliCapture } from "./cli_helpers.js";
test("CLI exposes only search, check, and agent protocol entrypoints", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-cli-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const compact = runCliCapture(["check", "--full", "."], root);
  assert.equal(compact.exitCode, 0);
  assert.match(compact.stdout, /^\[ok\] typescript/u);

  const json = runCliCapture(["check", "--json", "."], root);
  assert.equal(json.exitCode, 0);
  const jsonReport = JSON.parse(json.stdout) as {
    readonly modules: readonly unknown[];
    readonly reasoningTree: { readonly runMode: string };
    readonly runMode: string;
  };
  assert.equal(jsonReport.runMode, "project");
  assert.equal(jsonReport.reasoningTree.runMode, "project");
  assert.equal(jsonReport.modules.length, 1);

  const noTsconfig = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-cli-no-config-"));
  fs.mkdirSync(path.join(noTsconfig, "src"));
  fs.writeFileSync(path.join(noTsconfig, "src", "index.ts"), "export const ok = 1;\n");
  const changed = runCliCapture(["check", "--changed", "."], noTsconfig);
  assert.equal(changed.exitCode, 0);
  assert.match(changed.stdout, /^\[ok\] typescript/u);
  assert.doesNotMatch(changed.stdout, /\[TS-AGENT-PROJECT-001\] Info/u);

  for (const retiredArgv of [
    ["."],
    ["--json", "."],
    ["--agent-compact", "."],
    ["--agent-snapshot", "."],
    ["--tree", "."],
    ["--stats", "."],
    ["--harness", "."],
  ]) {
    const invalid = runCliCapture(retiredArgv, root);
    assert.equal(invalid.exitCode, 2);
    assert.match(invalid.stderr, /unknown (command|option)/u);
  }
});

test("CLI search uses fast syntax reasoning while check keeps semantic diagnostics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-search-fast-path-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true }, include: ["src/**/*.ts"] }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const value: string = 1;\n");

  const search = runCliCapture(["search", "prime", "--json", "--workspace", "."], root);
  assert.equal(search.exitCode, 0);
  const packet = JSON.parse(search.stdout) as {
    readonly findings: readonly { readonly ruleId: string }[];
  };
  assert.ok(
    packet.findings.every((finding) => finding.ruleId !== "TS-SEM-R001"),
    "search should not spend the fast path collecting semantic diagnostics",
  );

  const check = runCliCapture(["check", "--full", "."], root);
  assert.equal(check.exitCode, 0);
  assert.match(check.stdout, /TS-SEM-R001/u);

  const changed = runCliCapture(["check", "--changed", "."], root);
  assert.equal(changed.exitCode, 0);
  assert.match(changed.stdout, /^\[ok\] typescript/u);
  assert.doesNotMatch(changed.stdout, /TS-SEM-R001/u);
});

test("lexical query-set explains fixture paths and synthesizes real owners", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-search-fixture-resolution-"));
  const missingHookEvent = ["Agent", "Hook", "Event"].join("");
  const codexHookFunction = ["run", "Codex", "Agent", "Hook"].join("");
  const protocolRunner = ["run", "Protocol", "Cli"].join("");
  const protocolParser = ["parse", "Protocol", "Args"].join("");
  fs.mkdirSync(path.join(root, "src", "cli"), { recursive: true });
  fs.mkdirSync(path.join(root, "tests", "unit"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts", "tests/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "src", "cli", "protocol.ts"),
    [
      "export interface ProtocolArgs { readonly ok: boolean; }",
      "export function parseProtocolArgs(argv: readonly string[]): ProtocolArgs | undefined {",
      "  return argv.length > 0 ? { ok: true } : undefined;",
      "}",
      "export function runProtocolCli(args: ProtocolArgs): string {",
      "  return args.ok ? 'ok' : 'no';",
      "}",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "tests", "unit", "cli.test.ts"),
    [
      'import fs from "node:fs";',
      'import path from "node:path";',
      'const transitiveTestsRoot = "fixture";',
      'fs.writeFileSync(path.join(transitiveTestsRoot, "src", "cli", "agent-hooks.ts"),',
      `  "export function ${codexHookFunction}(): string { return 'ok'; }\\n",`,
      ");",
      'fs.writeFileSync(path.join(transitiveTestsRoot, "src", "cli", "protocol.ts"),',
      `  "import { ${codexHookFunction} } from \\"./agent-hooks.js\\";\\nexport function ${protocolRunner}(): string { return ${codexHookFunction}(); }\\n",`,
      ");",
    ].join("\n"),
  );

  const fixtureJson = runCliCapture(
    [
      "search",
      "lexical",
      "--query-set",
      missingHookEvent,
      "--query-set",
      codexHookFunction,
      "owner",
      "tests",
      "--json",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(fixtureJson.exitCode, 0, fixtureJson.stderr);
  const packet = JSON.parse(fixtureJson.stdout) as {
    readonly queryCoverage: readonly {
      readonly value: string;
      readonly status: string;
      readonly surfaces?: readonly string[];
      readonly fixturePaths?: readonly string[];
    }[];
    readonly ownerResolution: readonly {
      readonly target: string;
      readonly status: string;
      readonly realOwner: boolean;
    }[];
    readonly searchSynthesis: {
      readonly editFrontier?: readonly string[];
      readonly testFrontier?: readonly string[];
      readonly seeds: readonly { readonly kind: string; readonly target: string }[];
    };
    readonly avoidNextActions: readonly {
      readonly kind: string;
      readonly target: string;
      readonly reason: string;
    }[];
  };
  assert.deepEqual(
    packet.queryCoverage.map((coverage) => [coverage.value, coverage.status]),
    [
      [missingHookEvent, "miss"],
      [codexHookFunction, "hit"],
    ],
  );
  const codexHookCoverage = packet.queryCoverage.find(
    (coverage) => coverage.value === codexHookFunction,
  );
  assert.ok(codexHookCoverage?.surfaces?.includes("test-fixture-string"));
  assert.ok(codexHookCoverage?.fixturePaths?.includes("src/cli/agent-hooks.ts"));
  assert.ok(codexHookCoverage?.fixturePaths?.includes("src/cli/protocol.ts"));
  const agentHookResolution = packet.ownerResolution.find(
    (resolution) => resolution.target === "src/cli/agent-hooks.ts",
  );
  assert.equal(agentHookResolution?.status, "fixture-path");
  assert.equal(agentHookResolution?.realOwner, false);
  assert.equal(
    packet.ownerResolution.find((resolution) => resolution.target === "src/cli/protocol.ts")
      ?.status,
    "workspace-owner",
  );
  assert.ok(
    packet.avoidNextActions.some(
      (action) =>
        action.kind === "owner" &&
        action.target === "src/cli/agent-hooks.ts" &&
        action.reason === "fixture-path-not-workspace-owner",
    ),
  );
  assert.ok(
    packet.searchSynthesis.seeds.some(
      (seed) => seed.kind === "symbol" && seed.target === protocolRunner,
    ),
  );
  assert.ok(
    packet.searchSynthesis.seeds.some(
      (seed) => seed.kind === "symbol" && seed.target === protocolParser,
    ),
  );
  assert.ok(
    packet.searchSynthesis.seeds.some(
      (seed) => seed.kind === "owner" && seed.target === "src/cli/protocol.ts",
    ),
  );
  assert.ok(packet.searchSynthesis.editFrontier?.includes("src/cli/protocol.ts"));
  assert.ok(packet.searchSynthesis.testFrontier?.includes("tests/unit/cli.test.ts"));

  const fixtureSeeds = runCliCapture(
    [
      "search",
      "lexical",
      "--query-set",
      missingHookEvent,
      "--query-set",
      codexHookFunction,
      "owner",
      "tests",
      "--view",
      "seeds",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(fixtureSeeds.exitCode, 0, fixtureSeeds.stderr);
  assert.match(fixtureSeeds.stdout, /querySet=2/u);
  assert.match(fixtureSeeds.stdout, /selector=lexical-set/u);
  assert.match(
    fixtureSeeds.stdout,
    new RegExp(`S=symbol:symbol\\(${protocolRunner}\\)(?:@[^!]+)?!symbol`, "u"),
  );
  assert.match(
    fixtureSeeds.stdout,
    new RegExp(`S2=symbol:symbol\\(${protocolParser}\\)(?:@[^!]+)?!symbol`, "u"),
  );
  assert.doesNotMatch(fixtureSeeds.stdout, /\|query |\|seed |\|avoid /u);
});

test("lexical search prefilter scopes parser input and keeps requested owner", () => {
  if (!hasCommand("rg")) return;

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-search-prefilter-"));
  fs.mkdirSync(path.join(root, "packages", "feature", "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "packages", "other", "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["packages/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "feature", "src", "owner.ts"),
    "export const ownerOnly = true;\n",
  );
  for (let index = 0; index < 140; index++) {
    fs.writeFileSync(
      path.join(root, "packages", "feature", "src", `candidate-${index}.ts`),
      `export const featureNeedle${index} = "TargetNeedle";\n`,
    );
    fs.writeFileSync(
      path.join(root, "packages", "other", "src", `candidate-${index}.ts`),
      `export const otherNeedle${index} = "TargetNeedle";\n`,
    );
  }

  const search = runCliCapture(
    [
      "search",
      "lexical",
      "--query-set",
      "TargetNeedle",
      "--package",
      "packages/feature",
      "--json",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(search.exitCode, 0, search.stderr);
  const packet = JSON.parse(search.stdout) as {
    readonly runtimeCost?: {
      readonly sourceFilesParsed?: number;
      readonly fields?: {
        readonly candidateFiles?: number;
        readonly matchedFiles?: number;
        readonly minCandidateFiles?: number;
      };
    };
    readonly hits: readonly { readonly location: { readonly path: string } }[];
  };
  assert.ok(packet.hits.length > 0);
  assert.ok(
    packet.hits.every((hit) => hit.location.path.startsWith("packages/feature/")),
    "package-scoped prefilter must not parse hits from sibling package paths",
  );
});

test("CLI ranks workspace packages before test fixtures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-workspace-ranking-cli-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@example/root" }));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    ["packages:", "  - 'packages/*'", "  - 'packages/**/__tests__/**'"].join("\n"),
  );
  for (const name of ["core", "vite", "z-alpha", "z-beta"]) {
    const packageRoot = path.join(root, "packages", name);
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ name: `@example/${name}` }),
    );
  }
  for (let index = 0; index < 30; index += 1) {
    const fixtureRoot = path.join(
      root,
      "packages",
      "vite",
      "src",
      "node",
      "__tests__",
      "fixtures",
      `fixture-${String(index).padStart(2, "0")}`,
    );
    fs.mkdirSync(fixtureRoot, { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "package.json"),
      JSON.stringify({ name: `@example/fixture-${index}` }),
    );
  }

  const workspace = runCliCapture(["search", "workspace", "--workspace", "."], root);

  assert.equal(workspace.exitCode, 0);
  assert.match(workspace.stdout, /\bmode=workspace-index\b/u);
  const packageIds = workspace.stdout
    .split("\n")
    .filter((line) => line.startsWith("|package ") && !line.startsWith("|package . "))
    .map((line) => line.split(" ")[1]);
  assert.deepEqual(packageIds.slice(0, 4), [
    "packages/core",
    "packages/vite",
    "packages/z-alpha",
    "packages/z-beta",
  ]);
  assert.match(workspace.stdout, /\|package packages\/z-alpha .*surface=source/u);
  assert.match(
    workspace.stdout,
    /\|package packages\/vite\/src\/node\/__tests__\/fixtures\/fixture-00 .*surface=test/u,
  );
});

test("CLI reports root asp owner for hook install and runtime", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-agent-hooks-cli-"));

  const install = runCliCapture(["agent", "install", "--client", "codex", "."], root);
  assert.equal(install.exitCode, 2);
  assert.equal(install.stdout, "");
  assert.match(install.stderr, /ts-harness agent install moved to asp/u);
  assert.match(install.stderr, /asp hook install --client codex/u);

  const hook = runCliCapture(
    ["agent", "hook", "--client", "codex", "pre-tool", "."],
    root,
    JSON.stringify({ tool_name: "Read", tool_input: { file_path: "src/index.ts" } }),
  );
  assert.equal(hook.exitCode, 2);
  assert.equal(hook.stdout, "");
  assert.match(hook.stderr, /ts-harness agent hook moved to asp/u);
  assert.match(hook.stderr, /asp hook <event> --client codex/u);

  const guide = runCliCapture(["agent", "guide", "."], root);
  assert.equal(guide.exitCode, 0);
  assert.match(guide.stdout, /^\[ts-harness-guide\] project=/u);
  assert.match(
    guide.stdout,
    /\|catalog reasoningProfiles=owner-query,query-deps,owner-tests,finding-frontier,feature-cfg entries=owner-query,query-deps,owner-tests routes=syntax-locate,exact-source,callable-skeleton/u,
  );
  assert.match(
    guide.stdout,
    /\|route syntax-locate selectors=S:tree-sitter-query,Scope:owner-or-structural returns=locator,capture,frontier code=false/u,
  );
  assert.match(guide.stdout, /\|route exact-source selectors=R:exact-selector returns=source/u);
  assert.match(guide.stdout, /\|route callable-skeleton selectors=R:exact-callable-selector/u);
  assert.match(
    guide.stdout,
    /\|cmd prime=asp typescript search prime --workspace <workspace-root> --view seeds/u,
  );
  assert.match(
    guide.stdout,
    /asp typescript search lexical --query <seed> --query <seed> owner tests --workspace <workspace-root> --view seeds/u,
  );
  assert.doesNotMatch(guide.stdout, /\|cmd prime=asp typescript search prime --view seeds \//u);
  assert.doesNotMatch(guide.stdout, /--view seeds\s+--workspace <workspace-root>/u);
  assert.match(guide.stdout, /agent hook install\/runtime is owned by asp/u);
  assert.doesNotMatch(guide.stdout, /README|SKILL|docs\/|src\/cli\/agent-hooks/u);

  const guideWithClient = runCliCapture(["agent", "guide", "--client", "claude", "."], root);
  assert.equal(guideWithClient.exitCode, 0);
  assert.match(guideWithClient.stdout, /^\[ts-harness-guide\] project=/u);
});
