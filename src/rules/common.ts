import type {
  SourceLocation,
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningTree,
} from "../model.js";
import { relativeProjectPath } from "../reasoning/path_utils.js";

export interface DiagnosticFactLike {
  readonly code: number;
  readonly message: string;
  readonly location: SourceLocation;
  readonly sourceLine?: string;
}

export function diagnosticFinding(
  rule: AspTypeScriptRule,
  diagnostic: DiagnosticFactLike,
  label: string,
): AspTypeScriptFinding {
  const finding: AspTypeScriptFinding = {
    ruleId: rule.ruleId,
    packId: rule.packId,
    severity: rule.severity,
    title: rule.title,
    summary: diagnosticSummary(diagnostic),
    location: diagnostic.location,
    requirement: rule.requirement,
    label,
    labels: rule.labels,
  };
  return diagnostic.sourceLine === undefined
    ? finding
    : { ...finding, sourceLine: diagnostic.sourceLine };
}

export function relativeToProject(
  reasoningTree: TypeScriptReasoningTree,
  filePath: string,
): string {
  return relativeProjectPath(reasoningTree.projectRoot, filePath);
}

function diagnosticSummary(diagnostic: DiagnosticFactLike): string {
  return `${diagnosticCodeLabel(diagnostic.code)}: ${diagnostic.message}`;
}

function diagnosticCodeLabel(code: number): string {
  return `TS${code}`;
}
