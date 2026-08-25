import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  renderTypeScriptHarnessRulesMarkdown,
  typeScriptHarnessRulesMarkdown,
  typeScriptAgentPolicyRules,
  typeScriptExtensionPolicyRules,
  typeScriptModularityRules,
  typeScriptProjectPolicyRules,
  typeScriptSemanticRules,
  typeScriptTestLayoutRules,
  writeTypeScriptHarnessRulesToUnitTests,
} from "../../src/index.js";

const agentPolicyRuleIdPattern = /^TS-AGENT(?:-[A-Z][A-Z0-9]*)+-[0-9]{3}$/;
const nonAgentRuleIdPattern = /^TS-(?:(?:SEM|PROJ|MOD|TEST)-R|EXT-[A-Z]+-R)\d{3}$/;

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

function harnessRulesRuleIds(): string[] {
  return typeScriptHarnessRulesMarkdown()
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => {
      const ruleId = line.slice(2).split(": ", 1)[0];
      assert.ok(ruleId);
      return ruleId;
    });
}

function catalogRuleIds(): string[] {
  return [
    ...typeScriptSemanticRules(),
    ...typeScriptProjectPolicyRules(),
    ...typeScriptModularityRules(),
    ...typeScriptTestLayoutRules(),
    ...typeScriptAgentPolicyRules(),
    ...typeScriptExtensionPolicyRules(),
  ].map((rule) => rule.ruleId);
}

test("harness rules markdown is a plain rule-id list", () => {
  const lines = typeScriptHarnessRulesMarkdown().trimEnd().split(/\r?\n/);

  assert.equal(lines.length, 46);
  for (const [index, line] of lines.entries()) {
    assert.ok(line.startsWith("- "), `line ${index + 1} must be a list item`);
    const item = line.slice(2);
    const separator = item.indexOf(": ");
    assert.notEqual(separator, -1, `line ${index + 1} must use '<rule-id>: <sentence>'`);
    const ruleId = item.slice(0, separator);
    const sentence = item.slice(separator + 2);

    if (ruleId.includes("-AGENT-")) {
      assert.match(ruleId, agentPolicyRuleIdPattern);
    } else {
      assert.match(ruleId, nonAgentRuleIdPattern);
    }
    assert.ok(sentence.endsWith("."));
    assert.equal([...sentence.matchAll(/[.!?]/g)].length, 1);
  }
});

test("harness rules ids match rule catalog", () => {
  assert.deepEqual(harnessRulesRuleIds().sort(), catalogRuleIds().sort());
});

test("generated harness rules matches unit fixture", () => {
  const unitDir = path.join(packageRoot(), "tests", "unit");
  const fixture = path.join(unitDir, "harness-rules.generated.md");
  if (process.env.UPDATE_HARNESS_RULES) {
    writeTypeScriptHarnessRulesToUnitTests(unitDir);
  }

  assert.equal(fs.readFileSync(fixture, "utf8"), renderTypeScriptHarnessRulesMarkdown());
});

test("harness rules writer targets requested unit directory", () => {
  const unitDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-rules-"));
  try {
    const output = writeTypeScriptHarnessRulesToUnitTests(unitDir);

    assert.equal(output, path.join(unitDir, "harness-rules.generated.md"));
    assert.equal(fs.readFileSync(output, "utf8"), renderTypeScriptHarnessRulesMarkdown());
  } finally {
    fs.rmSync(unitDir, { recursive: true, force: true });
  }
});
