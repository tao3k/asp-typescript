import fs from "node:fs";
import path from "node:path";

import {
  pathFromInput,
  projectFileNames,
  readProjectResolution,
  parseTypeScriptProjectFiles,
} from "../parser.js";
import { defaultAspTypeScriptConfig, aspTypeScriptConfigForProject } from "../config.js";
import { buildTypeScriptReasoningTree } from "../reasoning.js";
import { evaluateDefaultRulePacks } from "../rules.js";
import type {
  AspTypeScriptConfig,
  AspTypeScriptReport,
  AspTypeScriptAgentSnapshot,
  AspTypeScriptAgentSnapshotPackage,
} from "../model.js";

export interface AspTypeScriptEmbeddedOptions {
  readonly config?: AspTypeScriptConfig;
  readonly collectSemanticDiagnostics?: boolean;
  readonly emitAdvice?: boolean;
  readonly writeAdvice?: (message: string) => unknown;
}

interface AspTypeScriptRunOptions {
  readonly collectSemanticDiagnostics?: boolean;
  readonly collectNativeSyntaxFacts?: boolean;
  readonly evaluateRules?: boolean;
  readonly fileNames?: readonly string[];
}

export function runAspTypeScript(
  projectRootInput: string | URL,
  config?: AspTypeScriptConfig,
  options: AspTypeScriptRunOptions = {},
): AspTypeScriptReport {
  const projectRoot = pathFromInput(projectRootInput);
  if (!fs.existsSync(projectRoot)) {
    throw new Error(`project root does not exist: ${projectRoot}`);
  }
  const selectedConfig = config ?? aspTypeScriptConfigForProject(projectRoot);
  const scope = readProjectResolution(projectRoot, selectedConfig);
  const parseOptions = {
    ...(options.collectSemanticDiagnostics === undefined
      ? {}
      : { collectSemanticDiagnostics: options.collectSemanticDiagnostics }),
    ...(options.collectNativeSyntaxFacts === undefined
      ? {}
      : { collectNativeSyntaxFacts: options.collectNativeSyntaxFacts }),
  };
  const modules = parseTypeScriptProjectFiles(
    scope,
    options.fileNames ?? projectFileNames(scope, selectedConfig),
    parseOptions,
  );
  const reasoningTree = buildTypeScriptReasoningTree(scope, modules);
  const findings =
    options.evaluateRules === false ? [] : evaluateDefaultRulePacks(reasoningTree, selectedConfig);
  return {
    runMode: reasoningTree.runMode,
    modules,
    findings,
    rootPaths: [scope.projectRoot],
    blockingSeverities: selectedConfig.blockingSeverities,
    blockingRuleIds: selectedConfig.blockingRuleIds,
    projectResolution: scope,
    reasoningTree,
  };
}

export function runAspTypeScriptAgentSnapshot(
  projectRootInput: string | URL,
  config: AspTypeScriptConfig = defaultAspTypeScriptConfig(),
): AspTypeScriptAgentSnapshot {
  return buildAspTypeScriptAgentSnapshot(runAspTypeScript(projectRootInput, config), config);
}

export function buildAspTypeScriptAgentSnapshot(
  rootReport: AspTypeScriptReport,
  config: AspTypeScriptConfig = defaultAspTypeScriptConfig(),
): AspTypeScriptAgentSnapshot {
  const projectRoot = rootReport.reasoningTree.projectRoot;
  const memberReports = agentSnapshotMemberPackageRoots(rootReport).map((packageRoot) =>
    runAspTypeScript(packageRoot, config),
  );
  const packages = [rootReport, ...memberReports].map((report) =>
    agentSnapshotPackage(projectRoot, report),
  );
  return { projectRoot, packages };
}

function agentSnapshotMemberPackageRoots(rootReport: AspTypeScriptReport): string[] {
  const projectRoot = path.resolve(rootReport.reasoningTree.projectRoot);
  const packageRoots = new Set<string>();
  for (const referencePackage of rootReport.reasoningTree.projectReferencePackages) {
    const packageRoot = path.resolve(referencePackage.path);
    if (packageRoot !== projectRoot) {
      packageRoots.add(packageRoot);
    }
  }
  for (const workspacePackage of rootReport.reasoningTree.workspacePackages) {
    const packageRoot = path.resolve(workspacePackage.path);
    if (packageRoot !== projectRoot) {
      packageRoots.add(packageRoot);
    }
  }
  return [...packageRoots].sort((left, right) => left.localeCompare(right));
}

function agentSnapshotPackage(
  snapshotRoot: string,
  report: AspTypeScriptReport,
): AspTypeScriptAgentSnapshotPackage {
  const packageRoot = report.reasoningTree.projectRoot;
  return {
    packageRoot,
    packagePath: displayRelativePath(snapshotRoot, packageRoot),
    report,
  };
}

function displayRelativePath(root: string, child: string): string {
  const rendered = path.relative(root, child).replaceAll("\\", "/");
  return rendered.length === 0 ? "." : rendered;
}
