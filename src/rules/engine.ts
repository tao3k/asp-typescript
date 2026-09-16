import type {
  TypeScriptDiagnosticSeverity,
  AspTypeScriptConfig,
  AspTypeScriptFinding,
  TypeScriptReasoningTree,
} from "../model.js";
import { TYPE_SCRIPT_RULE_PACKS, typeScriptRulePackRuleIds } from "./catalog.js";
import { evaluateAgentPolicyRules } from "./agent_policy/pack.js";
import { evaluateModularityRules } from "./modularity/pack.js";
import { evaluateProjectPolicyRules } from "./project_policy/pack.js";
import { evaluateSemanticRules } from "./semantic/pack.js";
import { evaluateSyntaxRules } from "./syntax/pack.js";
import { evaluateTestLayoutRules } from "./test_layout/pack.js";
import { evaluateExtensionPolicyRules } from "./extension_policy/pack.js";

export function evaluateDefaultRulePacks(
  reasoningTree: TypeScriptReasoningTree,
  config: AspTypeScriptConfig,
): readonly AspTypeScriptFinding[] {
  return applyPolicyConfig(
    [
      ...evaluateSyntaxRules(reasoningTree),
      ...evaluateSemanticRules(reasoningTree),
      ...evaluateProjectPolicyRules(reasoningTree),
      ...evaluateModularityRules(reasoningTree),
      ...evaluateTestLayoutRules(reasoningTree),
      ...evaluateAgentPolicyRules(reasoningTree),
      ...evaluateExtensionPolicyRules(reasoningTree),
    ],
    config,
  );
}

function applyPolicyConfig(
  findings: readonly AspTypeScriptFinding[],
  config: AspTypeScriptConfig,
): readonly AspTypeScriptFinding[] {
  const disabledRuleIds = new Set([
    ...config.disabledRuleIds,
    ...config.disabledRulePacks.flatMap((rulePack) => typeScriptRulePackRuleIds(rulePack)),
  ]);
  const rulePackSeverityByRuleId = configuredRulePackSeverities(config);
  return findings.flatMap((finding) => {
    if (disabledRuleIds.has(finding.ruleId)) {
      return [];
    }
    const severity =
      config.ruleSeverityOverrides[finding.ruleId] ??
      rulePackSeverityByRuleId.get(finding.ruleId) ??
      finding.severity;
    return severity === finding.severity ? [finding] : [{ ...finding, severity }];
  });
}

function configuredRulePackSeverities(
  config: AspTypeScriptConfig,
): ReadonlyMap<string, TypeScriptDiagnosticSeverity> {
  const severities = new Map<string, TypeScriptDiagnosticSeverity>();
  for (const rulePack of TYPE_SCRIPT_RULE_PACKS) {
    const severity = config.rulePackSeverityOverrides[rulePack];
    if (severity === undefined) {
      continue;
    }
    for (const ruleId of typeScriptRulePackRuleIds(rulePack)) {
      severities.set(ruleId, severity);
    }
  }
  return severities;
}
