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

test("test layout pack reports test modules outside configured test roots without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-test-layout-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "tests"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      include: ["src/**/*.ts", "tests/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "domain.test.ts"), "export const fixture = 1;\n");
  fs.writeFileSync(path.join(root, "tests", "domain.test.ts"), "export const ok = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.findings.map((finding) => `${finding.ruleId}:${finding.severity}`),
    ["TS-TEST-R001:info"],
  );
  assert.match(rendered, /\[TS-TEST-R001\] Info/u);
  assert.match(rendered, /Test module 'src\/domain\.test\.ts' is outside configured test roots/u);
});
