import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptPackageEntryResolutionFact,
  TypeScriptPublicFunctionControlFlowFact,
  TypeScriptPublicFunctionParamFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningOwnerBranchFact,
  TypeScriptReasoningTree,
} from "../../model.js";
import {
  TS_AGENT_R009,
  TS_AGENT_R010,
  TS_AGENT_R011,
  TS_AGENT_R012,
  evaluateNativeDataShapeAdvice,
} from "./data_shape.js";
import {
  CONTROL_FLOW_BROAD_LINEAR_PHASE,
  CONTROL_FLOW_DECISION_STACK,
  CONTROL_FLOW_LITERAL_DISPATCH_CHAIN,
  CONTROL_FLOW_TRAVERSAL_KNOT,
  formatAgentSoftwareCriteria,
  NATIVE_IDIOM_MANUAL_TRANSFORM_LOOP,
  withAgentSoftwareCriteria,
} from "./software_criteria.js";

const TS_AGENT_R001: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-001",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Project import should resolve to an owner",
  requirement:
    "Relative, path-alias, and package-import TypeScript imports should resolve to a parser-visible project owner or be documented as non-TypeScript assets.",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

const TS_AGENT_R002: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-002",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Package entry should resolve to an owner",
  requirement:
    "Package exports and imports should point to parser-visible TypeScript owners or documented external artifacts.",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

const TS_AGENT_R003: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-003",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Facade with multiple owners needs intent",
  requirement:
    "Facade index modules that re-export multiple owners should include a local intent doc before exports.",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

const TS_AGENT_R004: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-004",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public function exposes multiple flag parameters",
  requirement:
    "Replace multiple public boolean mode parameters with a named options object or discriminated union so agents can preserve mode semantics without reading every branch.",
  labels: { surface: "agent", parser: "native-syntax" },
};

const TS_AGENT_R005: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-005",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public function exposes a broad positional parameter surface",
  requirement:
    "Replace broad public positional parameter lists with a named options, request, or builder surface so agents can preserve call semantics without re-reading every call site.",
  labels: { surface: "agent", parser: "native-syntax" },
};

const TS_AGENT_R006: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-006",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public API exposes an anonymous primitive tuple",
  requirement:
    "Replace public tuple parameters or return values that bundle primitive semantic values with named object, tuple alias, or domain types so agents can preserve field intent.",
  labels: { surface: "agent", parser: "native-syntax" },
};

const TS_AGENT_R007: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-007",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public function hides algorithm behind nested control flow",
  requirement:
    "Expose public TypeScript algorithm shape through guard clauses, discriminated dispatch, or small named pipeline steps so agents can reason about the branch structure before editing.",
  labels: { surface: "agent", parser: "native-syntax" },
};

const TS_AGENT_R008: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-008",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public function owns a broad linear algorithm surface",
  requirement:
    "Split broad public TypeScript functions into small named helpers or pipeline steps so agents can edit one algorithm responsibility at a time.",
  labels: { surface: "agent", parser: "native-syntax" },
};

const TS_AGENT_R013: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-013",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Exported module should document its public API intent",
  requirement:
    "Modules exporting a public API (>= 3 exports) should carry a module-level JSDoc describing the module's responsibility and contract. Pattern from Effect-TS: every source file begins with a multi-paragraph module doc.",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

const TS_AGENT_R014: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-014",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Module imports many symbols from same source without namespace grouping",
  requirement:
    "When a module imports 5+ named symbols from the same dependency, prefer a namespace import (`import * as X from '...'`) for readability. Pattern from Effect-TS: all local deps use namespace imports.",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

const TS_AGENT_R015: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-015",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Undocumented facade exports too many symbols",
  requirement:
    "An undocumented facade (barrel/index) with >30 re-exports should either document its responsibility groups or split symbols into namespaced sub-modules. Pattern from Effect-TS: each subdomain has its own barrel (e.g., Schema.ts, Cause.ts).",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

const TS_AGENT_R016: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-016",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Domain error/exception types should document when they occur",
  requirement:
    "Public error or exception type exports should carry a JSDoc comment explaining the condition under which each error variant occurs. Pattern from Effect-TS: every error type has @since and description in its JSDoc (e.g., ConfigError.ts, PlatformError.ts).",
  labels: { surface: "agent", parser: "reasoning-tree" },
};

