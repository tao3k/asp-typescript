import type {
  TypeScriptEffectSchemaBoundarySignalFact,
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { effectPolicyIsActive, sourceModules } from "./effect_modules.js";

export const TS_EXT_EFFECT_R009: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R009",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect JSON boundaries should use Schema validation",
  requirement:
    "Effect projects should decode untrusted JSON boundaries with Effect Schema, such as Schema.decodeUnknown or Schema.parseJson, so boundary validation and parse errors stay typed and visible to agents.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export function evaluateEffectSchemaBoundaryAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectSchemaBoundaryAdviceForModule(moduleReport),
  );
}

function effectSchemaBoundaryAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.effectSchemaBoundarySignals[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R009.ruleId,
      packId: TS_EXT_EFFECT_R009.packId,
      severity: TS_EXT_EFFECT_R009.severity,
      title: TS_EXT_EFFECT_R009.title,
      summary: `Public JSON boundary lacks Effect Schema validation: ${renderSchemaBoundarySignals(
        moduleReport.effectSchemaBoundarySignals,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R009.requirement,
      ...sourceLineField(first.sourceLine),
      label: "decode JSON boundaries with Effect Schema",
      labels: {
        ...TS_EXT_EFFECT_R009.labels,
        module_role: moduleReport.role,
        schema_boundary: moduleReport.effectSchemaBoundarySignals
          .map((signal) => signal.ownerName)
          .join(","),
        schema_boundary_kinds: [
          ...new Set(moduleReport.effectSchemaBoundarySignals.map((signal) => signal.signalKind)),
        ]
          .sort()
          .join(","),
      },
    },
  ];
}

function renderSchemaBoundarySignals(
  signals: readonly TypeScriptEffectSchemaBoundarySignalFact[],
): string {
  return cappedNames(
    signals.map((signal) => `${signal.ownerName}:${signal.callee}`),
    6,
  );
}

function cappedNames(names: readonly string[], max: number): string {
  const selected = names.slice(0, max);
  const suffix = names.length > selected.length ? `,+${names.length - selected.length}` : "";
  return `${selected.join(", ")}${suffix}`;
}

function sourceLineField(sourceLine: string | undefined): { readonly sourceLine?: string } {
  return sourceLine === undefined ? {} : { sourceLine };
}
