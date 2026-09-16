import type { RulePackDescriptor, TypeScriptRulePack, AspTypeScriptRule } from "../model.js";
import { typeScriptAgentPolicyRules } from "./agent_policy/pack.js";
import { typeScriptModularityRules } from "./modularity/pack.js";
import { typeScriptProjectPolicyRules } from "./project_policy/pack.js";
import { typeScriptSemanticRules } from "./semantic/pack.js";
import { typeScriptSyntaxRules } from "./syntax/pack.js";
import { typeScriptTestLayoutRules } from "./test_layout/pack.js";
import { typeScriptExtensionPolicyRules } from "./extension_policy/pack.js";

export const TYPE_SCRIPT_RULE_PACKS: readonly TypeScriptRulePack[] = [
  "syntax",
  "semantic",
  "project_policy",
  "modularity",
  "test_layout",
  "agent_policy",
  "extension_policy",
];

const PACK_DESCRIPTORS: readonly RulePackDescriptor[] = [
  {
    id: "typescript.syntax",
    version: "0.1.0",
    domains: ["typescript", "syntax", "compiler-api"],
    defaultMode: "blocking",
  },
  {
    id: "typescript.semantic",
    version: "0.1.0",
    domains: ["typescript", "semantic", "compiler-api"],
    defaultMode: "advisory",
  },
  {
    id: "typescript.project_policy",
    version: "0.1.0",
    domains: ["typescript", "tsconfig", "project"],
    defaultMode: "blocking",
  },
  {
    id: "typescript.modularity",
    version: "0.1.0",
    domains: ["typescript", "modules", "ownership"],
    defaultMode: "advisory",
  },
  {
    id: "typescript.test_layout",
    version: "0.1.0",
    domains: ["typescript", "tests"],
    defaultMode: "advisory",
  },
  {
    id: "typescript.agent_policy",
    version: "0.1.0",
    domains: ["typescript", "agent", "repair"],
    defaultMode: "advisory",
  },
  {
    id: "typescript.extension_policy",
    version: "0.1.0",
    domains: ["typescript", "extensions", "effect", "agent"],
    defaultMode: "blocking",
  },
];

export function typeScriptRulePackDescriptors(): readonly RulePackDescriptor[] {
  return PACK_DESCRIPTORS;
}

export function typeScriptRulePackRuleIds(
  rulePack: TypeScriptRulePack,
): readonly AspTypeScriptRule["ruleId"][] {
  return typeScriptRulePackRules(rulePack).map((rule) => rule.ruleId);
}

function typeScriptRulePackRules(rulePack: TypeScriptRulePack): readonly AspTypeScriptRule[] {
  switch (rulePack) {
    case "syntax":
      return typeScriptSyntaxRules();
    case "semantic":
      return typeScriptSemanticRules();
    case "project_policy":
      return typeScriptProjectPolicyRules();
    case "modularity":
      return typeScriptModularityRules();
    case "test_layout":
      return typeScriptTestLayoutRules();
    case "agent_policy":
      return typeScriptAgentPolicyRules();
    case "extension_policy":
      return typeScriptExtensionPolicyRules();
  }
}
