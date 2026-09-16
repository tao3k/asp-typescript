import { advisoryFindings, blockingFindings } from "../model.js";
import type {
  AspTypeScriptFinding,
  AspTypeScriptReport,
  TypeScriptPackageExtensionFact,
} from "../model.js";
import {
  effectAdviceFixSteps,
  effectAgentTaskTitle,
  effectParserEvidenceText,
  effectProblemText,
} from "./effect_agent_compact_text.js";
import {
  reactAdviceFixSteps,
  reactAgentTaskTitle,
  reactParserEvidenceText,
  reactProblemText,
} from "./react_agent_compact_text.js";
import { relativeProjectPath } from "../reasoning/path_utils.js";

const MAX_ADVICE_ACTIONS = 8;
const MAX_TARGET_EXAMPLES = 4;
const MAX_TARGET_GROUPS = 6;

export type TypeScriptAgentCompactTextFindingMode = "advice" | "blocking" | "all";

export interface TypeScriptAgentCompactTextOptions {
  readonly findings?: TypeScriptAgentCompactTextFindingMode;
  readonly maxActionGroups?: number;
  readonly maxTargetExamples?: number;
  readonly maxTargetGroups?: number;
}

interface AdviceGroup {
  readonly count: number;
  readonly finding: AspTypeScriptFinding;
  readonly findings: readonly AspTypeScriptFinding[];
}

export function renderAspTypeScriptAgentCompactText(
  report: AspTypeScriptReport,
  options: TypeScriptAgentCompactTextOptions = {},
): string {
  const findingMode = options.findings ?? "advice";
  const findings = selectAgentCompactFindings(report, findingMode);
  if (findings.length === 0) {
    return "";
  }
  const groups = groupedAdviceFindings(findings);
  const maxActionGroups = options.maxActionGroups ?? MAX_ADVICE_ACTIONS;
  const maxTargetExamples = options.maxTargetExamples ?? MAX_TARGET_EXAMPLES;
  const maxTargetGroups = options.maxTargetGroups ?? MAX_TARGET_GROUPS;
  return [
    `AgentCompactText: mode=${findingMode} findings=${findings.length} tasks=${groups.length}`,
    "Directive: edit listed targets, apply fix steps, rerun ASP TypeScript.",
    "RepairTasks:",
    ...compactLines(
      groups.map((group, index) =>
        renderRepairTask(report, group, index + 1, maxTargetExamples, maxTargetGroups),
      ),
      maxActionGroups,
      "repair tasks",
    ),
  ].join("\n");
}

export function renderAspTypeScriptAdvice(report: AspTypeScriptReport): string {
  return renderAspTypeScriptAgentCompactText(report, { findings: "advice" });
}

function selectAgentCompactFindings(
  report: AspTypeScriptReport,
  findingMode: TypeScriptAgentCompactTextFindingMode,
): readonly AspTypeScriptFinding[] {
  switch (findingMode) {
    case "advice":
      return advisoryFindings(report);
    case "blocking":
      return blockingFindings(report);
    case "all":
      return report.findings;
  }
}

