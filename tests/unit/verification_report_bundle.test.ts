import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildTypeScriptVerificationPerformanceIndex,
  buildTypeScriptVerificationReportBundle,
  buildTypeScriptVerificationTaskIndex,
  defaultTypeScriptHarnessConfig,
  planTypeScriptProjectVerificationWithConfig,
  renderTypeScriptVerificationPerformanceIndex,
  renderTypeScriptVerificationPerformanceIndexJson,
  renderTypeScriptVerificationPlan,
  renderTypeScriptVerificationReportArtifactJson,
  renderTypeScriptVerificationReportBundleJson,
  renderTypeScriptVerificationTaskIndexJson,
  withTypeScriptVerificationProfileHint,
  withTypeScriptVerificationReceipt,
  withTypeScriptVerificationSkillBinding,
  withTypeScriptVerificationSkillDescriptor,
  writeTypeScriptVerificationReports,
  type TypeScriptVerificationProfileHint,
  type TypeScriptVerificationSkillDescriptor,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("verification report bundle renders active plan and configured task index artifacts", () => {
  const root = writeReportBundleProject("active", "export const api = 1;\n");
  const baseConfig = verificationBundleConfig();

  const pendingPlan = planTypeScriptProjectVerificationWithConfig(root, baseConfig);
  const pendingRendered = renderTypeScriptVerificationPlan(pendingPlan);
  const pendingIndex = buildTypeScriptVerificationTaskIndex(pendingPlan);
  const pendingPerformanceIndex = buildTypeScriptVerificationPerformanceIndex(pendingPlan);
  const pendingBundle = buildTypeScriptVerificationReportBundle(pendingPlan);

  assert.deepEqual(
    pendingPlan.reportObligations.map((obligation) => obligation.key),
    ["verification_plan_json", "task_index_json", "performance_index_json"],
  );
  assert.match(pendingRendered, /\[verify-report\]/u);
  assert.match(
    pendingRendered,
    /\|bundle: renderer=renderTypeScriptVerificationReportBundleJson artifact=verification_report_bundle\.json artifacts=3/u,
  );
  assert.match(
    pendingRendered,
    /\|required: task_index_json renderer=buildTypeScriptVerificationTaskIndex \+ renderTypeScriptVerificationTaskIndexJson artifact=task_index\.json tasks=1 kinds=performance/u,
  );
  assert.match(
    pendingRendered,
    /\|required: performance_index_json renderer=buildTypeScriptVerificationPerformanceIndex \+ renderTypeScriptVerificationPerformanceIndexJson artifact=performance_index\.json tasks=1 kinds=performance/u,
  );
  assert.deepEqual(
    pendingBundle.artifacts.map((artifact) => ({
      key: artifact.key,
      persistence: artifact.persistence,
      template: artifact.template?.templateId,
      trace: artifact.trace?.profile,
    })),
    [
      {
        key: "verification_plan_json",
        persistence: "runtime_cache",
        template: "verification-plan",
        trace: "standard",
      },
      {
        key: "task_index_json",
        persistence: "source_baseline",
        template: "verification-task-index",
        trace: "standard",
      },
      {
        key: "performance_index_json",
        persistence: "source_baseline",
        template: "performance-index",
        trace: "performance",
      },
    ],
  );
  assert.deepEqual(pendingBundle.artifacts[0]?.template?.requiredSections, [
    "tasks",
    "reportObligations",
    "skillDescriptors",
  ]);
  assert.deepEqual(pendingBundle.artifacts[1]?.template?.requiredSections, [
    "kind",
    "state",
    "skill",
    "requiredEvidenceKeys",
    "taskEvidence",
  ]);
  assert.deepEqual(pendingBundle.artifacts[2]?.template?.requiredSections, [
    "benchmark_command",
    "baseline",
    "regression_threshold",
    "latency_or_throughput",
    "profile_artifact",
  ]);
  assert.deepEqual(
    pendingIndex.records.map((record) => ({
      kind: record.kind,
      state: record.state,
      owner: relativePath(root, record.ownerPath),
      skill: record.skill,
      contractRef: record.contractRef,
    })),
    [
      {
        kind: "performance",
        state: "pending",
        owner: "src/index.ts",
        skill: "typescript-verification-performance@vitest-bench",
        contractRef: "typescript-verification-performance@vitest-bench",
      },
    ],
  );
  assert.deepEqual(
    pendingPerformanceIndex.records.map((record) => ({
      state: record.state,
      owner: relativePath(root, record.ownerPath),
      missing: record.requiredEvidenceKeys,
    })),
    [
      {
        state: "pending",
        owner: "src/index.ts",
        missing: [
          "benchmark_command",
          "baseline",
          "regression_threshold",
          "latency_or_throughput",
          "allocation_profile",
          "profile_artifact",
        ],
      },
    ],
  );
  assert.match(
    renderTypeScriptVerificationPerformanceIndex(pendingPerformanceIndex),
    /^\[perf-state\] src\/index\.ts/u,
  );

  const performanceTask = pendingPlan.tasks.find((task) => task.kind === "performance");
  assert.ok(performanceTask);
  const failedPlan = planTypeScriptProjectVerificationWithConfig(
    root,
    withTypeScriptVerificationReceipt(baseConfig, {
      kind: "performance",
      ownerPath: "src/index.ts",
      fingerprint: performanceTask.fingerprint,
      status: "failed",
      summary: "performance=regressed",
      evidenceUri: "artifacts/performance/index.json",
      observedAt: "2026-05-07T12:00:00Z",
      evidence: [{ label: "benchmark_command", value: "vitest bench src/index.ts" }],
    }),
  );
  const failedIndex = buildTypeScriptVerificationTaskIndex(failedPlan);
  const failedPerformanceIndex = buildTypeScriptVerificationPerformanceIndex(failedPlan);
  const failedRecord = failedIndex.records[0];
  const failedPerformanceRecord = failedPerformanceIndex.records[0];
  assert.ok(failedRecord);
  assert.ok(failedPerformanceRecord);
  assert.equal(failedRecord.state, "failed");
  assert.equal(failedRecord.receiptSummary, "performance=regressed");
  assert.equal(failedRecord.receiptEvidenceUri, "artifacts/performance/index.json");
  assert.equal(failedRecord.receiptObservedAt, "2026-05-07T12:00:00Z");
  assert.equal(failedPerformanceRecord.receiptEvidenceUri, "artifacts/performance/index.json");
  assert.equal(failedPerformanceRecord.receiptObservedAt, "2026-05-07T12:00:00Z");
  assert.deepEqual(failedRecord.receiptEvidence, [
    { label: "benchmark_command", value: "vitest bench src/index.ts" },
  ]);
  assert.deepEqual(failedRecord.missingReceiptEvidenceKeys, [
    "baseline",
    "regression_threshold",
    "latency_or_throughput",
    "allocation_profile",
    "profile_artifact",
  ]);

  const bundleJson = JSON.parse(renderTypeScriptVerificationReportBundleJson(failedPlan)) as {
    readonly artifacts: readonly { readonly key: string }[];
  };
  const planJson = JSON.parse(
    renderTypeScriptVerificationReportArtifactJson(failedPlan, "verification_plan_json") ?? "",
  ) as { readonly reportObligations: readonly { readonly key: string }[] };
  const taskIndexJson = JSON.parse(
    renderTypeScriptVerificationReportArtifactJson(failedPlan, "task_index_json") ?? "",
  ) as { readonly records: readonly { readonly state: string }[] };
  const performanceIndexJson = JSON.parse(
    renderTypeScriptVerificationReportArtifactJson(failedPlan, "performance_index_json") ?? "",
  ) as { readonly records: readonly { readonly state: string }[] };

  assert.deepEqual(
    bundleJson.artifacts.map((artifact) => artifact.key),
    ["verification_plan_json", "task_index_json", "performance_index_json"],
  );
  assert.deepEqual(
    planJson.reportObligations.map((obligation) => obligation.key),
    ["verification_plan_json", "task_index_json", "performance_index_json"],
  );
  assert.deepEqual(
    taskIndexJson.records.map((record) => record.state),
    ["failed"],
  );
  assert.deepEqual(
    performanceIndexJson.records.map((record) => record.state),
    ["failed"],
  );
  assert.equal(
    renderTypeScriptVerificationPerformanceIndexJson(failedPerformanceIndex).endsWith("\n"),
    true,
  );
  assert.equal(
    renderTypeScriptVerificationReportArtifactJson(failedPlan, "unknown_report_artifact"),
    undefined,
  );
  assert.equal(renderTypeScriptVerificationTaskIndexJson(failedIndex).endsWith("\n"), true);
});

