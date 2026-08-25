import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarnessAgentCompactText,
  renderTypeScriptProjectHarness,
  renderTypeScriptReasoningTree,
  runTypeScriptProjectHarness,
  typeScriptProjectPolicyRules,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("project harness reports malformed package json without throwing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-json-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "package.json"), '{ "name": }\n');
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    typeScriptProjectPolicyRules().map((rule) => `${rule.ruleId}:${rule.severity}`),
    [
      "TS-AGENT-PROJECT-001:warning",
      "TS-AGENT-PROJECT-002:error",
      "TS-AGENT-PROJECT-003:info",
      "TS-AGENT-PROJECT-004:info",
      "TS-AGENT-PROJECT-005:info",
      "TS-AGENT-PROJECT-006:info",
    ],
  );
  assert.deepEqual(
    report.findings.map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-AGENT-PROJECT-003:info"],
  );
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      ownerPath: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "package-json", ownerPath: "package.json" }],
  );
  assert.equal(report.projectResolution?.packageJson.diagnostics.length, 1);
  assert.match(rendered, /\[TS-AGENT-PROJECT-003\] Info/u);
  assert.match(rendered, /package\.json parser diagnostic/u);
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-AGENT-PROJECT-003 x1 first=package\.json/u);
});

test("project harness reports malformed project reference package json without throwing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-reference-package-json-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "packages", "broken"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      references: [{ path: "./packages/broken" }],
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "broken", "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { composite: true, declaration: true },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "packages", "broken", "package.json"), '{ "name": }\n');
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-AGENT-PROJECT-003:info"],
  );
  assert.deepEqual(
    report.projectResolution?.config.projectReferencePackages.map((referencePackage) => ({
      path: relativePath(root, referencePackage.path),
      diagnostics: referencePackage.diagnostics.length,
    })),
    [{ path: "packages/broken", diagnostics: 1 }],
  );
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      ownerPath: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "package-json", ownerPath: "packages/broken/package.json" }],
  );
});

test("project parser records package dependency facts from package json", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-deps-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/package-deps",
      dependencies: { react: "^19.0.0" },
      devDependencies: { typescript: "^5.9.3" },
      peerDependencies: { "@types/react": "^19.0.0" },
      optionalDependencies: { sharp: "^0.34.0" },
    }),
  );
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);

  const dependencies = report.projectResolution?.packageJson.dependencies ?? [];
  assert.deepEqual(
    dependencies.map((dependency) => ({
      name: dependency.name,
      versionRange: dependency.versionRange,
      source: dependency.source,
      path: relativePath(root, dependency.location.path ?? ""),
    })),
    [
      {
        name: "react",
        versionRange: "^19.0.0",
        source: "dependencies",
        path: "package.json",
      },
      {
        name: "typescript",
        versionRange: "^5.9.3",
        source: "devDependencies",
        path: "package.json",
      },
      {
        name: "sharp",
        versionRange: "^0.34.0",
        source: "optionalDependencies",
        path: "package.json",
      },
      {
        name: "@types/react",
        versionRange: "^19.0.0",
        source: "peerDependencies",
        path: "package.json",
      },
    ],
  );
  assert.deepEqual(report.reasoningTree.packageDependencies, dependencies);
});

test("project policy reports referenced package config shape as advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-reference-config-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "packages", "core", "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@example/root" }));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      references: [{ path: "./packages/core" }],
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify({ name: "@example/core" }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(
    path.join(root, "packages", "core", "src", "index.ts"),
    "export const core = 1;\n",
  );

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId === "TS-AGENT-PROJECT-004")
      .map((finding) => `${finding.severity}:${finding.label}`),
    ["info:referenced project config"],
  );
  assert.deepEqual(
    report.projectResolution?.config.projectReferencePackages.map((referencePackage) => ({
      path: relativePath(root, referencePackage.path),
      composite: referencePackage.compilerOptions?.composite,
      declaration: referencePackage.compilerOptions?.declaration,
    })),
    [{ path: "packages/core", composite: false, declaration: false }],
  );
});

test("project policy reports package entry module resolution as advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-resolution-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/package-resolution",
      exports: { ".": "./src/index.ts" },
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "ESNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId === "TS-AGENT-PROJECT-005")
      .map((finding) => `${finding.severity}:${finding.label}`),
    ["info:package entry module resolution"],
  );
  assert.match(
    report.findings.find((finding) => finding.ruleId === "TS-AGENT-PROJECT-005")?.summary ?? "",
    /classic/u,
  );
});

