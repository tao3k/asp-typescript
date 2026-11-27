import type {
  TypeScriptEffectProductionBoundarySignalFact,
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { effectPolicyIsActive, sourceModules } from "./effect_modules.js";

export const TS_EXT_EFFECT_R010: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R010",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect external operations should expose production policy",
  requirement:
    "Effect projects should wrap public external IO boundaries with observability and resilience policy, such as Effect.withSpan, log annotations, metrics, Effect.retry, and Effect.timeout.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export function evaluateEffectProductionBoundaryAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectProductionBoundaryAdviceForModule(moduleReport),
  );
}

function effectProductionBoundaryAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.effectProductionBoundarySignals[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R010.ruleId,
      packId: TS_EXT_EFFECT_R010.packId,
      severity: TS_EXT_EFFECT_R010.severity,
      title: TS_EXT_EFFECT_R010.title,
      summary: `Public Effect external IO boundary lacks production policy: ${renderProductionBoundarySignals(
        moduleReport.effectProductionBoundarySignals,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R010.requirement,
      ...sourceLineField(first.sourceLine),
      label: "add Effect observability and resilience policy",
      labels: {
        ...TS_EXT_EFFECT_R010.labels,
        module_role: moduleReport.role,
        production_boundary: moduleReport.effectProductionBoundarySignals
          .map((signal) => signal.ownerName)
          .join(","),
        production_boundary_kinds: [
          ...new Set(
            moduleReport.effectProductionBoundarySignals.map((signal) => signal.signalKind),
          ),
        ]
          .sort()
          .join(","),
        missing_capabilities: [
          ...new Set(
            moduleReport.effectProductionBoundarySignals.flatMap(
              (signal) => signal.missingCapabilities,
            ),
          ),
        ]
          .sort()
          .join(","),
      },
    },
  ];
}

function renderProductionBoundarySignals(
  signals: readonly TypeScriptEffectProductionBoundarySignalFact[],
): string {
  return cappedNames(
    signals.map(
      (signal) => `${signal.ownerName}:${signal.callee}:${signal.missingCapabilities.join("+")}`,
    ),
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
