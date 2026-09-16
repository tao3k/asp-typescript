/**
 * Public rule catalog facade for ASP TypeScript policy packs.
 *
 * This module re-exports built-in rule packs and descriptors so CLI and library
 * callers share the same policy catalog.
 */
export { typeScriptSyntaxRules } from "./rules/syntax.js";
export { typeScriptSemanticRules } from "./rules/semantic/pack.js";
export { typeScriptProjectPolicyRules } from "./rules/project-policy.js";
export { typeScriptModularityRules } from "./rules/module-boundary.js";
export { typeScriptTestLayoutRules } from "./rules/test_layout/pack.js";
export { typeScriptAgentPolicyRules } from "./rules/agent-policy.js";
export { typeScriptReactExtensionPolicyRules } from "./rules/react-policy.js";
export { typeScriptExtensionPolicyRules } from "./rules/effect-policy.js";
export { typeScriptRulePackDescriptors, typeScriptRulePackRuleIds } from "./rules/catalog.js";
export { evaluateDefaultRulePacks } from "./rules/engine.js";