test("verification report writer splits source baseline and runtime cache artifacts", () => {
  const root = writeReportBundleProject("writer", "export const api = 1;\n");
  const sourceBaselineDir = path.join(root, ".verification", "source");
  const runtimeCacheDir = path.join(root, ".verification", "cache");
  const plan = planTypeScriptProjectVerificationWithConfig(root, verificationBundleConfig());

  const receipt = writeTypeScriptVerificationReports(plan, {
    projectRoot: root,
    sourceBaselineDir,
    runtimeCacheDir,
  });

  assert.deepEqual(
    receipt.sourceBaselinePaths.map((candidate) => relativePath(root, candidate)).sort(),
    [
      ".verification/source/performance_index.json",
      ".verification/source/task_index.json",
      ".verification/source/verification_report_manifest.json",
    ],
  );
  assert.deepEqual(
    receipt.runtimeCachePaths.map((candidate) => relativePath(root, candidate)).sort(),
    [
      ".verification/cache/verification_plan.json",
      ".verification/cache/verification_report_manifest.json",
    ],
  );

  const sourceManifest = fs.readFileSync(
    path.join(sourceBaselineDir, "verification_report_manifest.json"),
    "utf8",
  );
  const runtimeManifest = fs.readFileSync(
    path.join(runtimeCacheDir, "verification_report_manifest.json"),
    "utf8",
  );
  const runtimePlan = fs.readFileSync(path.join(runtimeCacheDir, "verification_plan.json"), "utf8");
  assert.equal(sourceManifest.includes(root), false);
  assert.equal(runtimeManifest.includes(root), false);
  assert.equal(runtimePlan.includes(root), false);
  assert.match(sourceManifest, /\$PROJECT_ROOT/u);
  assert.deepEqual(
    (
      JSON.parse(sourceManifest) as { readonly artifacts: readonly { readonly key: string }[] }
    ).artifacts.map((artifact) => artifact.key),
    ["task_index_json", "performance_index_json"],
  );
  assert.deepEqual(
    (
      JSON.parse(runtimeManifest) as { readonly artifacts: readonly { readonly key: string }[] }
    ).artifacts.map((artifact) => artifact.key),
    ["verification_plan_json", "task_index_json", "performance_index_json"],
  );
});