export function typeScriptAgentPolicyRules(): readonly AspTypeScriptRule[] {
  return [
    TS_AGENT_R001,
    TS_AGENT_R002,
    TS_AGENT_R003,
    TS_AGENT_R004,
    TS_AGENT_R005,
    TS_AGENT_R006,
    TS_AGENT_R007,
    TS_AGENT_R008,
    TS_AGENT_R009,
    TS_AGENT_R010,
    TS_AGENT_R011,
    TS_AGENT_R012,
    TS_AGENT_R013,
    TS_AGENT_R014,
    TS_AGENT_R015,
    TS_AGENT_R016,
  ];
}

export function evaluateAgentPolicyRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  const NON_TS_ASSET_EXTENSIONS = [
    ".css",
    ".scss",
    ".less",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".json",
    ".yaml",
    ".yml",
    ".html",
    ".md",
    ".txt",
  ];

  return reasoningTree.ownerDependencies
    .filter((dependency) => {
      if (dependency.resolution !== "unresolved") return false;
      // Skip known non-TypeScript asset imports
      return !NON_TS_ASSET_EXTENSIONS.some((ext) => dependency.moduleSpecifier.endsWith(ext));
    })
    .map((dependency) => ({
      ruleId: TS_AGENT_R001.ruleId,
      packId: TS_AGENT_R001.packId,
      severity: TS_AGENT_R001.severity,
      title: TS_AGENT_R001.title,
      summary: `Project import '${dependency.moduleSpecifier}' does not resolve to a parser-visible TypeScript owner.`,
      location: dependency.location,
      requirement: TS_AGENT_R001.requirement,
      label: "unresolved project import edge",
      labels: TS_AGENT_R001.labels,
    }))
    .concat(evaluatePackageEntryAdvice(reasoningTree))
    .concat(evaluateFacadeIntentAdvice(reasoningTree))
    .concat(evaluateNativeApiShapeAdvice(reasoningTree))
    .concat(evaluateNativeAlgorithmShapeAdvice(reasoningTree))
    .concat(evaluateNativeDataShapeAdvice(reasoningTree))
    .concat(evaluateMissingModuleDoc(reasoningTree))
    .concat(evaluateNamedImportDensity(reasoningTree))
    .concat(evaluateFacadeExportDensity(reasoningTree))
    .concat(evaluateUndocumentedErrorTypes(reasoningTree));
}

function evaluatePackageEntryAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.packageEntryResolutions
    .filter(
      (entry): entry is TypeScriptPackageEntryResolutionFact =>
        entry.resolution === "unresolved" && (entry.kind === "exports" || entry.kind === "imports"),
    )
    .map((entry) => ({
      ruleId: TS_AGENT_R002.ruleId,
      packId: TS_AGENT_R002.packId,
      severity: TS_AGENT_R002.severity,
      title: TS_AGENT_R002.title,
      summary: `Package ${entry.kind} '${entry.subpath}'${packageConditionsLabel(entry.conditions)} target '${entry.target}' does not resolve to a parser-visible TypeScript owner.`,
      location: entry.location,
      requirement: TS_AGENT_R002.requirement,
      label: "unresolved package entry target",
      labels: TS_AGENT_R002.labels,
    }));
}

function evaluateFacadeIntentAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.ownerBranches.flatMap((branch) => {
    if (!branch.roles.includes("facade") || branch.hasIntentDoc) {
      return [];
    }
    const ownerPaths = new Set(branch.childEdges.flatMap(ownerPath));
    if (ownerPaths.size < 2) {
      return [];
    }
    const firstEdge = branch.childEdges[0];
    return firstEdge === undefined
      ? []
      : [
          {
            ruleId: TS_AGENT_R003.ruleId,
            packId: TS_AGENT_R003.packId,
            severity: TS_AGENT_R003.severity,
            title: TS_AGENT_R003.title,
            summary: `Facade re-exports ${ownerPaths.size} owners without a local intent doc.`,
            location: firstEdge.location,
            requirement: TS_AGENT_R003.requirement,
            label: "facade re-export fan-out",
            labels: TS_AGENT_R003.labels,
          },
        ];
  });
}

function ownerPath(edge: { readonly toPath?: string }): string[] {
  return edge.toPath === undefined ? [] : [edge.toPath];
}

function packageConditionsLabel(conditions: readonly string[]): string {
  return conditions.length === 0 ? "" : ` (${conditions.join("/")})`;
}

function evaluateNativeApiShapeAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return sourceModules(reasoningTree)
    .flatMap((moduleReport) => [
      ...flagParameterAdvice(moduleReport),
      ...broadParameterAdvice(moduleReport),
      ...tupleApiAdvice(moduleReport),
    ])
    .sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)));
}