function groupedAdviceFindings(findings: readonly AspTypeScriptFinding[]): AdviceGroup[] {
  const groups = new Map<
    string,
    { count: number; finding: AspTypeScriptFinding; findings: AspTypeScriptFinding[] }
  >();
  for (const finding of findings) {
    const key = `${finding.severity}\0${finding.ruleId}\0${finding.title}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { count: 1, finding, findings: [finding] });
      continue;
    }
    group.count += 1;
    group.findings.push(finding);
  }
  return [...groups.values()].sort(compareAdviceGroups);
}

function compareAdviceGroups(left: AdviceGroup, right: AdviceGroup): number {
  const priority = adviceGroupPriority(left.finding) - adviceGroupPriority(right.finding);
  if (priority !== 0) {
    return priority;
  }
  return `${left.finding.severity}:${left.finding.ruleId}:${left.finding.title}`.localeCompare(
    `${right.finding.severity}:${right.finding.ruleId}:${right.finding.title}`,
  );
}

function adviceGroupPriority(finding: AspTypeScriptFinding): number {
  return severityPriority(finding.severity) * 100 + packPriority(finding.packId);
}

function severityPriority(severity: AspTypeScriptFinding["severity"]): number {
  switch (severity) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
  }
}

function packPriority(packId: AspTypeScriptFinding["packId"]): number {
  switch (packId) {
    case "typescript.extension_policy":
      return 0;
    case "typescript.agent_policy":
      return 1;
    case "typescript.modularity":
      return 2;
    case "typescript.test_layout":
      return 3;
    case "typescript.semantic":
      return 4;
    case "typescript.project_policy":
      return 5;
    case "typescript.syntax":
      return 6;
    default:
      return 9;
  }
}

function renderRepairTask(
  report: AspTypeScriptReport,
  group: AdviceGroup,
  index: number,
  maxTargetExamples: number,
  maxTargetGroups: number,
): string {
  const finding = group.finding;
  const lines = [`- ${renderTaskHeader(finding, group.count, index)}`];
  lines.push(
    ...projectCoverageLines(report, group, maxTargetGroups),
    "  fix:",
    ...adviceFixSteps(finding).map((step) => `   - ${step}`),
    "  targets:",
    ...compactTargetLines(
      group.findings.map((target) => renderTargetExample(report, target)),
      maxTargetExamples,
    ),
  );
  return lines.join("\n");
}

function projectCoverageLines(
  report: AspTypeScriptReport,
  group: AdviceGroup,
  maxTargetGroups: number,
): readonly string[] {
  if (!isKnownExtensionFinding(group.finding)) {
    return [];
  }
  const extension = extensionFact(report, group.finding);
  if (extension === undefined) {
    return [];
  }
  const targetGroups = groupedTargetOwners(report, group.findings);
  return [
    `  coverage: ${extension.coverage} activation=${extension.activation}${extensionSourceLabel(
      extension,
    )} targets=${group.count} files=${uniqueTargetFileCount(group.findings)} groups=${targetGroups.length}`,
    "  target_groups:",
    ...compactTargetGroupLines(
      targetGroups.map((targetGroup) => renderTargetGroup(targetGroup)),
      maxTargetGroups,
    ),
  ];
}

function isKnownExtensionFinding(finding: AspTypeScriptFinding): boolean {
  return extensionNameForFinding(finding) !== undefined;
}

function extensionNameForFinding(finding: AspTypeScriptFinding): "effect" | "react" | undefined {
  if (finding.ruleId.startsWith("TS-EXT-EFFECT-")) {
    return "effect";
  }
  if (finding.ruleId.startsWith("TS-EXT-REACT-")) {
    return "react";
  }
  return undefined;
}

function extensionFact(
  report: AspTypeScriptReport,
  finding: AspTypeScriptFinding,
): TypeScriptPackageExtensionFact | undefined {
  const extensionName = extensionNameForFinding(finding);
  return report.reasoningTree.packageExtensions.find(
    (extension) => extension.name === extensionName,
  );
}

function extensionSourceLabel(extension: TypeScriptPackageExtensionFact): string {
  const labels = [];
  if (extension.dependencySource !== undefined) {
    labels.push(`dependency=${extension.dependencySource}`);
  }
  if (extension.configSource !== undefined) {
    labels.push(`config=${extension.configSource}`);
  }
  return labels.length === 0 ? "" : ` ${labels.join(" ")}`;
}

interface TargetOwnerGroup {
  readonly owner: string;
  readonly count: number;
  readonly first: AspTypeScriptFinding;
}

function groupedTargetOwners(
  report: AspTypeScriptReport,
  findings: readonly AspTypeScriptFinding[],
): readonly TargetOwnerGroup[] {
  const groups = new Map<string, { count: number; first: AspTypeScriptFinding }>();
  for (const finding of findings) {
    const owner = targetOwnerPath(report, finding);
    const existing = groups.get(owner);
    if (existing === undefined) {
      groups.set(owner, { count: 1, first: finding });
      continue;
    }
    existing.count += 1;
  }
  return [...groups.entries()]
    .map(([owner, group]) => ({ owner, count: group.count, first: group.first }))
    .sort((left, right) => right.count - left.count || left.owner.localeCompare(right.owner));
}

function targetOwnerPath(report: AspTypeScriptReport, finding: AspTypeScriptFinding): string {
  const rawPath = finding.location.path;
  if (rawPath === undefined) {
    return "<project>";
  }
  const relativePath = relativeProjectPath(report.reasoningTree.projectRoot, rawPath);
  const parts = relativePath.split("/").filter((part) => part.length > 0);
  return parts.length <= 3 ? relativePath : parts.slice(0, 3).join("/");
}

function renderTargetGroup(group: TargetOwnerGroup): string {
  const surfaces =
    group.first.labels.async_surfaces ??
    group.first.labels.runtime_calls ??
    group.first.labels.concurrency_signals ??
    group.first.labels.resource_scope ??
    group.first.labels.schema_boundary ??
    group.first.labels.production_boundary ??
    group.first.labels.react_purity ??
    group.first.labels.react_hook_calls ??
    group.first.labels.react_static_definitions;
  const suffix = surfaces === undefined || surfaces === "" ? "" : ` first=${surfaces}`;
  return `   - ${group.owner} x${group.count}${suffix}`;
}

function uniqueTargetFileCount(findings: readonly AspTypeScriptFinding[]): number {
  return new Set(findings.map((finding) => finding.location.path ?? "<project>")).size;
}

function renderTaskHeader(finding: AspTypeScriptFinding, count: number, index: number): string {
  const context = compactTaskContext(finding);
  const contextSuffix = context === "" ? "" : ` (${context})`;
  return `[${finding.ruleId}] ${capitalizeSeverity(finding.severity)} x${count}: ${agentTaskTitle(
    finding,
  )}${contextSuffix} task=${index}`;
}

function capitalizeSeverity(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function agentTaskTitle(finding: AspTypeScriptFinding): string {
  const effectTitle = effectAgentTaskTitle(finding);
  if (effectTitle !== undefined) {
    return effectTitle;
  }
  const reactTitle = reactAgentTaskTitle(finding);
  if (reactTitle !== undefined) {
    return reactTitle;
  }
  switch (finding.ruleId) {
    case "TS-AGENT-POLICY-009":
      return "Make public DTO/domain fields carry typed meaning";
    case "TS-AGENT-POLICY-010":
      return "Replace primitive semantic aliases with real domain types";
    case "TS-AGENT-POLICY-011":
      return "Replace stringly state fields with finite typed states";
    case "TS-AGENT-POLICY-012":
      return "Give discriminated-union payloads named domain shapes";
    case "TS-AGENT-PROJECT-006":
      return "Expose Rspack build surface through npm scripts";
    default:
      return finding.title;
  }
}

function adviceFixSteps(finding: AspTypeScriptFinding): readonly string[] {
  const effectSteps = effectAdviceFixSteps(finding);
  if (effectSteps !== undefined) {
    return effectSteps;
  }
  const reactSteps = reactAdviceFixSteps(finding);
  if (reactSteps !== undefined) {
    return reactSteps;
  }
  switch (finding.ruleId) {
    case "TS-AGENT-POLICY-009":
      return [
        "edit the exported interface/type/class fields named in targets",
        "replace repeated primitive ids, paths, flags, and urls with branded aliases or named domain objects",
        "if raw JSON is intentional, name the boundary as DTO/Payload and keep the raw shape at the adapter edge",
      ];
    case "TS-AGENT-POLICY-010":
      return [
        "replace aliases such as `export type OwnerId = string` with branded/opaque aliases or named value objects",
        "keep finite literal-union catalog aliases as the typed boundary",
      ];
    case "TS-AGENT-POLICY-011":
      return [
        "replace raw `status: string`, `kind: string`, `mode: string`, or similar state fields",
        "use string-literal unions, public enums, branded state types, or typed catalog boundaries",
      ];
    case "TS-AGENT-POLICY-012":
      return [
        "move primitive discriminated-union payload fields into named payload/domain types",
        "prefer a named payload object such as `UserLoadedPayload` with branded ids",
      ];
    case "TS-AGENT-PROJECT-006":
      return [
        "add or update package scripts so `npm run build` or an equivalent script runs `rspack build`",
        "keep `tsc --noEmit` in `npm run check` when the project still needs TypeScript type checking",
        "if declaration output is required, keep a separate `tsc --emitDeclarationOnly` or `tsc` build step",
      ];
    case "TS-AGENT-POLICY-013":
      return [
        "add a module-level JSDoc comment (/** ... */) describing the module's public API and responsibility",
        "example from Effect-TS: Brand.ts opens with 20 lines explaining refined vs nominal branding",
      ];
    case "TS-AGENT-POLICY-014":
      return [
        "replace dense named imports with a namespace import: `import * as X from './module.js'`",
        "example from Effect-TS: `import * as Arr from './Array.js'` instead of importing 10 symbols individually",
      ];
    case "TS-AGENT-POLICY-015":
      return [
        "split the facade into sub-domain barrels (e.g., Schema.ts, Cause.ts, Fiber.ts)",
        "each sub-domain barrel should export only symbols for that domain",
        "example from Effect-TS: each file in src/ is a self-contained sub-domain barrel",
      ];
    case "TS-AGENT-POLICY-016":
      return [
        "add a JSDoc comment for each error/exception type explaining when it occurs",
        "document the failure condition, not just the type name",
        "example from Effect-TS: ConfigError.ts documents when each variant (MissingData, InvalidData, etc.) fires",
      ];
    case "TS-AGENT-POLICY-007":
      return [
        "extract deeply nested logic into small, flat helper functions",
        "each function should handle one level of control flow (condition, loop, or branch)",
        "example from Effect-TS: internal/fiberRuntime.ts extracts ScopeImpl and FiberRuntime as separate classes",
      ];
    case "TS-EXT-SHADCN-R001":
      return [
        "add `tailwindcss` to package.json dependencies",
        "the shadcn/ui extension requires tailwindcss to validate component styling",
      ];
    case "TS-EXT-SHADCN-R002":
      return [
        "import and use the `cn()` utility from `@/lib/utils` for className merging",
        "replace manual string concatenation of class names with `cn()` calls",
      ];
    case "TS-EXT-SHADCN-R003":
      return [
        "add a Zod schema for the configuration object",
        "use `.strict()` to reject unknown properties and `.refine()` for custom validation",
        "example from shadcn/ui: every config object has a corresponding Zod schema",
      ];
    default:
      return ["open the target, apply the rule contract in source, and rerun ASP TypeScript"];
  }
}

function problemText(finding: AspTypeScriptFinding): string {
  const effectProblem = effectProblemText(finding);
  if (effectProblem !== undefined) {
    return effectProblem;
  }
  const reactProblem = reactProblemText(finding);
  if (reactProblem !== undefined) {
    return reactProblem;
  }
  switch (finding.ruleId) {
    case "TS-AGENT-POLICY-009":
      return "public exported data shape uses primitive fields for domain meaning";
    case "TS-AGENT-POLICY-010":
      return "public semantic type alias is only a primitive carrier";
    case "TS-AGENT-POLICY-011":
      return "public data shape uses raw string for finite state/kind/mode";
    case "TS-AGENT-POLICY-012":
      return "public discriminated-union variant carries primitive semantic payload fields";
    case "TS-AGENT-PROJECT-006":
      return "Rspack is configured or installed but not exposed through package scripts";
    default:
      return finding.label;
  }
}

function adviceParserEvidenceText(finding: AspTypeScriptFinding): string {
  const effectEvidence = effectParserEvidenceText(finding);
  if (effectEvidence !== undefined) {
    return effectEvidence;
  }
  const reactEvidence = reactParserEvidenceText(finding);
  if (reactEvidence !== undefined) {
    return reactEvidence;
  }
  switch (finding.ruleId) {
    case "TS-AGENT-POLICY-009":
    case "TS-AGENT-POLICY-010":
    case "TS-AGENT-POLICY-011":
    case "TS-AGENT-POLICY-012":
      return "native exported TypeScript type/API facts";
    case "TS-AGENT-PROJECT-006":
      return "package.json dependency/script facts + Rspack config files";
    default:
      return "";
  }
}

function compactTaskContext(finding: AspTypeScriptFinding): string {
  const parts = [problemText(finding)];
  const parserEvidence = adviceParserEvidenceText(finding);
  if (parserEvidence !== "") {
    parts.push(`facts: ${parserEvidence}`);
  }
  return parts.join("; ");
}

function renderTargetExample(report: AspTypeScriptReport, finding: AspTypeScriptFinding): string {
  return `   - @ ${renderLocation(report, finding)} ${targetDetailText(finding)}`;
}

function targetDetailText(finding: AspTypeScriptFinding): string {
  switch (finding.ruleId) {
    case "TS-EXT-EFFECT-R002":
      return labelValue("apis", finding.labels.async_surfaces) ?? finding.label;
    case "TS-EXT-EFFECT-R003":
      return labelValue("calls", finding.labels.runtime_calls) ?? finding.label;
    case "TS-EXT-EFFECT-R004":
      return labelValue("method", finding.labels.method) ?? finding.label;
    case "TS-EXT-EFFECT-R005":
      return labelValue("surfaces", finding.labels.error_surfaces) ?? finding.label;
    case "TS-EXT-EFFECT-R006":
      return labelValue("interop", finding.labels.promise_interop) ?? finding.label;
    case "TS-EXT-EFFECT-R007":
      return labelValue("resource", finding.labels.resource_scope) ?? finding.label;
    case "TS-EXT-EFFECT-R008":
      return labelValue("batch", finding.labels.concurrency_signals) ?? finding.label;
    case "TS-EXT-EFFECT-R009":
      return labelValue("json", finding.labels.schema_boundary) ?? finding.label;
    case "TS-EXT-EFFECT-R010":
      return labelValue("io", finding.labels.production_boundary) ?? finding.label;
    case "TS-EXT-REACT-R002":
      return labelValue("purity", finding.labels.react_purity) ?? finding.label;
    case "TS-EXT-REACT-R003":
      return labelValue("hooks", finding.labels.react_hook_calls) ?? finding.label;
    case "TS-EXT-REACT-R004":
      return labelValue("definitions", finding.labels.react_static_definitions) ?? finding.label;
    case "TS-AGENT-POLICY-010":
      return labelValue("alias", finding.labels.alias) ?? finding.label;
    default:
      return finding.label;
  }
}

function labelValue(label: string, value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : `${label}=${value}`;
}

function renderLocation(report: AspTypeScriptReport, finding: AspTypeScriptFinding): string {
  const rawPath = finding.location.path ?? "<project>";
  const displayPath =
    rawPath === "<project>"
      ? rawPath
      : relativeProjectPath(report.reasoningTree.projectRoot, rawPath);
  return `${displayPath}:${finding.location.line}:${finding.location.column + 1}`;
}

function compactLines(lines: readonly string[], maxLines: number, label: string): string[] {
  if (lines.length <= maxLines) {
    return [...lines];
  }
  return [...lines.slice(0, maxLines), ` - ... +${lines.length - maxLines} ${label}`];
}

function compactTargetLines(lines: readonly string[], maxLines: number): string[] {
  if (lines.length <= maxLines) {
    return [...lines];
  }
  return [...lines.slice(0, maxLines), `   - ... +${lines.length - maxLines} target examples`];
}

function compactTargetGroupLines(lines: readonly string[], maxLines: number): string[] {
  if (lines.length <= maxLines) {
    return [...lines];
  }
  return [...lines.slice(0, maxLines), `   - ... +${lines.length - maxLines} target groups`];
}
