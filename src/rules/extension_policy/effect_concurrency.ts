import type {
  TypeScriptEffectConcurrencySignalFact,
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { effectPolicyIsActive, sourceModules } from "./effect_modules.js";

export const TS_EXT_EFFECT_R008: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R008",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect async batches should declare concurrency policy",
  requirement:
    "Effect projects should model async batches with Effect collection combinators and an explicit concurrency/failure policy instead of unbounded Promise fan-out or accidental sequential await loops.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export function evaluateEffectConcurrencyAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectConcurrencyAdviceForModule(moduleReport),
  );
}

function effectConcurrencyAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.effectConcurrencySignals[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R008.ruleId,
      packId: TS_EXT_EFFECT_R008.packId,
      severity: TS_EXT_EFFECT_R008.severity,
      title: TS_EXT_EFFECT_R008.title,
      summary: `Async batch work lacks explicit Effect concurrency policy: ${renderConcurrencySignals(
        moduleReport.effectConcurrencySignals,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R008.requirement,
      ...sourceLineField(first.sourceLine),
      label: "declare Effect concurrency and failure policy",
      labels: {
        ...TS_EXT_EFFECT_R008.labels,
        module_role: moduleReport.role,
        concurrency_signals: moduleReport.effectConcurrencySignals
          .map((signal) => `${signal.ownerName}:${signal.callee}`)
          .join(","),
        concurrency_kinds: [
          ...new Set(moduleReport.effectConcurrencySignals.map((signal) => signal.signalKind)),
        ]
          .sort()
          .join(","),
      },
    },
  ];
}

function renderConcurrencySignals(
  signals: readonly TypeScriptEffectConcurrencySignalFact[],
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
