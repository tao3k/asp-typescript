import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarness,
  runTypeScriptProjectHarness,
} from "../../src/index.js";

test("modularity pack reports production modules depending on tests without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-modularity-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "tests"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*.ts", "tests/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "tests", "helper.ts"), "export const helper = 1;\n");
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    'import { helper } from "../tests/helper.js";\nexport const value = helper;\n',
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-MOD-R001:info"],
  );
  assert.match(rendered, /\[TS-MOD-R001\] Info/u);
  assert.match(rendered, /Module role 'facade' depends on test owner '\.\.\/tests\/helper\.js'/u);
});

test("modularity pack reports broad project modules without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-parser-modularity-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@example/modularity" }),
  );
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "reasoning.ts"),
    [
      ...Array.from(
        { length: 9 },
        (_, index) => `export function concern${index}(): number { return ${index}; }`,
      ),
      ...Array.from({ length: 1000 }, (_, index) => `// reasoning assertion ${index}`),
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.ok(report.findings.some((finding) => finding.ruleId === "TS-MOD-R002"));
  assert.match(rendered, /\[TS-MOD-R002\] Info/u);
  assert.match(
    rendered,
    /Project module 'src\/reasoning\.ts' has 9 top-level responsibilities \(9 implementation blocks\)/u,
  );
  assert.match(rendered, /lines>1000\+responsibilities>8/u);
  assert.match(rendered, /broad project module responsibility surface/u);
});

test("modularity pack reports broad test modules from parser-visible coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-test-modularity-"));
  fs.mkdirSync(path.join(root, "tests"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["tests/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "tests", "cli.test.ts"),
    [
      "declare const test: (name: string, fn: () => void) => void;",
      ...Array.from(
        { length: 9 },
        (_, index) => `test('protocol ${index}', () => { void ${index}; });`,
      ),
      ...Array.from({ length: 1000 }, (_, index) => `// protocol assertion ${index}`),
    ].join("\n"),
  );

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.ok(report.findings.some((finding) => finding.ruleId === "TS-MOD-R002"));
  assert.match(rendered, /\[TS-MOD-R002\] Info/u);
  assert.match(
    rendered,
    /Project module 'tests\/cli\.test\.ts' has 9 top-level responsibilities \(9 implementation blocks\)/u,
  );
  assert.match(rendered, /lines>1000\+responsibilities>8/u);
});