test("project policy uses TypeScript effective module resolution facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-effective-resolution-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/effective-resolution",
      exports: { ".": "./src/index.ts" },
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);

  assert.equal(report.reasoningTree.compilerOptions.moduleResolution, "NodeNext");
  assert.deepEqual(
    report.findings.filter((finding) => finding.ruleId === "TS-AGENT-PROJECT-005"),
    [],
  );
});

test("project harness reports malformed workspace package json without throwing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-workspace-package-json-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "packages", "broken"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/workspace-root",
      workspaces: ["packages/*"],
    }),
  );
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "packages", "broken", "package.json"), '{ "name": }\n');
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-AGENT-PROJECT-003:info"],
  );
  assert.deepEqual(
    report.projectResolution?.packageJson.workspacePackages.map((workspacePackage) => ({
      path: relativePath(root, workspacePackage.path),
      diagnostics: workspacePackage.diagnostics.length,
    })),
    [{ path: "packages/broken", diagnostics: 1 }],
  );
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      ownerPath: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "package-json", ownerPath: "packages/broken/package.json" }],
  );
  const rendered = renderTypeScriptReasoningTree(report);
  assert.match(rendered, /FindingGroups:/u);
  assert.match(rendered, /TS-AGENT-PROJECT-003 x1 first=packages\/broken\/package\.json/u);
});

test("project harness discovers workspace package facts from package json", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-workspace-packages-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "packages", "core"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/workspace-root",
      type: "module",
      workspaces: {
        packages: ["packages/*"],
      },
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify({
      name: "@example/core",
      type: "module",
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { composite: true, declaration: true },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    'import type { Core } from "@example/core";\nexport const ok = 1;\n',
  );

  const report = runTypeScriptProjectHarness(root);
  const packageJson = report.projectResolution?.packageJson;
  assert.ok(packageJson !== undefined);
  assert.deepEqual(
    packageJson.workspacePackages.map((workspacePackage) => ({
      name: workspacePackage.name,
      path: relativePath(root, workspacePackage.path),
      pattern: workspacePackage.pattern,
      configPath: relativePath(root, workspacePackage.configPath ?? ""),
      locationLine: workspacePackage.location.line,
    })),
    [
      {
        name: "@example/core",
        path: "packages/core",
        pattern: "packages/*",
        configPath: "packages/core/tsconfig.json",
        locationLine: 1,
      },
    ],
  );
  assert.deepEqual(
    report.reasoningTree.packageImportOwners.map((owner) => ({
      fromPath: relativePath(root, owner.fromPath),
      moduleSpecifier: owner.moduleSpecifier,
      packageName: owner.packageName,
      packagePath: relativePath(root, owner.packagePath),
      ownerKind: owner.ownerKind,
      via: owner.via,
    })),
    [
      {
        fromPath: "src/index.ts",
        moduleSpecifier: "@example/core",
        packageName: "@example/core",
        packagePath: "packages/core",
        ownerKind: "workspace",
        via: "package-name",
      },
    ],
  );
  const rendered = renderTypeScriptReasoningTree(report);
  assert.match(rendered, /^Modules: source=1 branches=1 deps=1 workspaces=1 findings=1/u);
  assert.match(
    rendered,
    /src\/index\.ts --package-name\/type-import--> packages\/core owner=workspace/u,
  );
});

test("project harness discovers pnpm workspace package facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-pnpm-workspace-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "packages", "core"), { recursive: true });
  fs.mkdirSync(path.join(root, "playground", "demo"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/pnpm-workspace-root",
      type: "module",
    }),
  );
  fs.writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    ["packages:", "  - 'packages/*'", "  - playground/**", "  - '!ignored/*'"].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify({ name: "@example/core" }),
  );
  fs.writeFileSync(
    path.join(root, "playground", "demo", "package.json"),
    JSON.stringify({ name: "@example/demo" }),
  );
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const packageJson = report.projectResolution?.packageJson;
  assert.ok(packageJson !== undefined);
  assert.deepEqual(
    packageJson.workspaces.map((workspace) => ({
      pattern: workspace.pattern,
      path: relativePath(root, workspace.location.path ?? ""),
      line: workspace.location.line,
    })),
    [
      { pattern: "!ignored/*", path: "pnpm-workspace.yaml", line: 4 },
      { pattern: "packages/*", path: "pnpm-workspace.yaml", line: 2 },
      { pattern: "playground/**", path: "pnpm-workspace.yaml", line: 3 },
    ],
  );
  assert.deepEqual(
    packageJson.workspacePackages.map((workspacePackage) => ({
      name: workspacePackage.name,
      path: relativePath(root, workspacePackage.path),
      pattern: workspacePackage.pattern,
    })),
    [
      { name: "@example/core", path: "packages/core", pattern: "packages/*" },
      { name: "@example/demo", path: "playground/demo", pattern: "playground/**" },
    ],
  );
});

