/**
 * Extension policy pack for TypeScript framework and library facts.
 *
 * This module evaluates parser-owned React, Effect, and shadcn signals into
 * agent-facing findings without requiring provider-private heuristics.
 */
import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptEffectPromiseInteropRiskFact,
  TypeScriptEffectResourceScopeRiskFact,
  TypeScriptEffectRuntimeCallFact,
  TypeScriptEffectServiceMethodFact,
  TypeScriptPublicAsyncEffectSurfaceFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { evaluateEffectConcurrencyAdvice, TS_EXT_EFFECT_R008 } from "./effect_concurrency.js";
import {
  effectPolicyIsActive,
  effectPolicySourceModules,
  sourceModules,
} from "./effect_modules.js";
import { evaluateEffectProductionBoundaryAdvice, TS_EXT_EFFECT_R010 } from "./effect_production.js";
import { evaluateEffectSchemaBoundaryAdvice, TS_EXT_EFFECT_R009 } from "./effect_schema.js";
import {
  evaluateReactExtensionPolicyRules,
  typeScriptReactExtensionPolicyRules,
} from "./react_pack.js";
import { evaluateShadcnPolicyRules, shadcnPolicyRules } from "./shadcn/pack.js";

export const TS_EXT_EFFECT_R001: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R001",
  packId: "typescript.extension_policy",
  severity: "error",
  title: "Effect extension enablement requires the Effect dependency",
  requirement:
    "When package.json enables the Effect extension, the project should declare the effect package so the configured typed async domain-effect policy can run against real source dependencies.",
  labels: { surface: "extension", parser: "package-json", extension: "effect" },
};

export const TS_EXT_EFFECT_R002: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R002",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect extension expects typed async domain effects",
  requirement:
    "When the Effect extension is active, public source APIs that expose async domain work should return Effect.Effect instead of raw Promise surfaces.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R003: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R003",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect runtime execution should stay at entrypoint boundaries",
  requirement:
    "Effect.run* and Runtime.run* execute Effect descriptions; source modules should normally return Effect values and leave execution to parser-owned entrypoint or runtime integration modules.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R004: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R004",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect service methods should hide implementation requirements",
  requirement:
    "Public Effect service method signatures should usually expose Effect<Success, Error, never>; dependencies belong in layer/runtime construction rather than leaking through each service method.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R005: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R005",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect error channels should use typed domain errors",
  requirement:
    "Public Effect APIs should use typed domain or tagged error values in the Error channel; primitive, any, unknown, or void error channels hide recovery intent from agents and from Effect.catchTag style handling.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R006: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R006",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect.promise should not hide rejection-capable interop",
  requirement:
    "Public Effect APIs should use Effect.tryPromise with domain error mapping when Promise interop can reject, throw, or resume from an async callback.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R007: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R007",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "Effect resources should have an explicit Scope boundary",
  requirement:
    "Public Effect APIs that construct resources with Effect.acquireRelease should make Scope closure explicit with Effect.scoped or a documented resource boundary.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R011: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R011",
  packId: "typescript.extension_policy",
  severity: "warning",
  title: "Effect production module imports test utilities",
  requirement:
    "Production Effect source modules should not import TestClock, TestServices, TestAnnotations, TestContext, TestLive, or other test infrastructure. Test utilities leak fake clocks and mock services into production paths. Pattern from Effect-TS: test utilities are only imported in `.test.ts` files.",
  labels: { surface: "extension", parser: "reasoning-tree", extension: "effect" },
};

export const TS_EXT_EFFECT_R012: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R012",
  packId: "typescript.extension_policy",
  severity: "warning",
  title: "Effect service method should declare explicit error channel",
  requirement:
    "Effect service methods returning `Effect<A, never, R>` may hide potential failures. Declare a typed error channel (e.g., `Effect<A, ServiceError, R>`) even when the current implementation cannot fail — requirements change and callers need typed error handling. Pattern from Effect-TS: services like ConfigProvider.ts, Clock.ts declare explicit error types.",
  labels: { surface: "extension", parser: "native-syntax", extension: "effect" },
};

export const TS_EXT_EFFECT_R013: AspTypeScriptRule = {
  ruleId: "TS-EXT-EFFECT-R013",
  packId: "typescript.extension_policy",
  severity: "warning",
  title: "Effect fiber fork should propagate FiberRefs context",
  requirement:
    "When forking an Effect fiber, the child fiber should explicitly inherit FiberRef values from the parent. Without explicit propagation (`FiberRefs.forkAs` or `Effect.forkWith`), the child fiber may lose critical context like OpenTelemetry spans, log annotations, or concurrency limits. Pattern from Effect-TS: FiberRefs.ts provides `forkAs` and `joinAs` for explicit context propagation.",
  labels: { surface: "extension", parser: "reasoning-tree", extension: "effect" },
};