function flagParameterAdvice(moduleReport: TypeScriptReasoningModule): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R004;
  return groupedFunctionParams(moduleReport.publicFunctionParams).flatMap((params) => {
    const flagParams = params.filter((param) => param.flagContractType !== undefined);
    const first = flagParams[0];
    if (first === undefined || flagParams.length < 2) {
      return [];
    }
    return [
      {
        ruleId: rule.ruleId,
        packId: rule.packId,
        severity: rule.severity,
        title: rule.title,
        summary: `Public function '${first.functionName}' exposes multiple flag parameters: ${flagParams
          .map((param) => `${param.paramName}: ${param.typeText ?? param.flagContractType}`)
          .join(", ")}.`,
        location: first.location,
        requirement: rule.requirement,
        ...sourceLineField(first.sourceLine),
        label: "public function flag parameters",
        labels: rule.labels,
      },
    ];
  });
}

function broadParameterAdvice(moduleReport: TypeScriptReasoningModule): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R005;
  return groupedFunctionParams(moduleReport.publicFunctionParams).flatMap((params) => {
    const first = params[0];
    if (first === undefined || params.length < 6) {
      return [];
    }
    return [
      {
        ruleId: rule.ruleId,
        packId: rule.packId,
        severity: rule.severity,
        title: rule.title,
        summary: `Public function '${first.functionName}' exposes ${params.length} positional parameters.`,
        location: first.location,
        requirement: rule.requirement,
        ...sourceLineField(first.sourceLine),
        label: "public function broad parameters",
        labels: rule.labels,
      },
    ];
  });
}

function tupleApiAdvice(moduleReport: TypeScriptReasoningModule): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R006;
  return moduleReport.publicTupleApiSurfaces.map((surface) => ({
    ruleId: rule.ruleId,
    packId: rule.packId,
    severity: rule.severity,
    title: rule.title,
    summary: `Public function '${surface.functionName}' exposes ${surface.surfaceName} as anonymous tuple with primitive elements: ${surface.elementContractTypes.join(", ")}.`,
    location: surface.location,
    requirement: rule.requirement,
    ...sourceLineField(surface.sourceLine),
    label: "public primitive tuple api",
    labels: rule.labels,
  }));
}

function evaluateNativeAlgorithmShapeAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return sourceModules(reasoningTree)
    .flatMap((moduleReport) => moduleReport.publicFunctionControlFlows)
    .flatMap((controlFlow) => [
      ...nestedAlgorithmAdvice(controlFlow),
      ...broadLinearAlgorithmAdvice(controlFlow),
      ...manualTransformLoopAdvice(controlFlow),
    ])
    .sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)));
}

function nestedAlgorithmAdvice(
  controlFlow: TypeScriptPublicFunctionControlFlowFact,
): AspTypeScriptFinding[] {
  const criteria = nestedAlgorithmCriteria(controlFlow);
  if (criteria.length === 0) {
    return [];
  }
  const rule = TS_AGENT_R007;
  const criterionIds = nestedAlgorithmSoftwareCriteria(criteria);
  return [
    {
      ruleId: rule.ruleId,
      packId: rule.packId,
      severity: rule.severity,
      title: rule.title,
      summary: `Public function '${controlFlow.functionName}' hides algorithm shape. Criteria: ${formatAgentSoftwareCriteria(criterionIds)}.`,
      location: controlFlow.location,
      requirement: rule.requirement,
      ...sourceLineField(controlFlow.sourceLine),
      label: "public function nested algorithm",
      labels: withAgentSoftwareCriteria(rule.labels, criterionIds),
    },
  ];
}

function broadLinearAlgorithmAdvice(
  controlFlow: TypeScriptPublicFunctionControlFlowFact,
): AspTypeScriptFinding[] {
  const criteria = broadLinearAlgorithmCriteria(controlFlow);
  if (criteria.length === 0) {
    return [];
  }
  const rule = TS_AGENT_R008;
  return [
    {
      ruleId: rule.ruleId,
      packId: rule.packId,
      severity: rule.severity,
      title: rule.title,
      summary: `Public function '${controlFlow.functionName}' spans ${controlFlow.lineSpan} lines with ${controlFlow.statementCount} statements and a ${controlFlow.maxBlockStatementCount}-statement block. Criteria: ${formatAgentSoftwareCriteria([CONTROL_FLOW_BROAD_LINEAR_PHASE])}.`,
      location: controlFlow.location,
      requirement: rule.requirement,
      ...sourceLineField(controlFlow.sourceLine),
      label: "public function broad linear algorithm",
      labels: withAgentSoftwareCriteria(rule.labels, [CONTROL_FLOW_BROAD_LINEAR_PHASE]),
    },
  ];
}

