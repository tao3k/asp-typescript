import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { relativeToProject } from "../common.js";
import { isInsideAny } from "../modularity/pack.js";

const TS_TEST_R001: AspTypeScriptRule = {
  ruleId: "TS-TEST-R001",
  packId: "typescript.test_layout",
  severity: "info",
  title: "Test modules should stay in configured test roots",
  requirement:
    "When a project has configured test roots, parser-visible test modules should live under those roots.",
  labels: { surface: "test-layout", parser: "reasoning-tree" },
};

export function typeScriptTestLayoutRules(): readonly AspTypeScriptRule[] {
  return [TS_TEST_R001];
}

export function evaluateTestLayoutRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (reasoningTree.testRoots.length === 0) {
    return [];
  }
  return reasoningTree.modules.flatMap((moduleReport) => {
    if (moduleReport.role !== "test" || isInsideAny(moduleReport.path, reasoningTree.testRoots)) {
      return [];
    }
    return [
      {
        ruleId: TS_TEST_R001.ruleId,
        packId: TS_TEST_R001.packId,
        severity: TS_TEST_R001.severity,
        title: TS_TEST_R001.title,
        summary: `Test module '${relativeToProject(reasoningTree, moduleReport.path)}' is outside configured test roots.`,
        location: { path: moduleReport.path, line: 1, column: 0 },
        requirement: TS_TEST_R001.requirement,
        label: "test module outside test root",
        labels: TS_TEST_R001.labels,
      },
    ];
  });
}
