import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isTypeScriptHarnessClean,
  parsedCount,
  renderTypeScriptProjectHarness,
  renderTypeScriptReasoningTree,
  runTypeScriptLangHarness,
  runTypeScriptProjectHarness,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("project runner uses tsconfig native file selection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-project-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "ignored"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts"], compilerOptions: { strict: true } }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(path.join(root, "ignored", "bad.ts"), "export const broken = ;\n");

  const report = runTypeScriptProjectHarness(root);

  assert.equal(report.runMode, "project");
  assert.equal(report.reasoningTree.runMode, report.runMode);
  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.modules.map((moduleReport) => relativePath(root, moduleReport.path)),
    ["src/index.ts"],
  );
  assert.match(renderTypeScriptProjectHarness(report), /^\[ok\] typescript/u);
});

test("project runner anchors project scope at nearest package json", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-anchor-"));
  fs.mkdirSync(path.join(root, "src", "feature"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@example/package-anchor" }),
  );
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(path.join(root, "src", "feature"));
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(report.projectResolution?.projectRoot, root);
  assert.deepEqual(report.rootPaths, [root]);
  assert.deepEqual(
    report.modules.map((moduleReport) => relativePath(root, moduleReport.path)),
    ["src/index.ts"],
  );
  assert.match(snapshot, /^Modules: source=1 branches=1/u);
  assert.match(snapshot, /src\/index\.ts \[root, facade\] owner=src exports=ok/u);
});

test("project runner does not inherit parent tsconfig across a package json anchor", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-package-local-config-"));
  const packageRoot = path.join(root, "packages", "util");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@example/root" }));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const rootValue = 1;\n");
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ name: "@example/util" }),
  );
  fs.writeFileSync(path.join(packageRoot, "src", "index.ts"), "export const utilValue = 1;\n");

  const report = runTypeScriptProjectHarness(packageRoot);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(report.reasoningTree.configPath, undefined);
  assert.deepEqual(
    report.modules.map((moduleReport) => relativePath(packageRoot, moduleReport.path)),
    ["src/index.ts"],
  );
  assert.match(snapshot, /^Modules: source=1 branches=1 findings=1/u);
  assert.match(snapshot, /src\/index\.ts \[root, facade\] owner=src exports=utilValue/u);
  assert.doesNotMatch(snapshot, /\.\.\/\.\.\/src/u);
});

test("project runner routes missing tsconfig policy through reasoning facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-project-no-config-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(report.reasoningTree.configPath, undefined);
  assert.deepEqual(
    report.findings.map((finding) => ({
      ruleId: finding.ruleId,
      locationPath: finding.location.path,
    })),
    [{ ruleId: "TS-AGENT-PROJECT-001", locationPath: root }],
  );
  assert.equal(isTypeScriptHarnessClean(report), false);
  assert.match(rendered, /\[TS-AGENT-PROJECT-001\] Warning/u);
  assert.match(snapshot, /^Modules: source=1 branches=1 findings=1/u);
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-AGENT-PROJECT-001/u);
  assert.doesNotMatch(snapshot, /^config /mu);
});

test("project runner renders native syntax findings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-project-bad-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const broken = ;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), false);
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      code: diagnostic.code,
      path: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "syntax", code: 1109, path: "src/index.ts" }],
  );
  assert.deepEqual(
    report.findings.map((finding) => ({
      ruleId: finding.ruleId,
      summary: finding.summary,
    })),
    [{ ruleId: "TS-SYN-R001", summary: "TS1109: Expression expected." }],
  );
  assert.match(rendered, /\[TS-SYN-R001\] Error/u);
  assert.match(rendered, /Expression expected/u);
});

test("project runner routes tsconfig diagnostics through reasoning facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-project-config-bad-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "tsconfig.json"), '{ "compilerOptions": }\n');
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), false);
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      ownerPath: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "config", ownerPath: "tsconfig.json" }],
  );
  assert.deepEqual(
    report.findings.map((finding) => finding.ruleId),
    ["TS-AGENT-PROJECT-002"],
  );
  assert.match(rendered, /\[TS-AGENT-PROJECT-002\] Error/u);
  assert.match(rendered, /TypeScript config parser diagnostic/u);
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-AGENT-PROJECT-002/u);
});

test("explicit-path runner routes syntax diagnostics through reasoning facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-explicit-bad-"));
  const filePath = path.join(root, "broken.ts");
  fs.writeFileSync(filePath, "export const broken = ;\n");

  const report = runTypeScriptLangHarness([filePath]);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(report.runMode, "explicit");
  assert.equal(report.reasoningTree.runMode, report.runMode);
  assert.equal(report.projectResolution, undefined);
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      code: diagnostic.code,
      ownerPath: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "syntax", code: 1109, ownerPath: "broken.ts" }],
  );
  assert.deepEqual(
    report.reasoningTree.modules.map((moduleReport) => ({
      path: relativePath(root, moduleReport.path),
      isValid: moduleReport.isValid,
    })),
    [{ path: "broken.ts", isValid: false }],
  );
  assert.equal(parsedCount(report), 0);
  assert.deepEqual(
    report.findings.map((finding) => ({
      ruleId: finding.ruleId,
      summary: finding.summary,
    })),
    [{ ruleId: "TS-SYN-R001", summary: "TS1109: Expression expected." }],
  );
  assert.match(rendered, /\[TS-SYN-R001\] Error/u);
  assert.equal(rendered.includes(filePath), false);
  assert.match(rendered, /^broken\.ts:\d+:\d+/mu);
  assert.match(snapshot, /^Modules: source=1 branches=1 findings=1/u);
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-SYN-R001/u);
});
