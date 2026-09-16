import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertAspTypeScriptClean,
  advisoryFindings,
  isAspTypeScriptClean,
  runAspTypeScript,
} from "../../src/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("repository self-applies the default ASP TypeScript policy", () => {
  assertAspTypeScriptClean(projectRoot);
});

test("repository self-applies the default advice surface with minimal findings", () => {
  const report = runAspTypeScript(projectRoot);
  assert.ok(isAspTypeScriptClean(report), "ASP TypeScript must have zero errors");

  const modularityAdvice = report.findings.filter(
    (finding) => finding.packId === "typescript.modularity",
  );
  assert.deepEqual(
    modularityAdvice.map((finding) => `${finding.ruleId}:${finding.location.path}`),
    [],
    "repository must self-apply the TypeScript modularity policy",
  );

  const advice = advisoryFindings(report);
  assert.ok(
    advice.every((finding) => finding.ruleId !== "TS-AGENT-POLICY-013"),
    "repository broad public surfaces should carry module-level intent docs",
  );
  // Allow a bounded number of info-level findings from public API, renderer,
  // and software-criterion migration surfaces that remain advisory for now.
  assert.ok(
    advice.length <= 30,
    `expected <=30 advisory findings, got ${advice.length}: ${advice.map((f) => f.ruleId).join(", ")}`,
  );
});
