/**
 * Public configuration builders for the ASP TypeScript.
 *
 * This module owns default policy configuration and immutable helper functions
 * for callers that tune rule or verification behavior.
 */
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_IGNORED_DIR_NAMES, pathFromInput } from "./parser.js";
import type {
  TypeScriptDiagnosticSeverity,
  AspTypeScriptConfig,
  TypeScriptRulePack,
} from "./model.js";
import type {
  TypeScriptVerificationDependencySignal,
  TypeScriptOwnerResponsibility,
  TypeScriptVerificationProfileHint,
  TypeScriptVerificationReceipt,
  TypeScriptVerificationSkillBinding,
  TypeScriptVerificationSkillDescriptor,
  TypeScriptVerificationTaskContract,
  TypeScriptVerificationTaskKind,
  TypeScriptVerificationWaiver,
} from "./verification/model.js";

export function defaultAspTypeScriptConfig(): AspTypeScriptConfig {
  return {
    ignoredDirNames: [...DEFAULT_IGNORED_DIR_NAMES],
    includeHiddenDirNames: [],
    includeTests: true,
    sourceDirNames: ["src"],
    testDirNames: ["tests"],
    blockingSeverities: ["warning", "error"],
    disabledRuleIds: [],
    disabledRulePacks: [],
    ruleSeverityOverrides: {},
    rulePackSeverityOverrides: {},
    blockingRuleIds: [],
    verificationPolicy: defaultTypeScriptVerificationPolicy(),
  };
}

export function aspTypeScriptConfigForProject(projectRootInput: string | URL): AspTypeScriptConfig {
  return applyAspProjectConfig(pathFromInput(projectRootInput), defaultAspTypeScriptConfig());
}

export function defaultTypeScriptVerificationPolicy(): AspTypeScriptConfig["verificationPolicy"] {
  return {
    profileHints: [],
    receipts: [],
    waivers: [],
    disabledTaskKinds: [],
    responsibilityTaskOverrides: {},
    taskContractOverrides: {},
    skillBindings: {},
    skillDescriptors: [],
    dependencySignals: [],
  };
}

export function withDisabledTypeScriptRule(
  config: AspTypeScriptConfig,
  ruleId: string,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    disabledRuleIds: appendUnique(config.disabledRuleIds, ruleId),
  });
}

export function withDisabledTypeScriptRules(
  config: AspTypeScriptConfig,
  ruleIds: readonly string[],
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    disabledRuleIds: appendUniqueMany(config.disabledRuleIds, ruleIds),
  });
}

export function withDisabledTypeScriptRulePack(
  config: AspTypeScriptConfig,
  rulePack: TypeScriptRulePack,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    disabledRulePacks: appendUnique(config.disabledRulePacks, rulePack),
  });
}

export function withTypeScriptRuleSeverity(
  config: AspTypeScriptConfig,
  ruleId: string,
  severity: TypeScriptDiagnosticSeverity,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    ruleSeverityOverrides: { ...config.ruleSeverityOverrides, [ruleId]: severity },
  });
}

export function withTypeScriptRulePackSeverity(
  config: AspTypeScriptConfig,
  rulePack: TypeScriptRulePack,
  severity: TypeScriptDiagnosticSeverity,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    rulePackSeverityOverrides: { ...config.rulePackSeverityOverrides, [rulePack]: severity },
  });
}

export function withTypeScriptBlockingSeverities(
  config: AspTypeScriptConfig,
  severities: readonly TypeScriptDiagnosticSeverity[],
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    blockingSeverities: [...severities],
  });
}

export function withTypeScriptVerificationProfileHint(
  config: AspTypeScriptConfig,
  hint: TypeScriptVerificationProfileHint,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      profileHints: [...config.verificationPolicy.profileHints, cloneProfileHint(hint)],
    },
  });
}

export function withTypeScriptVerificationReceipt(
  config: AspTypeScriptConfig,
  receipt: TypeScriptVerificationReceipt,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      receipts: [...config.verificationPolicy.receipts, cloneVerificationReceipt(receipt)],
    },
  });
}

export function withTypeScriptVerificationWaiver(
  config: AspTypeScriptConfig,
  waiver: TypeScriptVerificationWaiver,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      waivers: [...config.verificationPolicy.waivers, { ...waiver }],
    },
  });
}

export function withDisabledTypeScriptVerificationTaskKind(
  config: AspTypeScriptConfig,
  kind: TypeScriptVerificationTaskKind,
): AspTypeScriptConfig {
  return withDisabledTypeScriptVerificationTaskKinds(config, [kind]);
}

export function withDisabledTypeScriptVerificationTaskKinds(
  config: AspTypeScriptConfig,
  kinds: readonly TypeScriptVerificationTaskKind[],
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      disabledTaskKinds: appendUniqueMany(config.verificationPolicy.disabledTaskKinds, kinds),
    },
  });
}

