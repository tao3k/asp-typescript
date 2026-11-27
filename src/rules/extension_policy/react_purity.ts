/**
 * React purity policy implementation.
 *
 * This module evaluates parser-owned React render and hook facts into extension
 * policy findings about component purity and static definitions.
 */
import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReactHookCallSignalFact,
  TypeScriptReactRenderPuritySignalFact,
  TypeScriptReactStaticDefinitionSignalFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { reactPolicyIsActive, reactPolicySourceModules } from "./react_modules.js";

export const TS_EXT_REACT_R001: AspTypeScriptRule = {
  ruleId: "TS-EXT-REACT-R001",
  packId: "typescript.extension_policy",
  severity: "error",
  title: "React extension enablement requires the React dependency",
  requirement:
    "When package.json enables the React extension, the project should declare the react package so the configured component and hook policy can run against real source dependencies.",
  labels: { surface: "extension", parser: "package-json", extension: "react" },
};

export const TS_EXT_REACT_R002: AspTypeScriptRule = {
  ruleId: "TS-EXT-REACT-R002",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "React render paths should stay pure for compiler optimization",
  requirement:
    "React components and hooks should keep render logic idempotent and side-effect free so React and React Compiler can safely re-render, pause, resume, and optimize them.",
  labels: { surface: "extension", parser: "native-syntax", extension: "react" },
};

export const TS_EXT_REACT_R003: AspTypeScriptRule = {
  ruleId: "TS-EXT-REACT-R003",
  packId: "typescript.extension_policy",
  severity: "error",
  title: "React hooks must keep a stable top-level call order",
  requirement:
    "React relies on hooks being called from components and hooks in the same order on every render; hooks must not be called conditionally, in loops, after conditional returns, inside nested callbacks, or inside try/catch/finally blocks.",
  labels: { surface: "extension", parser: "native-syntax", extension: "react" },
};

export const TS_EXT_REACT_R004: AspTypeScriptRule = {
  ruleId: "TS-EXT-REACT-R004",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "React components and hooks should be static module-level definitions",
  requirement:
    "React components and hooks should be defined at module level rather than recreated inside render; nested definitions reset state, cause excessive work, and reduce React Compiler optimization coverage.",
  labels: { surface: "extension", parser: "native-syntax", extension: "react" },
};

export function evaluateReactConfigurationFindings(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.packageExtensions.flatMap((extension) => {
    if (
      extension.name !== "react" ||
      extension.activation !== "config-enabled-missing-dependency"
    ) {
      return [];
    }
    return [
      {
        ruleId: TS_EXT_REACT_R001.ruleId,
        packId: TS_EXT_REACT_R001.packId,
        severity: TS_EXT_REACT_R001.severity,
        title: TS_EXT_REACT_R001.title,
        summary:
          "package.json enables the React extension, but the react package is not declared in the package dependency fields.",
        location: extension.location,
        requirement: TS_EXT_REACT_R001.requirement,
        label: "declare react before enforcing React extension policy",
        labels: {
          ...TS_EXT_REACT_R001.labels,
          activation: extension.activation,
          capabilities: extension.capabilities.join(","),
          config: extension.configSource ?? "package.json",
          repair: "add react and keep asp-typescript.extensions.react enabled",
        },
      },
    ];
  });
}

export function evaluateReactRenderPurityAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!reactPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return reactPolicySourceModules(reasoningTree).flatMap((moduleReport) =>
    reactRenderPurityAdviceForModule(moduleReport),
  );
}

export function evaluateReactHookCallFindings(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!reactPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return reactPolicySourceModules(reasoningTree).flatMap((moduleReport) =>
    reactHookCallFindingsForModule(moduleReport),
  );
}

export function evaluateReactStaticDefinitionAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (!reactPolicyIsActive(reasoningTree.packageExtensions)) {
    return [];
  }
  return reactPolicySourceModules(reasoningTree).flatMap((moduleReport) =>
    reactStaticDefinitionAdviceForModule(moduleReport),
  );
}

function reactRenderPurityAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.reactRenderPuritySignals[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_REACT_R002.ruleId,
      packId: TS_EXT_REACT_R002.packId,
      severity: TS_EXT_REACT_R002.severity,
      title: TS_EXT_REACT_R002.title,
      summary: `React component or hook render path has non-pure signals: ${renderReactPuritySignals(
        moduleReport.reactRenderPuritySignals,
      )}.`,
      location: first.location,
      requirement: TS_EXT_REACT_R002.requirement,
      ...sourceLineField(first.sourceLine),
      label: "move render side effects or non-idempotent work out of render",
      labels: {
        ...TS_EXT_REACT_R002.labels,
        module_role: moduleReport.role,
        react_purity: renderReactPurityTargets(moduleReport.reactRenderPuritySignals),
        react_owner_kinds: [
          ...new Set(moduleReport.reactRenderPuritySignals.map((signal) => signal.ownerKind)),
        ]
          .sort()
          .join(","),
        react_purity_kinds: [
          ...new Set(moduleReport.reactRenderPuritySignals.map((signal) => signal.signalKind)),
        ]
          .sort()
          .join(","),
      },
    },
  ];
}

function reactHookCallFindingsForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.reactHookCallSignals[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_REACT_R003.ruleId,
      packId: TS_EXT_REACT_R003.packId,
      severity: TS_EXT_REACT_R003.severity,
      title: TS_EXT_REACT_R003.title,
      summary: `React hook calls break stable render order: ${renderReactHookCallSignals(
        moduleReport.reactHookCallSignals,
      )}.`,
      location: first.location,
      requirement: TS_EXT_REACT_R003.requirement,
      ...sourceLineField(first.sourceLine),
      label: "move hook calls back to top-level component or hook scope",
      labels: {
        ...TS_EXT_REACT_R003.labels,
        module_role: moduleReport.role,
        react_hook_calls: renderReactHookCallTargets(moduleReport.reactHookCallSignals),
        react_hook_violation_kinds: [
          ...new Set(moduleReport.reactHookCallSignals.flatMap((signal) => signal.violationKinds)),
        ]
          .sort()
          .join(","),
      },
    },
  ];
}

function reactStaticDefinitionAdviceForModule(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const first = moduleReport.reactStaticDefinitionSignals[0];
  if (first === undefined) {
    return [];
  }
  return [
    {
      ruleId: TS_EXT_REACT_R004.ruleId,
      packId: TS_EXT_REACT_R004.packId,
      severity: TS_EXT_REACT_R004.severity,
      title: TS_EXT_REACT_R004.title,
      summary: `React render path defines nested components or hooks: ${renderReactStaticDefinitionSignals(
        moduleReport.reactStaticDefinitionSignals,
      )}.`,
      location: first.location,
      requirement: TS_EXT_REACT_R004.requirement,
      ...sourceLineField(first.sourceLine),
      label: "hoist nested React component or hook definitions to module scope",
      labels: {
        ...TS_EXT_REACT_R004.labels,
        module_role: moduleReport.role,
        react_static_definitions: renderReactStaticDefinitionTargets(
          moduleReport.reactStaticDefinitionSignals,
        ),
        react_static_definition_kinds: [
          ...new Set(moduleReport.reactStaticDefinitionSignals.map((signal) => signal.signalKind)),
        ]
          .sort()
          .join(","),
      },
    },
  ];
}

function renderReactPuritySignals(
  signals: readonly TypeScriptReactRenderPuritySignalFact[],
): string {
  return cappedNames(
    signals.map((signal) => `${signal.ownerName}:${signal.signalKind}:${signal.expression}`),
    6,
  );
}

function renderReactPurityTargets(
  signals: readonly TypeScriptReactRenderPuritySignalFact[],
): string {
  return cappedNames(
    signals.map((signal) => `${signal.ownerName}:${signal.expression}`),
    6,
  );
}

function renderReactHookCallSignals(signals: readonly TypeScriptReactHookCallSignalFact[]): string {
  return cappedNames(
    signals.map(
      (signal) => `${signal.ownerName}:${signal.hookName}:${signal.violationKinds.join("+")}`,
    ),
    6,
  );
}

function renderReactHookCallTargets(signals: readonly TypeScriptReactHookCallSignalFact[]): string {
  return cappedNames(
    signals.map((signal) => `${signal.ownerName}:${signal.hookName}`),
    6,
  );
}

function renderReactStaticDefinitionSignals(
  signals: readonly TypeScriptReactStaticDefinitionSignalFact[],
): string {
  return cappedNames(
    signals.map((signal) => `${signal.ownerName}:${signal.nestedName}:${signal.signalKind}`),
    6,
  );
}

function renderReactStaticDefinitionTargets(
  signals: readonly TypeScriptReactStaticDefinitionSignalFact[],
): string {
  return cappedNames(
    signals.map((signal) => `${signal.ownerName}:${signal.nestedName}`),
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