test("project harness keeps package entry source locations from the TypeScript JSON AST", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-json-locations-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(path.join(root, "src", "internal.ts"), "export const internal = 1;\n");
  fs.writeFileSync(
    path.join(root, "package.json"),
    [
      "{",
      '  "name": "@example/package-locations",',
      '  "main": "./dist/index.js",',
      '  "exports": {',
      '    ".": "./dist/index.js",',
      '    "./feature": "./dist/feature.js"',
      "  },",
      '  "imports": {',
      '    "#internal": "./src/internal.ts"',
      "  },",
      '  "bin": {',
      '    "tool": "./dist/cli.js"',
      "  },",
      '  "scripts": {',
      '    "build": "tsc -p tsconfig.json"',
      "  },",
      '  "workspaces": {',
      '    "packages": ["packages/*"]',
      "  }",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const packageJson = report.projectResolution?.packageJson;
  assert.ok(packageJson !== undefined);
  assert.deepEqual(
    [
      ...packageJson.entrypoints.map((entry) => `field:${entry.subpath}:${entry.location.line}`),
      ...packageJson.exports.map((entry) => `exports:${entry.subpath}:${entry.location.line}`),
      ...packageJson.imports.map((entry) => `imports:${entry.subpath}:${entry.location.line}`),
      ...packageJson.bins.map((entry) => `bin:${entry.subpath}:${entry.location.line}`),
      ...packageJson.scripts.map((script) => `script:${script.name}:${script.location.line}`),
      ...packageJson.workspaces.map(
        (workspace) => `workspace:${workspace.pattern}:${workspace.location.line}`,
      ),
    ],
    [
      "field:main:3",
      "exports:.:5",
      "exports:./feature:6",
      "imports:#internal:9",
      "bin:tool:12",
      "script:build:15",
      "workspace:packages/*:18",
    ],
  );
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId === "TS-AGENT-POLICY-002")
      .map((finding) => `${finding.location.line}:${finding.label}`),
    ["5:unresolved package entry target", "6:unresolved package entry target"],
  );
});

test("project harness preserves conditional package targets from the TypeScript JSON AST", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-json-conditions-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(path.join(root, "src", "internal.ts"), "export const internal = 1;\n");
  fs.writeFileSync(
    path.join(root, "package.json"),
    [
      "{",
      '  "name": "@example/package-conditions",',
      '  "exports": {',
      '    ".": {',
      '      "types": "./dist/index.d.ts",',
      '      "import": "./dist/index.js",',
      '      "node": {',
      '        "default": "./dist/index.node.js"',
      "      },",
      '      "default": "./dist/index.cjs"',
      "    },",
      '    "./feature": [',
      '      { "types": "./dist/feature.d.ts" },',
      '      "./dist/feature.js"',
      "    ]",
      "  },",
      '  "imports": {',
      '    "#internal": {',
      '      "types": "./src/internal.d.ts",',
      '      "default": "./src/internal.ts"',
      "    }",
      "  }",
      "}",
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const packageJson = report.projectResolution?.packageJson;
  assert.ok(packageJson !== undefined);

  const rootExport = packageJson.exports.find((entry) => entry.subpath === ".");
  assert.ok(rootExport !== undefined);
  assert.deepEqual(
    rootExport.targetDetails.map(
      (targetDetail) =>
        `${targetDetail.conditions.join("/")}:${targetDetail.target}:${targetDetail.location.line}`,
    ),
    [
      "types:./dist/index.d.ts:5",
      "import:./dist/index.js:6",
      "node/default:./dist/index.node.js:8",
      "default:./dist/index.cjs:10",
    ],
  );

  const featureExport = packageJson.exports.find((entry) => entry.subpath === "./feature");
  assert.ok(featureExport !== undefined);
  assert.deepEqual(
    featureExport.targetDetails.map(
      (targetDetail) =>
        `${targetDetail.conditions.join("/") || "<none>"}:${targetDetail.target}:${targetDetail.location.line}`,
    ),
    ["types:./dist/feature.d.ts:13", "<none>:./dist/feature.js:14"],
  );

  const internalImport = packageJson.imports.find((entry) => entry.subpath === "#internal");
  assert.ok(internalImport !== undefined);
  assert.deepEqual(
    internalImport.targetDetails.map(
      (targetDetail) =>
        `${targetDetail.conditions.join("/")}:${targetDetail.target}:${targetDetail.location.line}`,
    ),
    ["types:./src/internal.d.ts:19", "default:./src/internal.ts:20"],
  );

  const rendered = renderTypeScriptReasoningTree(report);
  assert.match(rendered, /^Modules: source=2 branches=2 deps=8 package-owners=8 findings=1/u);
  assert.match(rendered, /package exports:\. \[types\] --unresolved--> \.\/dist\/index\.d\.ts/u);
  assert.match(
    rendered,
    /package exports:\. \[node\/default\] --unresolved--> \.\/dist\/index\.node\.js/u,
  );
  assert.match(rendered, /package imports:#internal \[default\] --owner--> src\/internal\.ts/u);
});

test("project harness records Rspack build tool facts from package json and config files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-rspack-build-tool-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(
    path.join(root, "rspack.config.ts"),
    "export default { entry: './src/index.ts' };\n",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts", "rspack.config.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/rspack-build-tool",
      scripts: {
        check: "tsc --noEmit",
      },
      devDependencies: {
        "@rspack/core": "^1.5.0",
      },
    }),
  );

  const report = runTypeScriptProjectHarness(root);
  const packageJson = report.projectResolution?.packageJson;
  assert.ok(packageJson !== undefined);
  assert.deepEqual(
    packageJson.packageBuildTools.map((buildTool) => ({
      name: buildTool.name,
      packageNames: buildTool.packageNames,
      configFiles: buildTool.configFiles,
      scriptNames: buildTool.scriptNames,
      signals: buildTool.signals.map(
        (signal) => `${signal.kind}:${signal.source ?? ""}:${signal.value}`,
      ),
    })),
    [
      {
        name: "rspack",
        packageNames: ["@rspack/core"],
        configFiles: ["rspack.config.ts"],
        scriptNames: [],
        signals: ["dependency:devDependencies:@rspack/core", "config::rspack.config.ts"],
      },
    ],
  );

  const snapshot = renderTypeScriptReasoningTree(report);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report);
  assert.match(snapshot, /Modules: source=2 branches=2 orphaned=1 build-tools=1 findings=1/u);
  assert.match(
    snapshot,
    /BuildTools:\n - rspack capabilities=bundle,dev-server,typescript-config packages=@rspack\/core configs=rspack\.config\.ts/u,
  );
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId === "TS-AGENT-PROJECT-006")
      .map((finding) => `${finding.severity}:${finding.label}`),
    ["info:expose Rspack through package scripts"],
  );
  assert.match(
    advice,
    /\[TS-AGENT-PROJECT-006\] Info x1: Expose Rspack build surface through npm scripts/u,
  );
  assert.match(advice, /add or update package scripts so `npm run build`/u);
});

