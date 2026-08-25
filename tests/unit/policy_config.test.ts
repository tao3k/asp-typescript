import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultTypeScriptHarnessConfig,
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarness,
  renderTypeScriptProjectHarnessAgentSnapshot,
  runTypeScriptProjectHarness,
  runTypeScriptProjectHarnessAgentSnapshot,
  typeScriptRulePackRuleIds,
  withDisabledTypeScriptRule,
  withDisabledTypeScriptRulePack,
  withDisabledTypeScriptRules,
  withTypeScriptBlockingSeverities,
  withTypeScriptRulePackSeverity,
  withTypeScriptRuleSeverity,
} from "../../src/index.js";

test("policy config can disable a single rule finding", () => {
  const root = unresolvedImportProject("single-rule");
  const defaultReport = runTypeScriptProjectHarness(root);
  const config = withDisabledTypeScriptRule(
    defaultTypeScriptHarnessConfig(),
    "TS-AGENT-POLICY-001",
  );
  const configuredReport = runTypeScriptProjectHarness(root, config);

  assert.ok(defaultReport.findings.some((finding) => finding.ruleId === "TS-AGENT-POLICY-001"));
  assert.ok(configuredReport.findings.every((finding) => finding.ruleId !== "TS-AGENT-POLICY-001"));
});

test("policy config can disable several rules and a built-in rule pack", () => {
  const root = unresolvedImportProject("rule-pack");
  const config = withDisabledTypeScriptRulePack(
    withDisabledTypeScriptRules(defaultTypeScriptHarnessConfig(), ["TS-SEM-R001"]),
    "agent_policy",
  );
  const report = runTypeScriptProjectHarness(root, config);

  assert.deepEqual(typeScriptRulePackRuleIds("agent_policy"), [
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
  ]);
  assert.deepEqual(typeScriptRulePackRuleIds("extension_policy"), [
    "TS-EXT-EFFECT-R001",
    "TS-EXT-EFFECT-R002",
    "TS-EXT-EFFECT-R003",
    "TS-EXT-EFFECT-R004",
    "TS-EXT-EFFECT-R005",
    "TS-EXT-EFFECT-R006",
    "TS-EXT-EFFECT-R007",
    "TS-EXT-EFFECT-R008",
    "TS-EXT-EFFECT-R009",
    "TS-EXT-EFFECT-R010",
    "TS-EXT-EFFECT-R011",
    "TS-EXT-EFFECT-R012",
    "TS-EXT-EFFECT-R013",
    "TS-EXT-REACT-R001",
    "TS-EXT-REACT-R002",
    "TS-EXT-REACT-R003",
    "TS-EXT-REACT-R004",
    "TS-EXT-SHADCN-R001",
    "TS-EXT-SHADCN-R002",
    "TS-EXT-SHADCN-R003",
  ]);
  assert.ok(report.findings.every((finding) => !finding.ruleId.startsWith("TS-AGENT-")));
  assert.ok(report.findings.every((finding) => finding.ruleId !== "TS-SEM-R001"));
});

test("policy config can override single-rule and rule-pack severities", () => {
  const root = unresolvedImportProject("severity");
  const ruleConfig = withTypeScriptRuleSeverity(
    defaultTypeScriptHarnessConfig(),
    "TS-AGENT-POLICY-001",
    "warning",
  );
  const packConfig = withTypeScriptRulePackSeverity(
    defaultTypeScriptHarnessConfig(),
    "agent_policy",
    "warning",
  );
  const ruleReport = runTypeScriptProjectHarness(root, ruleConfig);
  const packReport = runTypeScriptProjectHarness(root, packConfig);

  assert.equal(agentFinding(ruleReport).severity, "warning");
  assert.equal(isTypeScriptHarnessClean(ruleReport), false);
  assert.ok(
    packReport.findings
      .filter((finding) => finding.ruleId.startsWith("TS-AGENT-"))
      .every((finding) => finding.severity === "warning"),
  );
  assert.equal(isTypeScriptHarnessClean(packReport), false);
});

test("single-rule severity override wins after rule-pack severity", () => {
  const root = unresolvedImportProject("rule-wins");
  const config = withTypeScriptRuleSeverity(
    withTypeScriptRulePackSeverity(defaultTypeScriptHarnessConfig(), "agent_policy", "info"),
    "TS-AGENT-POLICY-001",
    "warning",
  );
  const report = runTypeScriptProjectHarness(root, config);

  assert.equal(agentFinding(report).severity, "warning");
  assert.equal(isTypeScriptHarnessClean(report), false);
});

test("blocking rule ids and blocking severity helper are applied at report time", () => {
  const root = unresolvedImportProject("blocking-rule");
  const config = {
    ...defaultTypeScriptHarnessConfig(),
    blockingRuleIds: ["TS-AGENT-POLICY-001"],
  };
  const warningConfig = withTypeScriptRuleSeverity(
    defaultTypeScriptHarnessConfig(),
    "TS-AGENT-POLICY-001",
    "warning",
  );
  const nonBlockingWarningConfig = withTypeScriptBlockingSeverities(warningConfig, ["error"]);

  assert.equal(isTypeScriptHarnessClean(runTypeScriptProjectHarness(root, config)), false);
  assert.equal(
    isTypeScriptHarnessClean(runTypeScriptProjectHarness(root, nonBlockingWarningConfig)),
    true,
  );
});

test("agent snapshot uses policy-configured findings", () => {
  const root = unresolvedImportProject("snapshot");
  const defaultSnapshot = renderTypeScriptProjectHarnessAgentSnapshot(
    runTypeScriptProjectHarnessAgentSnapshot(root),
  );
  const configuredSnapshot = renderTypeScriptProjectHarnessAgentSnapshot(
    runTypeScriptProjectHarnessAgentSnapshot(
      root,
      withDisabledTypeScriptRule(defaultTypeScriptHarnessConfig(), "TS-AGENT-POLICY-001"),
    ),
  );

  assert.match(defaultSnapshot, /FindingGroups:/u);
  assert.match(defaultSnapshot, /TS-AGENT-POLICY-001/u);
  assert.doesNotMatch(configuredSnapshot, /FindingGroups:/u);
  assert.doesNotMatch(configuredSnapshot, /TS-AGENT-POLICY-001/u);
});

function unresolvedImportProject(label: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asp-typescript-policy-${label}-`));
  fs.mkdirSync(path.join(root, "src"));
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
  fs.writeFileSync(path.join(root, "src", "index.ts"), 'import "./missing.js";\n');
  return root;
}

function agentFinding(report: ReturnType<typeof runTypeScriptProjectHarness>) {
  const finding = report.findings.find((candidate) => candidate.ruleId === "TS-AGENT-POLICY-001");
  assert.ok(finding, renderTypeScriptProjectHarness(report));
  return finding;
}