export function withTypeScriptVerificationTaskContract(
  config: AspTypeScriptConfig,
  kind: TypeScriptVerificationTaskKind,
  contract: TypeScriptVerificationTaskContract,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      taskContractOverrides: {
        ...config.verificationPolicy.taskContractOverrides,
        [kind]: cloneTaskContract(contract),
      },
    },
  });
}

export function withTypeScriptVerificationResponsibilityTaskKinds(
  config: AspTypeScriptConfig,
  responsibility: TypeScriptOwnerResponsibility,
  taskKinds: readonly TypeScriptVerificationTaskKind[],
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      responsibilityTaskOverrides: {
        ...config.verificationPolicy.responsibilityTaskOverrides,
        [responsibility]: [...taskKinds],
      },
    },
  });
}

export function withTypeScriptVerificationSkillBinding(
  config: AspTypeScriptConfig,
  kind: TypeScriptVerificationTaskKind,
  binding: TypeScriptVerificationSkillBinding,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      skillBindings: {
        ...config.verificationPolicy.skillBindings,
        [kind]: { ...binding },
      },
    },
  });
}

export function withTypeScriptVerificationSkillDescriptor(
  config: AspTypeScriptConfig,
  descriptor: TypeScriptVerificationSkillDescriptor,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      skillDescriptors: [
        ...config.verificationPolicy.skillDescriptors.filter(
          (candidate) => skillBindingLabel(candidate) !== skillBindingLabel(descriptor),
        ),
        cloneSkillDescriptor(descriptor),
      ],
    },
  });
}

export function withTypeScriptVerificationDependencySignal(
  config: AspTypeScriptConfig,
  signal: TypeScriptVerificationDependencySignal,
): AspTypeScriptConfig {
  return cloneAspTypeScriptConfig(config, {
    verificationPolicy: {
      ...config.verificationPolicy,
      dependencySignals: [
        ...config.verificationPolicy.dependencySignals,
        cloneDependencySignal(signal),
      ],
    },
  });
}

function cloneAspTypeScriptConfig(
  config: AspTypeScriptConfig,
  overrides: Partial<AspTypeScriptConfig> = {},
): AspTypeScriptConfig {
  return {
    ignoredDirNames: [...(overrides.ignoredDirNames ?? config.ignoredDirNames)],
    includeHiddenDirNames: [...(overrides.includeHiddenDirNames ?? config.includeHiddenDirNames)],
    includeTests: overrides.includeTests ?? config.includeTests,
    sourceDirNames: [...(overrides.sourceDirNames ?? config.sourceDirNames)],
    testDirNames: [...(overrides.testDirNames ?? config.testDirNames)],
    blockingSeverities: [...(overrides.blockingSeverities ?? config.blockingSeverities)],
    disabledRuleIds: [...(overrides.disabledRuleIds ?? config.disabledRuleIds)],
    disabledRulePacks: [...(overrides.disabledRulePacks ?? config.disabledRulePacks)],
    ruleSeverityOverrides: {
      ...(overrides.ruleSeverityOverrides ?? config.ruleSeverityOverrides),
    },
    rulePackSeverityOverrides: {
      ...(overrides.rulePackSeverityOverrides ?? config.rulePackSeverityOverrides),
    },
    blockingRuleIds: [...(overrides.blockingRuleIds ?? config.blockingRuleIds)],
    verificationPolicy: cloneVerificationPolicy(
      overrides.verificationPolicy ?? config.verificationPolicy,
    ),
  };
}

interface AspDiscoveryConfig {
  readonly ignoredDirNames: readonly string[];
  readonly includeHiddenDirNames: readonly string[];
}

function applyAspProjectConfig(
  projectRoot: string,
  config: AspTypeScriptConfig,
): AspTypeScriptConfig {
  const configPath = nearestAspToml(projectRoot);
  if (configPath === undefined) return config;
  const discovery = readAspDiscoveryConfig(configPath);
  if (discovery === undefined) return config;
  return cloneAspTypeScriptConfig(config, {
    ignoredDirNames: appendUniqueMany(config.ignoredDirNames, discovery.ignoredDirNames),
    includeHiddenDirNames: appendUniqueMany(
      config.includeHiddenDirNames,
      discovery.includeHiddenDirNames,
    ),
  });
}

function nearestAspToml(projectRoot: string): string | undefined {
  let current = path.resolve(projectRoot);
  while (true) {
    const candidate = path.join(current, "asp.toml");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function readAspDiscoveryConfig(configPath: string): AspDiscoveryConfig | undefined {
  let text: string;
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch {
    return undefined;
  }
  const section = discoverySectionLines(text);
  if (section.length === 0) return undefined;
  return {
    ignoredDirNames: stringArrayValue(section, "ignoredDirNames"),
    includeHiddenDirNames: stringArrayValue(section, "includeHiddenDirNames"),
  };
}

function discoverySectionLines(text: string): string[] {
  const lines: string[] = [];
  let inDiscovery = false;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*/u, "").trim();
    if (line.length === 0) continue;
    const section = line.match(/^\[([^\]]+)\]$/u)?.[1];
    if (section !== undefined) {
      inDiscovery = section === "discovery";
      continue;
    }
    if (inDiscovery) lines.push(line);
  }
  return lines;
}