export function typeScriptExtensionPolicyRules(): readonly AspTypeScriptRule[] {
  return [
    TS_EXT_EFFECT_R001,
    TS_EXT_EFFECT_R002,
    TS_EXT_EFFECT_R003,
    TS_EXT_EFFECT_R004,
    TS_EXT_EFFECT_R005,
    TS_EXT_EFFECT_R006,
    TS_EXT_EFFECT_R007,
    TS_EXT_EFFECT_R008,
    TS_EXT_EFFECT_R009,
    TS_EXT_EFFECT_R010,
    TS_EXT_EFFECT_R011,
    TS_EXT_EFFECT_R012,
    TS_EXT_EFFECT_R013,
    ...typeScriptReactExtensionPolicyRules(),
    ...shadcnPolicyRules(),
  ];
}

export function evaluateExtensionPolicyRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return [
    ...evaluateEffectConfigurationFindings(reasoningTree),
    ...evaluateEffectAsyncSurfaceAdvice(reasoningTree),
    ...evaluateEffectRuntimeBoundaryAdvice(reasoningTree),
    ...evaluateEffectServiceRequirementAdvice(reasoningTree),
    ...evaluateEffectTypedErrorAdvice(reasoningTree),
    ...evaluateEffectPromiseInteropAdvice(reasoningTree),
    ...evaluateEffectResourceScopeAdvice(reasoningTree),
    ...evaluateEffectConcurrencyAdvice(reasoningTree),
    ...evaluateEffectSchemaBoundaryAdvice(reasoningTree),
    ...evaluateEffectProductionBoundaryAdvice(reasoningTree),
    ...evaluateEffectTestUtilityLeak(reasoningTree),
    ...evaluateEffectWeakErrorChannel(reasoningTree),
    ...evaluateEffectFiberContextLeak(reasoningTree),
    ...evaluateReactExtensionPolicyRules(reasoningTree),
    ...evaluateShadcnPolicyRules(reasoningTree),
  ].sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)));
}

function evaluateEffectConfigurationFindings(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.packageExtensions.flatMap((extension) => {
    if (
      extension.name !== "effect" ||
      extension.activation !== "config-enabled-missing-dependency"
    ) {
      return [];
    }
    return [
      {
        ruleId: TS_EXT_EFFECT_R001.ruleId,
        packId: TS_EXT_EFFECT_R001.packId,
        severity: TS_EXT_EFFECT_R001.severity,
        title: TS_EXT_EFFECT_R001.title,
        summary:
          "package.json enables the Effect extension, but the effect package is not declared in the package dependency fields.",
        location: extension.location,
        requirement: TS_EXT_EFFECT_R001.requirement,
        label: "declare effect before enforcing Effect extension policy",
        labels: {
          ...TS_EXT_EFFECT_R001.labels,
          activation: extension.activation,
          capabilities: extension.capabilities.join(","),
          config: extension.configSource ?? "package.json",
          repair: "add effect and keep asp-typescript.extensions.effect enabled",
        },
      },
    ];
  });
}

function evaluateEffectAsyncSurfaceAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectAsyncSurfaceAdviceForModule(moduleReport),
  );
}

function effectAsyncSurfaceAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const rawAsyncSurfaces = moduleReport.publicAsyncEffectSurfaces.filter(
    (surface) => !surface.returnsEffect && (surface.isAsync || surface.returnsPromise),
  );
  const first = rawAsyncSurfaces[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R002.ruleId,
      packId: TS_EXT_EFFECT_R002.packId,
      severity: TS_EXT_EFFECT_R002.severity,
      title: TS_EXT_EFFECT_R002.title,
      summary: `Effect extension is active, but public async APIs expose raw Promise surfaces: ${renderAsyncSurfaceNames(
        rawAsyncSurfaces,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R002.requirement,
      ...sourceLineField(first.sourceLine),
      label: "public async API should use Effect boundary",
      labels: {
        ...TS_EXT_EFFECT_R002.labels,
        module_role: moduleReport.role,
        async_surfaces: rawAsyncSurfaces.map((surface) => surface.functionName).join(","),
      },
    },
  ];
}

function evaluateEffectRuntimeBoundaryAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectRuntimeBoundaryAdviceForModule(moduleReport),
  );
}

function effectRuntimeBoundaryAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const disallowedRuntimeCalls = moduleReport.effectRuntimeCalls.filter(
    (call) => !isAllowedEffectRuntimeBoundary(call.runtimeBoundaryKind),
  );
  const first = disallowedRuntimeCalls[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R003.ruleId,
      packId: TS_EXT_EFFECT_R003.packId,
      severity: TS_EXT_EFFECT_R003.severity,
      title: TS_EXT_EFFECT_R003.title,
      summary: `Effect runtime execution appears inside a ${moduleReport.role} module: ${renderRuntimeCallNames(
        disallowedRuntimeCalls,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R003.requirement,
      ...sourceLineField(first.sourceLine),
      label: "move Effect execution to an entrypoint or adapter boundary",
      labels: {
        ...TS_EXT_EFFECT_R003.labels,
        module_role: moduleReport.role,
        runtime_calls: disallowedRuntimeCalls.map((call) => call.callee).join(","),
      },
    },
  ];
}

function isAllowedEffectRuntimeBoundary(
  runtimeBoundaryKind: TypeScriptEffectRuntimeCallFact["runtimeBoundaryKind"],
): boolean {
  return runtimeBoundaryKind === "react-query-callback";
}

function evaluateEffectServiceRequirementAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return effectPolicySourceModules(reasoningTree).flatMap((moduleReport) =>
    effectServiceRequirementAdviceForModule(moduleReport),
  );
}

function effectServiceRequirementAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  return moduleReport.effectServiceMethods
    .filter((method) => requirementTypeLeaks(method.requirementsTypeText))
    .map((method) => ({
      ruleId: TS_EXT_EFFECT_R004.ruleId,
      packId: TS_EXT_EFFECT_R004.packId,
      severity: TS_EXT_EFFECT_R004.severity,
      title: TS_EXT_EFFECT_R004.title,
      summary: `Effect service method ${method.containerName}.${method.methodName} exposes requirements ${method.requirementsTypeText}.`,
      location: method.location,
      requirement: TS_EXT_EFFECT_R004.requirement,
      ...sourceLineField(method.sourceLine),
      label: "move service dependencies into Layer construction",
      labels: {
        ...TS_EXT_EFFECT_R004.labels,
        container_kind: method.containerKind,
        container: method.containerName,
        method: method.methodName,
        requirements: method.requirementsTypeText ?? "unknown",
      },
    }));
}

function evaluateEffectTypedErrorAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectTypedErrorAdviceForModule(moduleReport),
  );
}

function effectTypedErrorAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const weakFunctionSurfaces = moduleReport.publicAsyncEffectSurfaces.filter(
    (surface) => surface.returnsEffect && surface.errorChannelKind === "weak",
  );
  const weakServiceMethods = moduleReport.effectServiceMethods.filter(
    (method) => method.errorChannelKind === "weak",
  );
  const firstFunctionSurface = weakFunctionSurfaces[0];
  const firstServiceMethod = weakServiceMethods[0];
  const location = firstFunctionSurface?.location ?? firstServiceMethod?.location;
  if (location === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R005.ruleId,
      packId: TS_EXT_EFFECT_R005.packId,
      severity: TS_EXT_EFFECT_R005.severity,
      title: TS_EXT_EFFECT_R005.title,
      summary: `Public Effect APIs expose weak error channels: ${renderWeakErrorSurfaces(
        weakFunctionSurfaces,
        weakServiceMethods,
      )}.`,
      location,
      requirement: TS_EXT_EFFECT_R005.requirement,
      ...sourceLineField(firstFunctionSurface?.sourceLine ?? firstServiceMethod?.sourceLine),
      label: "use typed Effect error channels",
      labels: {
        ...TS_EXT_EFFECT_R005.labels,
        module_role: moduleReport.role,
        error_surfaces: [
          ...weakFunctionSurfaces.map((surface) => surface.functionName),
          ...weakServiceMethods.map((method) => `${method.containerName}.${method.methodName}`),
        ].join(","),
      },
    },
  ];
}

function evaluateEffectPromiseInteropAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectPromiseInteropAdviceForModule(moduleReport),
  );
}

function effectPromiseInteropAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.effectPromiseInteropRisks[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R006.ruleId,
      packId: TS_EXT_EFFECT_R006.packId,
      severity: TS_EXT_EFFECT_R006.severity,
      title: TS_EXT_EFFECT_R006.title,
      summary: `Effect.promise wraps rejection-capable interop in public APIs: ${renderPromiseInteropRisks(
        moduleReport.effectPromiseInteropRisks,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R006.requirement,
      ...sourceLineField(first.sourceLine),
      label: "use Effect.tryPromise for rejection-capable interop",
      labels: {
        ...TS_EXT_EFFECT_R006.labels,
        module_role: moduleReport.role,
        promise_interop: moduleReport.effectPromiseInteropRisks
          .map((risk) => risk.ownerName)
          .join(","),
      },
    },
  ];
}

function evaluateEffectResourceScopeAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!effectPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return sourceModules(reasoningTree).flatMap((moduleReport) =>
    effectResourceScopeAdviceForModule(moduleReport),
  );
}

function effectResourceScopeAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.effectResourceScopeRisks[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_EFFECT_R007.ruleId,
      packId: TS_EXT_EFFECT_R007.packId,
      severity: TS_EXT_EFFECT_R007.severity,
      title: TS_EXT_EFFECT_R007.title,
      summary: `Effect.acquireRelease appears without a local Scope boundary in public APIs: ${renderResourceScopeRisks(
        moduleReport.effectResourceScopeRisks,
      )}.`,
      location: first.location,
      requirement: TS_EXT_EFFECT_R007.requirement,
      ...sourceLineField(first.sourceLine),
      label: "make Effect resource scope explicit",
      labels: {
        ...TS_EXT_EFFECT_R007.labels,
        module_role: moduleReport.role,
        resource_scope: moduleReport.effectResourceScopeRisks
          .map((risk) => risk.ownerName)
          .join(","),
      },
    },
  ];
}

function renderAsyncSurfaceNames(
  surfaces: readonly TypeScriptPublicAsyncEffectSurfaceFact[],
): string {
  const names = surfaces
    .map((surface) => `${surface.functionName}:${surface.returnTypeText ?? "implicit Promise"}`)
    .slice(0, 6);
  const suffix = surfaces.length > names.length ? `,+${surfaces.length - names.length}` : "";
  return `${names.join(", ")}${suffix}`;
}

function renderRuntimeCallNames(calls: readonly TypeScriptEffectRuntimeCallFact[]): string {
  return cappedNames(
    calls.map((call) => `${call.callee}:${call.callKind}`),
    6,
  );
}

function renderWeakErrorSurfaces(
  functionSurfaces: readonly TypeScriptPublicAsyncEffectSurfaceFact[],
  serviceMethods: readonly TypeScriptEffectServiceMethodFact[],
): string {
  return cappedNames(
    [
      ...functionSurfaces.map(
        (surface) => `${surface.functionName}:${surface.errorTypeText ?? "unknown"}`,
      ),
      ...serviceMethods.map(
        (method) =>
          `${method.containerName}.${method.methodName}:${method.errorTypeText ?? "unknown"}`,
      ),
    ],
    6,
  );
}

function renderPromiseInteropRisks(
  risks: readonly TypeScriptEffectPromiseInteropRiskFact[],
): string {
  return cappedNames(
    risks.map((risk) => `${risk.ownerName}:${risk.riskKinds.join("+")}`),
    6,
  );
}

function renderResourceScopeRisks(risks: readonly TypeScriptEffectResourceScopeRiskFact[]): string {
  return cappedNames(
    risks.map((risk) => risk.ownerName),
    6,
  );
}

function requirementTypeLeaks(requirementsTypeText: string | undefined): boolean {
  if (requirementsTypeText === undefined) {
    return false;
  }
  const normalized = requirementsTypeText.replaceAll(" ", "");
  return normalized !== "" && normalized !== "never";
}

function cappedNames(names: readonly string[], max: number): string {
  const selected = names.slice(0, max);
  const suffix = names.length > selected.length ? `,+${names.length - selected.length}` : "";
  return `${selected.join(", ")}${suffix}`;
}

/** R011: Effect production modules importing test utilities. */
function evaluateEffectTestUtilityLeak(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  const TEST_UTILITY_NAMES = [
    "TestClock",
    "TestServices",
    "TestAnnotations",
    "TestAnnotation",
    "TestContext",
    "TestLive",
    "TestSized",
    "TestConfig",
  ];

  return reasoningTree.ownerBranches
    .filter(
      (b) => b.roles.includes("source") && !b.path.includes("/test/") && !b.path.includes(".test."),
    )
    .filter((b) => b.exportNames.some((name) => TEST_UTILITY_NAMES.some((tu) => name.includes(tu))))
    .slice(0, 10)
    .map((b) => ({
      ruleId: TS_EXT_EFFECT_R011.ruleId,
      packId: TS_EXT_EFFECT_R011.packId,
      severity: TS_EXT_EFFECT_R011.severity,
      title: TS_EXT_EFFECT_R011.title,
      summary: `Production module exports test utilities (${b.exportNames
        .filter((n) => TEST_UTILITY_NAMES.some((tu) => n.includes(tu)))
        .slice(0, 3)
        .join(", ")}) — should be in test files only.`,
      location: { path: b.path, line: 1, column: 0 },
      requirement: TS_EXT_EFFECT_R011.requirement,
      label: "Effect production module leaks test utilities",
      labels: TS_EXT_EFFECT_R011.labels,
    }));
}

/** R012: Effect service methods with weak error channels. */
function evaluateEffectWeakErrorChannel(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  // Find modules that actually import from Effect (not gRPC or other service patterns)
  const effectImporters = new Set<string>();
  for (const dep of reasoningTree.ownerDependencies) {
    if (
      dep.moduleSpecifier === "effect" ||
      dep.moduleSpecifier.startsWith("effect/") ||
      dep.moduleSpecifier.startsWith("@effect/")
    ) {
      effectImporters.add(dep.fromPath);
    }
  }

  return reasoningTree.ownerBranches
    .filter(
      (b) =>
        b.roles.includes("source") &&
        effectImporters.has(b.path) && // Must actually import Effect
        b.exportNames.some((n) => n.endsWith("Service") || n.includes("Service")),
    )
    .slice(0, 10)
    .map((b) => ({
      ruleId: TS_EXT_EFFECT_R012.ruleId,
      packId: TS_EXT_EFFECT_R012.packId,
      severity: TS_EXT_EFFECT_R012.severity,
      title: TS_EXT_EFFECT_R012.title,
      summary: `Service module exports Effect types without documented error channels — declare explicit error types (e.g., \`Effect<A, ServiceError, R>\`).`,
      location: { path: b.path, line: 1, column: 0 },
      requirement: TS_EXT_EFFECT_R012.requirement,
      label: "Effect service with weak error channel",
      labels: TS_EXT_EFFECT_R012.labels,
    }));
}

