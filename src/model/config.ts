/**
 * Configuration facade for ASP TypeScript defaults and policy helpers.
 *
 * This module re-exports the public configuration API from the root config
 * implementation while keeping model imports stable.
 */
export {
  defaultAspTypeScriptConfig,
  defaultTypeScriptVerificationPolicy,
  withDisabledTypeScriptRule,
  withDisabledTypeScriptRules,
  withDisabledTypeScriptRulePack,
  withTypeScriptRuleSeverity,
  withTypeScriptRulePackSeverity,
  withTypeScriptBlockingSeverities,
  withTypeScriptVerificationProfileHint,
  withTypeScriptVerificationReceipt,
  withTypeScriptVerificationWaiver,
  withDisabledTypeScriptVerificationTaskKind,
  withDisabledTypeScriptVerificationTaskKinds,
  withTypeScriptVerificationTaskContract,
  withTypeScriptVerificationResponsibilityTaskKinds,
  withTypeScriptVerificationSkillBinding,
  withTypeScriptVerificationSkillDescriptor,
  withTypeScriptVerificationDependencySignal,
} from "../config.js";

export type { AspTypeScriptConfig } from "../model.js";
