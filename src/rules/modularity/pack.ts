import path from "node:path";

import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { relativeToProject } from "../common.js";

const TS_MOD_R001: AspTypeScriptRule = {
  ruleId: "TS-MOD-R001",
  packId: "typescript.modularity",
  severity: "info",
  title: "Source graph should not depend on tests",
  requirement:
    "Production source, facade, entrypoint, and config modules should not depend on parser-visible test owners.",
  labels: { surface: "module-graph", parser: "reasoning-tree" },
};

const TS_MOD_R002: AspTypeScriptRule = {
  ruleId: "TS-MOD-R002",
  packId: "typescript.modularity",
  severity: "info",
  title: "Project modules should keep a bounded responsibility surface",
  requirement:
    "Parser-visible project modules should split by concern when one owner contains too many top-level responsibilities or combines size with several independent responsibilities.",
  labels: { surface: "module-responsibility", parser: "reasoning-tree" },
};

const PROJECT_OWNER_LINE_LIMIT = 1000;
const PROJECT_OWNER_RESPONSIBILITY_LIMIT = 8;

export function typeScriptModularityRules(): readonly AspTypeScriptRule[] {
  return [TS_MOD_R001, TS_MOD_R002];
}

export function evaluateModularityRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return [
    ...evaluateSourceToTestRules(reasoningTree),
    ...evaluateResponsibilitySurfaceRules(reasoningTree),
  ];
}

function evaluateSourceToTestRules(reasoningTree: TypeScriptReasoningTree): AspTypeScriptFinding[] {
  return reasoningTree.ownerDependencies.flatMap((dependency) => {
    if (!isProductionRole(dependency.fromRole) || dependency.toRole !== "test") {
      return [];
    }
    return [
      {
        ruleId: TS_MOD_R001.ruleId,
        packId: TS_MOD_R001.packId,
        severity: TS_MOD_R001.severity,
        title: TS_MOD_R001.title,
        summary: `Module role '${dependency.fromRole}' depends on test owner '${dependency.moduleSpecifier}'.`,
        location: dependency.location,
        requirement: TS_MOD_R001.requirement,
        label: "source-to-test module edge",
        labels: TS_MOD_R001.labels,
      },
    ];
  });
}

function evaluateResponsibilitySurfaceRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.modules.flatMap((moduleReport) => {
    if (moduleReport.role === "declaration") {
      return [];
    }
    const responsibilities = moduleReport.moduleResponsibilities;
    const implementationResponsibilities = implementationResponsibilityCount(moduleReport);
    const signals = responsibilitySignals(moduleReport);
    if (signals.length === 0) return [];
    return [
      {
        ruleId: TS_MOD_R002.ruleId,
        packId: TS_MOD_R002.packId,
        severity: TS_MOD_R002.severity,
        title: TS_MOD_R002.title,
        summary: `Project module '${relativeToProject(reasoningTree, moduleReport.path)}' has ${responsibilities.length} top-level responsibilities (${implementationResponsibilities} implementation blocks) across ${moduleReport.lineCount} lines. Signals: ${signals.join(", ")}.`,
        location: { path: moduleReport.path, line: 1, column: 0 },
        requirement: TS_MOD_R002.requirement,
        label: "broad project module responsibility surface",
        labels: {
          ...TS_MOD_R002.labels,
          responsibilities: String(responsibilities.length),
          implementationResponsibilities: String(implementationResponsibilities),
          lines: String(moduleReport.lineCount),
        },
      },
    ];
  });
}

function responsibilitySignals(moduleReport: TypeScriptReasoningModule): readonly string[] {
  const responsibilities = implementationResponsibilityCount(moduleReport);
  const signals: string[] = [];
  if (
    moduleReport.lineCount > PROJECT_OWNER_LINE_LIMIT &&
    responsibilities > PROJECT_OWNER_RESPONSIBILITY_LIMIT
  ) {
    signals.push(
      `lines>${PROJECT_OWNER_LINE_LIMIT}+responsibilities>${PROJECT_OWNER_RESPONSIBILITY_LIMIT}`,
    );
  }
  return signals;
}

function implementationResponsibilityCount(moduleReport: TypeScriptReasoningModule): number {
  return moduleReport.moduleResponsibilities.filter(
    (responsibility) =>
      responsibility.kind === "function" ||
      responsibility.kind === "class" ||
      responsibility.kind === "call",
  ).length;
}

function isProductionRole(role: TypeScriptReasoningModule["role"]): boolean {
  return role === "source" || role === "facade" || role === "entrypoint" || role === "config";
}

export function isInsideAny(filePath: string, roots: readonly string[]): boolean {
  return roots.some((root) => {
    const relativePath = path.relative(root, filePath);
    return (
      relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
    );
  });
}