/** R013: Effect fiber fork without FiberRefs context propagation. */
function evaluateEffectFiberContextLeak(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  // Detect modules that use fork-like operations but don't import FiberRefs propagation helpers
  const FORK_SIGNAL_NAMES = ["fork", "forkDaemon", "forkIn", "forkScoped", "forkWithErrorHandler"];
  const CONTEXT_PROPAGATION_FILES = new Set<string>();

  // Find files that import from FiberRefs (they handle context properly)
  for (const dep of reasoningTree.ownerDependencies) {
    if (dep.toPath?.includes("FiberRefs.ts") || dep.moduleSpecifier.includes("FiberRefs")) {
      CONTEXT_PROPAGATION_FILES.add(dep.fromPath);
    }
  }

  return reasoningTree.ownerBranches
    .filter(
      (b) =>
        b.roles.includes("source") &&
        b.exportNames.some((name) =>
          FORK_SIGNAL_NAMES.some((fs) => name.toLowerCase().includes(fs)),
        ) &&
        !CONTEXT_PROPAGATION_FILES.has(b.path),
    )
    .slice(0, 10)
    .map((b) => ({
      ruleId: TS_EXT_EFFECT_R013.ruleId,
      packId: TS_EXT_EFFECT_R013.packId,
      severity: TS_EXT_EFFECT_R013.severity,
      title: TS_EXT_EFFECT_R013.title,
      summary: `Module exports fork-related operations without importing FiberRefs for context propagation — child fibers may lose spans, log annotations, or concurrency limits.`,
      location: { path: b.path, line: 1, column: 0 },
      requirement: TS_EXT_EFFECT_R013.requirement,
      label: "Effect fiber fork without FiberRefs propagation",
      labels: TS_EXT_EFFECT_R013.labels,
    }));
}

function findingSortKey(finding: AspTypeScriptFinding): string {
  return `${finding.ruleId}\0${finding.location.path ?? ""}\0${finding.location.line}\0${finding.summary}`;
}

function sourceLineField(sourceLine: string | undefined): { readonly sourceLine?: string } {
  return sourceLine === undefined ? {} : { sourceLine };
}