test("Rspack script facts satisfy the build tool surface advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-rspack-script-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(
    path.join(root, "rspack.config.ts"),
    "export default { entry: './src/index.ts' };\n",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts", "rspack.config.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/rspack-script",
      scripts: {
        build: "rspack build --configLoader=native",
      },
      devDependencies: {
        "@rspack/cli": "^1.5.0",
        "@rspack/core": "^1.5.0",
      },
    }),
  );

  const report = runTypeScriptProjectHarness(root);

  assert.deepEqual(
    report.projectResolution?.packageJson.packageBuildTools.map((buildTool) => ({
      name: buildTool.name,
      packageNames: buildTool.packageNames,
      configFiles: buildTool.configFiles,
      scriptNames: buildTool.scriptNames,
    })),
    [
      {
        name: "rspack",
        packageNames: ["@rspack/cli", "@rspack/core"],
        configFiles: ["rspack.config.ts"],
        scriptNames: ["build"],
      },
    ],
  );
  assert.deepEqual(
    report.findings.filter((finding) => finding.ruleId === "TS-AGENT-PROJECT-006"),
    [],
  );
});

test("package json harness config can explicitly expose Rspack build tool intent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-rspack-config-intent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/rspack-config-intent",
      typescriptProjectHarness: {
        buildTools: {
          rspack: "enable",
        },
      },
    }),
  );

  const report = runTypeScriptProjectHarness(root);

  assert.deepEqual(
    report.projectResolution?.packageJson.packageBuildTools.map((buildTool) => ({
      name: buildTool.name,
      packageNames: buildTool.packageNames,
      configFiles: buildTool.configFiles,
      scriptNames: buildTool.scriptNames,
      signals: buildTool.signals.map(
        (signal) => `${signal.kind}:${signal.source ?? ""}:${signal.value}`,
      ),
    })),
    [
      {
        name: "rspack",
        packageNames: [],
        configFiles: [],
        scriptNames: [],
        signals: ["harness-config:typescriptProjectHarness:rspack"],
      },
    ],
  );
  assert.match(
    report.findings.find((finding) => finding.ruleId === "TS-AGENT-PROJECT-006")?.summary ?? "",
    /package\.json harness config/u,
  );
});