function manualTransformLoopAdvice(
  controlFlow: TypeScriptPublicFunctionControlFlowFact,
): AspTypeScriptFinding[] {
  if (controlFlow.manualTransformLoopCount === 0) {
    return [];
  }
  const rule = TS_AGENT_R008;
  return [
    {
      ruleId: rule.ruleId,
      packId: rule.packId,
      severity: rule.severity,
      title: rule.title,
      summary: `Public function '${controlFlow.functionName}' uses ${controlFlow.manualTransformLoopCount} manual transform loop(s). Criteria: ${formatAgentSoftwareCriteria([NATIVE_IDIOM_MANUAL_TRANSFORM_LOOP])}.`,
      location: controlFlow.location,
      requirement: rule.requirement,
      ...sourceLineField(controlFlow.sourceLine),
      label: "public function manual transform loop",
      labels: withAgentSoftwareCriteria(rule.labels, [NATIVE_IDIOM_MANUAL_TRANSFORM_LOOP]),
    },
  ];
}

function nestedAlgorithmCriteria(
  controlFlow: TypeScriptPublicFunctionControlFlowFact,
): readonly string[] {
  return [
    controlFlow.maxNestingDepth >= 5 ? "deep control-flow nesting" : undefined,
    controlFlow.loopCount >= 2 && controlFlow.branchCount >= 4
      ? "nested loops mixed with branches"
      : undefined,
    controlFlow.branchCount >= 12 && controlFlow.loopCount === 0
      ? "large branch surface without dispatch table"
      : undefined,
    controlFlow.maxLiteralDispatchChain >= 4 ? "literal dispatch chain without switch" : undefined,
  ].filter((signal): signal is string => signal !== undefined);
}

function nestedAlgorithmSoftwareCriteria(criteria: readonly string[]): readonly string[] {
  const criterionIds: string[] = [];
  for (const signal of criteria) {
    if (
      signal === "deep control-flow nesting" ||
      signal === "large branch surface without dispatch table"
    ) {
      pushUnique(criterionIds, CONTROL_FLOW_DECISION_STACK);
    } else if (signal === "nested loops mixed with branches") {
      pushUnique(criterionIds, CONTROL_FLOW_TRAVERSAL_KNOT);
    } else if (signal === "literal dispatch chain without switch") {
      pushUnique(criterionIds, CONTROL_FLOW_LITERAL_DISPATCH_CHAIN);
    }
  }
  return criterionIds;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function broadLinearAlgorithmCriteria(
  controlFlow: TypeScriptPublicFunctionControlFlowFact,
): readonly string[] {
  if (controlFlow.maxNestingDepth > 2) {
    return [];
  }
  return [
    controlFlow.lineSpan >= 90 && controlFlow.statementCount >= 28
      ? "long public function body"
      : undefined,
    controlFlow.maxBlockStatementCount >= 22 ? "large linear statement block" : undefined,
  ].filter((signal): signal is string => signal !== undefined);
}

function groupedFunctionParams(
  params: readonly TypeScriptPublicFunctionParamFact[],
): readonly (readonly TypeScriptPublicFunctionParamFact[])[] {
  const groups = new Map<string, TypeScriptPublicFunctionParamFact[]>();
  for (const param of params) {
    const key = `${param.functionName}\0${param.functionLine}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, [param]);
      continue;
    }
    existing.push(param);
  }
  return [...groups.values()];
}

function sourceModules(tree: TypeScriptReasoningTree): readonly TypeScriptReasoningModule[] {
  return tree.modules.filter(
    (moduleReport) =>
      moduleReport.isValid &&
      moduleReport.role !== "test" &&
      moduleReport.role !== "declaration" &&
      moduleReport.role !== "config",
  );
}

/** R013: Modules with exports but no module-level documentation. */
function evaluateMissingModuleDoc(reasoningTree: TypeScriptReasoningTree): AspTypeScriptFinding[] {
  return reasoningTree.ownerBranches
    .filter((branch) => moduleNeedsIntentDoc(branch))
    .sort(moduleDocFindingSort)
    .slice(0, 8)
    .map((b) => ({
      ruleId: TS_AGENT_R013.ruleId,
      packId: TS_AGENT_R013.packId,
      severity: TS_AGENT_R013.severity,
      title: TS_AGENT_R013.title,
      summary: `${b.exportNames.length} exports without a module-level JSDoc describing the public API intent.`,
      location: { path: b.path, line: 1, column: 0 },
      requirement: TS_AGENT_R013.requirement,
      label: "missing module doc",
      labels: TS_AGENT_R013.labels,
    }));
}

function moduleNeedsIntentDoc(branch: TypeScriptReasoningOwnerBranchFact): boolean {
  if (branch.hasIntentDoc) {
    return false;
  }
  if (branch.roles.includes("facade")) {
    return branch.exportNames.length >= 3;
  }
  return branch.roles.includes("source") && branch.exportNames.length >= 8;
}

function moduleDocFindingSort(
  left: TypeScriptReasoningOwnerBranchFact,
  right: TypeScriptReasoningOwnerBranchFact,
): number {
  const leftFacade = left.roles.includes("facade") ? 0 : 1;
  const rightFacade = right.roles.includes("facade") ? 0 : 1;
  if (leftFacade !== rightFacade) {
    return leftFacade - rightFacade;
  }
  if (left.exportNames.length !== right.exportNames.length) {
    return right.exportNames.length - left.exportNames.length;
  }
  return left.path.localeCompare(right.path);
}

/** R014: Files importing many symbols from the same dependency. */
function evaluateNamedImportDensity(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.ownerBranches
    .filter((b) => b.roles.includes("source") || b.roles.includes("facade"))
    .flatMap((b) => {
      // Group imports by module specifier
      const groups = new Map<string, number>();
      for (const dep of reasoningTree.ownerDependencies) {
        if (dep.fromPath !== b.path || dep.isTestContext) continue;
        groups.set(dep.moduleSpecifier, (groups.get(dep.moduleSpecifier) ?? 0) + 1);
      }
      const denseImports = [...groups.entries()].filter(([, count]) => count >= 5);
      if (denseImports.length === 0) return [];
      return denseImports.slice(0, 3).map(([specifier, count]) => ({
        ruleId: TS_AGENT_R014.ruleId,
        packId: TS_AGENT_R014.packId,
        severity: TS_AGENT_R014.severity,
        title: TS_AGENT_R014.title,
        summary: `Imports ${count} symbols from '${specifier}' — consider a namespace import (\`import * as X from '${specifier}'\`).`,
        location: { path: b.path, line: 1, column: 0 },
        requirement: TS_AGENT_R014.requirement,
        label: "dense named imports",
        labels: TS_AGENT_R014.labels,
      }));
    })
    .slice(0, 20);
}