test("verification report bundle stays quiet when receipts satisfy all tasks", () => {
  const root = writeReportBundleProject("satisfied", "export const api = 1;\n");
  const baseConfig = verificationBundleConfig();
  const pendingPlan = planTypeScriptProjectVerificationWithConfig(root, baseConfig);
  const performanceTask = pendingPlan.tasks.find((task) => task.kind === "performance");
  assert.ok(performanceTask);

  const satisfiedPlan = planTypeScriptProjectVerificationWithConfig(
    root,
    withTypeScriptVerificationReceipt(baseConfig, {
      kind: "performance",
      ownerPath: "src/index.ts",
      fingerprint: performanceTask.fingerprint,
      status: "passed",
      summary: "performance=held",
      evidence: performanceTask.requiredEvidence.map((requirement) => ({
        label: requirement.key,
        value: "ok",
      })),
    }),
  );

  assert.equal(renderTypeScriptVerificationPlan(satisfiedPlan), "");
  assert.deepEqual(satisfiedPlan.reportObligations, []);
  assert.deepEqual(buildTypeScriptVerificationReportBundle(satisfiedPlan).artifacts, []);
  assert.deepEqual(buildTypeScriptVerificationTaskIndex(satisfiedPlan).records, []);
  assert.deepEqual(buildTypeScriptVerificationPerformanceIndex(satisfiedPlan).records, []);
});

function writeReportBundleProject(label: string, source: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asp-typescript-report-bundle-${label}-`));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), source);
  return root;
}

function verificationBundleConfig() {
  return withTypeScriptVerificationSkillDescriptor(
    withTypeScriptVerificationSkillBinding(
      withTypeScriptVerificationProfileHint(
        defaultTypeScriptHarnessConfig(),
        profileHint("src/index.ts", ["latency_sensitive"]),
      ),
      "performance",
      { skillId: "typescript-verification-performance", adapter: "vitest-bench" },
    ),
    performanceDescriptor(),
  );
}

function profileHint(
  ownerPath: string,
  responsibilities: TypeScriptVerificationProfileHint["responsibilities"],
): TypeScriptVerificationProfileHint {
  return {
    ownerPath,
    responsibilities,
    taskContractOverrides: {},
  };
}

function performanceDescriptor(): TypeScriptVerificationSkillDescriptor {
  return {
    skillId: "typescript-verification-performance",
    adapter: "vitest-bench",
    tool: "vitest",
    command: "vitest bench",
    standard: "project benchmark stays within configured threshold",
    requiredInputs: ["bench_target", "baseline", "regression_threshold"],
    passCriteria: ["regression<=threshold"],
    receiptFields: ["benchmark_command", "baseline", "regression_threshold"],
  };
}
