import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarness,
  renderTypeScriptReasoningTree,
  runTypeScriptProjectHarness,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("project parser exposes native TypeScript semantic diagnostics as non-blocking advice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-semantic-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const value: string = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.modules.flatMap((moduleReport) =>
      moduleReport.semanticDiagnostics.map((diagnostic) => ({
        category: diagnostic.category,
        code: diagnostic.code,
      })),
    ),
    [{ category: "error", code: 2322 }],
  );
  assert.deepEqual(
    report.findings.map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-SEM-R001:info"],
  );
  assert.deepEqual(
    report.findings.map((finding) => finding.summary),
    ["TS2322: Type 'number' is not assignable to type 'string'."],
  );
  assert.deepEqual(
    report.reasoningTree.diagnostics.map((diagnostic) => ({
      phase: diagnostic.phase,
      category: diagnostic.category,
      code: diagnostic.code,
      ownerPath: relativePath(root, diagnostic.ownerPath),
    })),
    [{ phase: "semantic", category: "error", code: 2322, ownerPath: "src/index.ts" }],
  );
  assert.deepEqual(
    report.reasoningTree.modules.map((moduleReport) => ({
      path: relativePath(root, moduleReport.path),
      isValid: moduleReport.isValid,
      semanticDiagnosticCount: moduleReport.semanticDiagnosticCount,
      syntaxDiagnosticCount: moduleReport.syntaxDiagnosticCount,
    })),
    [{ path: "src/index.ts", isValid: true, semanticDiagnosticCount: 1, syntaxDiagnosticCount: 0 }],
  );
  assert.match(rendered, /\[TS-SEM-R001\] Info/u);
  assert.match(rendered, /TS2322: Type 'number' is not assignable to type 'string'/u);
  assert.match(snapshot, /^Modules: source=1 branches=1 findings=1/u);
  assert.match(snapshot, /OwnerBranches:/u);
  assert.match(snapshot, /src\/index\.ts \[root, facade\] owner=src exports=value/u);
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-SEM-R001/u);
});

test("project parser preserves native TypeScript related diagnostic information", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-related-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    [
      "interface User {",
      "  id: string;",
      "  name: string;",
      "}",
      'export const user: User = { id: "1" };',
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const snapshot = renderTypeScriptReasoningTree(report);
  const rendered = renderTypeScriptProjectHarness(report);
  const [diagnostic] = report.modules.flatMap((moduleReport) => moduleReport.semanticDiagnostics);
  assert.ok(diagnostic !== undefined);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(diagnostic.code, 2741);
  assert.deepEqual(
    diagnostic.relatedInformation.map((relatedInformation) => ({
      code: relatedInformation.code,
      message: relatedInformation.message,
      line: relatedInformation.location.line,
    })),
    [{ code: 2728, message: "'name' is declared here.", line: 3 }],
  );
  assert.deepEqual(
    report.reasoningTree.diagnostics.flatMap((reasoningDiagnostic) =>
      reasoningDiagnostic.relatedInformation.map((relatedInformation) => ({
        code: relatedInformation.code,
        line: relatedInformation.location.line,
      })),
    ),
    [{ code: 2728, line: 3 }],
  );
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-SEM-R001/u);
  assert.match(rendered, /src\/index\.ts:5:\d+/u);
  assert.match(rendered, /TS2741: Property 'name' is missing/u);
});
