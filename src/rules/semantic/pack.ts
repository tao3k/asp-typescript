import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { diagnosticFinding } from "../common.js";

const TS_SEM_R001: AspTypeScriptRule = {
  ruleId: "TS-SEM-R001",
  packId: "typescript.semantic",
  severity: "info",
  title: "TypeScript semantic diagnostics should be visible",
  requirement:
    "TypeScript Program semantic diagnostics should be visible from parser-native facts without replacing tsc.",
  labels: { surface: "source", parser: "typescript-program" },
};

export function typeScriptSemanticRules(): readonly AspTypeScriptRule[] {
  return [TS_SEM_R001];
}

export function evaluateSemanticRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.diagnostics
    .filter((diagnostic) => diagnostic.phase === "semantic")
    .map((diagnostic) =>
      diagnosticFinding(TS_SEM_R001, diagnostic, "TypeScript semantic diagnostic"),
    );
}
