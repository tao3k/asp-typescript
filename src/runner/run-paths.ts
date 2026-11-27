import fs from "node:fs";

import { pathFromInput, discoverTypeScriptFiles, parseTypeScriptSourceFile } from "../parser.js";
import { defaultAspTypeScriptConfig } from "../config.js";
import { buildExplicitTypeScriptReasoningTree } from "../reasoning.js";
import { evaluateDefaultRulePacks } from "../rules.js";
import { renderAssertionMessage } from "../render.js";
import { isAspTypeScriptClean } from "../model.js";
import type { AspTypeScriptConfig, AspTypeScriptReport } from "../model.js";

export function runAspTypeScriptPaths(
  pathInputs: readonly (string | URL)[],
  config: AspTypeScriptConfig = defaultAspTypeScriptConfig(),
): AspTypeScriptReport {
  const roots = pathInputs.map(pathFromInput);
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      throw new Error(`ASP TypeScript path does not exist: ${root}`);
    }
  }
  const files = discoverTypeScriptFiles(
    roots,
    config.ignoredDirNames,
    config.includeHiddenDirNames,
  );
  const modules = files.map((filePath) => parseTypeScriptSourceFile(filePath));
  const reasoningTree = buildExplicitTypeScriptReasoningTree(roots, modules);
  const findings = evaluateDefaultRulePacks(reasoningTree, config);
  return {
    runMode: reasoningTree.runMode,
    modules,
    findings,
    rootPaths: roots,
    blockingSeverities: config.blockingSeverities,
    blockingRuleIds: config.blockingRuleIds,
    reasoningTree,
  };
}

export function assertAspTypeScriptPathsClean(
  pathInputs: readonly (string | URL)[],
  config: AspTypeScriptConfig = defaultAspTypeScriptConfig(),
): AspTypeScriptReport {
  const report = runAspTypeScriptPaths(pathInputs, config);
  if (!isAspTypeScriptClean(report)) {
    throw new Error(renderAssertionMessage(report));
  }
  return report;
}