function stringArrayValue(lines: readonly string[], key: string): string[] {
  const prefix = `${key} =`;
  const line = lines.find((candidate) => candidate.startsWith(prefix));
  if (line === undefined) return [];
  const value = line.slice(prefix.length).trim();
  if (!value.startsWith("[") || !value.endsWith("]")) return [];
  const values: string[] = [];
  for (const match of value.matchAll(/"([^"]+)"/gu)) {
    if (!values.includes(match[1]!)) values.push(match[1]!);
  }
  return values;
}

function appendUnique<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? [...values] : [...values, value];
}

function appendUniqueMany<T>(values: readonly T[], newValues: readonly T[]): readonly T[] {
  let merged = [...values];
  for (const value of newValues) {
    if (!merged.includes(value)) {
      merged = [...merged, value];
    }
  }
  return merged;
}

function cloneVerificationPolicy(
  policy: AspTypeScriptConfig["verificationPolicy"],
): AspTypeScriptConfig["verificationPolicy"] {
  return {
    profileHints: policy.profileHints.map(cloneProfileHint),
    receipts: policy.receipts.map(cloneVerificationReceipt),
    waivers: policy.waivers.map((waiver) => ({ ...waiver })),
    disabledTaskKinds: [...policy.disabledTaskKinds],
    responsibilityTaskOverrides: Object.fromEntries(
      Object.entries(policy.responsibilityTaskOverrides).map(([responsibility, taskKinds]) => [
        responsibility,
        [...(taskKinds ?? [])],
      ]),
    ),
    taskContractOverrides: Object.fromEntries(
      Object.entries(policy.taskContractOverrides).map(([kind, contract]) => [
        kind,
        contract === undefined ? undefined : cloneTaskContract(contract),
      ]),
    ),
    skillBindings: Object.fromEntries(
      Object.entries(policy.skillBindings).map(([kind, binding]) => [
        kind,
        binding === undefined ? undefined : { ...binding },
      ]),
    ),
    skillDescriptors: policy.skillDescriptors.map(cloneSkillDescriptor),
    dependencySignals: policy.dependencySignals.map(cloneDependencySignal),
  };
}

function cloneProfileHint(
  hint: TypeScriptVerificationProfileHint,
): TypeScriptVerificationProfileHint {
  const cloned: TypeScriptVerificationProfileHint = {
    ownerPath: hint.ownerPath,
    responsibilities: [...hint.responsibilities],
    taskContractOverrides: Object.fromEntries(
      Object.entries(hint.taskContractOverrides).map(([kind, contract]) => [
        kind,
        contract === undefined ? undefined : cloneTaskContract(contract),
      ]),
    ),
  };
  const taskKinds = hint.taskKinds === undefined ? {} : { taskKinds: [...hint.taskKinds] };
  const rationale = hint.rationale === undefined ? {} : { rationale: hint.rationale };
  return { ...cloned, ...taskKinds, ...rationale };
}

function cloneVerificationReceipt(
  receipt: TypeScriptVerificationReceipt,
): TypeScriptVerificationReceipt {
  const summary = receipt.summary === undefined ? {} : { summary: receipt.summary };
  const evidenceUri = receipt.evidenceUri === undefined ? {} : { evidenceUri: receipt.evidenceUri };
  const observedAt = receipt.observedAt === undefined ? {} : { observedAt: receipt.observedAt };
  return {
    ...receipt,
    ...summary,
    ...evidenceUri,
    ...observedAt,
    evidence: receipt.evidence.map((fact) => ({ ...fact })),
  };
}

function cloneTaskContract(
  contract: TypeScriptVerificationTaskContract,
): TypeScriptVerificationTaskContract {
  return {
    phase: contract.phase,
    requiredReceipt: contract.requiredReceipt,
    requiredEvidence: contract.requiredEvidence.map((requirement) => ({ ...requirement })),
  };
}

function cloneSkillDescriptor(
  descriptor: TypeScriptVerificationSkillDescriptor,
): TypeScriptVerificationSkillDescriptor {
  const adapter = descriptor.adapter === undefined ? {} : { adapter: descriptor.adapter };
  return {
    skillId: descriptor.skillId,
    ...adapter,
    tool: descriptor.tool,
    command: descriptor.command,
    standard: descriptor.standard,
    requiredInputs: [...descriptor.requiredInputs],
    passCriteria: [...descriptor.passCriteria],
    receiptFields: [...descriptor.receiptFields],
  };
}

function cloneDependencySignal(
  signal: TypeScriptVerificationDependencySignal,
): TypeScriptVerificationDependencySignal {
  return {
    dependency: signal.dependency,
    responsibilities: [...signal.responsibilities],
  };
}

function skillBindingLabel(binding: {
  readonly skillId: string;
  readonly adapter?: string;
}): string {
  const adapter = binding.adapter?.trim();
  return adapter === undefined || adapter.length === 0
    ? binding.skillId
    : `${binding.skillId}@${adapter}`;
}