/** R015: Facade modules with excessive exports. */
function evaluateFacadeExportDensity(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.ownerBranches
    .filter((b) => b.roles.includes("facade") && !b.hasIntentDoc && b.exportNames.length > 30)
    .slice(0, 10)
    .map((b) => ({
      ruleId: TS_AGENT_R015.ruleId,
      packId: TS_AGENT_R015.packId,
      severity: TS_AGENT_R015.severity,
      title: TS_AGENT_R015.title,
      summary: `Facade re-exports ${b.exportNames.length} symbols — consider splitting into namespaced sub-modules.`,
      location: { path: b.path, line: 1, column: 0 },
      requirement: TS_AGENT_R015.requirement,
      label: "high facade export density",
      labels: TS_AGENT_R015.labels,
    }));
}

/** R016: Domain error types without documentation. */
function evaluateUndocumentedErrorTypes(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  const ERROR_NAME_PATTERNS = ["Error", "Exception", "Failure", "Fault"];
  return reasoningTree.ownerBranches
    .filter(
      (b) =>
        !b.hasIntentDoc &&
        b.exportNames.filter((name) =>
          ERROR_NAME_PATTERNS.some((pattern) => name.includes(pattern)),
        ).length >= 2 &&
        (b.roles.includes("source") || b.roles.includes("facade")),
    )
    .slice(0, 20)
    .map((b) => {
      const errorExports = b.exportNames.filter((name) =>
        ERROR_NAME_PATTERNS.some((p) => name.includes(p)),
      );
      return {
        ruleId: TS_AGENT_R016.ruleId,
        packId: TS_AGENT_R016.packId,
        severity: TS_AGENT_R016.severity,
        title: TS_AGENT_R016.title,
        summary: `Exports error types (${errorExports.slice(0, 5).join(", ")}) without module-level JSDoc documenting failure conditions.`,
        location: { path: b.path, line: 1, column: 0 },
        requirement: TS_AGENT_R016.requirement,
        label: "undocumented error types",
        labels: TS_AGENT_R016.labels,
      };
    });
}

function findingSortKey(finding: AspTypeScriptFinding): string {
  return `${finding.ruleId}\0${finding.location.path ?? ""}\0${finding.location.line}\0${finding.summary}`;
}

function sourceLineField(sourceLine: string | undefined): { readonly sourceLine?: string } {
  return sourceLine === undefined ? {} : { sourceLine };
}
