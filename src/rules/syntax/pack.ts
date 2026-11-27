import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { diagnosticFinding } from "../common.js";

const TS_SYN_R001: AspTypeScriptRule = {
  ruleId: "TS-SYN-R001",
  packId: "typescript.syntax",
  severity: "error",
  title: "TypeScript source must parse",
  requirement: "TypeScript source must parse through the TypeScript Compiler API.",
  labels: { surface: "source", parser: "typescript" },
};

export function typeScriptSyntaxRules(): readonly AspTypeScriptRule[] {
  return [TS_SYN_R001];
}

export function evaluateSyntaxRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.diagnostics
    .filter((diagnostic) => diagnostic.phase === "syntax")
    .map((diagnostic) =>
      diagnosticFinding(TS_SYN_R001, diagnostic, "TypeScript parser diagnostic"),
    );
}
