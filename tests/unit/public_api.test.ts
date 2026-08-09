import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as api from "../../src/index.js";
import type {
  PackageJsonEntryFact,
  PackageJsonEntryTargetFact,
  PackageJsonFacts,
  PackageJsonScriptFact,
  PackageJsonWorkspaceFact,
  RulePackDescriptor,
  SourceLocation,
  TypeScriptCompilerOptionFacts,
  TypeScriptDiagnosticSeverity,
  TypeScriptExportFact,
  TypeScriptHarnessConfig,
  TypeScriptHarnessFinding,
  TypeScriptHarnessReport,
  TypeScriptHarnessRule,
  TypeScriptHarnessRunMode,
  TypeScriptRulePack,
  TypeScriptImportEdgeFact,
  TypeScriptImportFact,
  TypeScriptModuleLayer,
  TypeScriptModuleReport,
  TypeScriptModuleResponsibilityFact,
  TypeScriptModuleResponsibilityKind,
  TypeScriptModuleRole,
  TypeScriptNativeDiagnostic,
  TypeScriptNativeDiagnosticRelatedInformation,
  TypeScriptNativeImportResolutionFact,
  TypeScriptPackageBuildToolConfigSource,
  TypeScriptPackageBuildToolDependencySource,
  TypeScriptPackageBuildToolFact,
  TypeScriptPackageBuildToolName,
  TypeScriptPackageBuildToolSignalFact,
  TypeScriptPackageBuildToolSignalKind,
  TypeScriptPackageDependencyFact,
  TypeScriptPackageDependencySource,
  TypeScriptPackageImportOwnerFact,
  TypeScriptPackageEntryResolutionFact,
  TypeScriptPackageExtensionActivation,
  TypeScriptPackageExtensionConfigSource,
  TypeScriptPackageExtensionDependencySource,
  TypeScriptPackageExtensionFact,
  TypeScriptPackageExtensionName,
  TypeScriptPathAliasFact,
  TypeScriptProjectHarnessAgentSnapshot,
  TypeScriptProjectHarnessAgentSnapshotPackage,
  TypeScriptProjectConfigFacts,
  TypeScriptProjectHarnessScope,
  TypeScriptProjectReferencePackageFact,
  TypeScriptProjectReferenceResolutionFact,
  TypeScriptEffectErrorChannelKind,
  TypeScriptEffectConcurrencySignalFact,
  TypeScriptEffectConcurrencySignalKind,
  TypeScriptEffectPromiseInteropRiskFact,
  TypeScriptEffectPromiseInteropRiskKind,
  TypeScriptEffectProductionBoundaryMissingCapability,
  TypeScriptEffectProductionBoundarySignalFact,
  TypeScriptEffectProductionBoundarySignalKind,
  TypeScriptEffectResourceScopeRiskFact,
  TypeScriptEffectRuntimeCallFact,
  TypeScriptEffectRuntimeCallKind,
  TypeScriptEffectSchemaBoundarySignalFact,
  TypeScriptEffectSchemaBoundarySignalKind,
  TypeScriptEffectServiceContainerKind,
  TypeScriptEffectServiceMethodFact,
  TypeScriptPublicAsyncEffectSurfaceFact,
  TypeScriptPublicDataFieldFact,
  TypeScriptPublicDiscriminatedUnionVariantFieldFact,
  TypeScriptPublicFunctionControlFlowFact,
  TypeScriptPublicFunctionParamFact,
  TypeScriptPublicReturnObjectShapeFact,
  TypeScriptReactHookCallSignalFact,
  TypeScriptReactHookCallViolationKind,
  TypeScriptReactRenderOwnerKind,
  TypeScriptReactRenderPuritySignalFact,
  TypeScriptReactRenderPuritySignalKind,
  TypeScriptReactStaticDefinitionSignalFact,
  TypeScriptReactStaticDefinitionSignalKind,
  TypeScriptPublicTypeAliasFact,
  TypeScriptPublicTupleApiSurfaceFact,
  TypeScriptReasoningDiagnosticFact,
  TypeScriptReasoningImportSummaryFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningOwnerBranchFact,
  TypeScriptReasoningOwnerBranchRole,
  TypeScriptReasoningOwnerDependencyFact,
  TypeScriptReasoningSourceShadowFact,
  TypeScriptReasoningTree,
  TypeScriptOwnerResponsibility,
  TypeScriptRenderOptions,
  TypeScriptVerificationDependencySignal,
  TypeScriptVerificationEvidence,
  TypeScriptVerificationPerformanceIndex,
  TypeScriptVerificationPerformanceRecord,
  TypeScriptVerificationPhase,
  TypeScriptVerificationPlan,
  TypeScriptVerificationPolicy,
  TypeScriptVerificationProfileCandidate,
  TypeScriptVerificationProfileCandidateState,
  TypeScriptVerificationProfileHint,
  TypeScriptVerificationProfileIndex,
  TypeScriptVerificationReceipt,
  TypeScriptVerificationReceiptStatus,
  TypeScriptVerificationReportArtifact,
  TypeScriptVerificationReportBundle,
  TypeScriptVerificationReportObligation,
  TypeScriptVerificationReportOptions,
  TypeScriptVerificationReportPersistence,
  TypeScriptVerificationReportTemplate,
  TypeScriptVerificationReportTraceConfig,
  TypeScriptVerificationReportWriteConfig,
  TypeScriptVerificationReportWriteReceipt,
  TypeScriptVerificationRequirement,
  TypeScriptVerificationResolutionNote,
  TypeScriptVerificationSkillBinding,
  TypeScriptVerificationSkillDescriptor,
  TypeScriptVerificationTask,
  TypeScriptVerificationTaskContract,
  TypeScriptVerificationTaskIndex,
  TypeScriptVerificationTaskKind,
  TypeScriptVerificationTaskRecord,
  TypeScriptVerificationTaskState,
  TypeScriptVerificationWaiver,
  TypeScriptWorkspacePackageFact,
} from "../../src/index.js";

type PublicModelContract = readonly [
  PackageJsonFacts,
  PackageJsonEntryFact,
  PackageJsonEntryTargetFact,
  PackageJsonScriptFact,
  PackageJsonWorkspaceFact,
  TypeScriptCompilerOptionFacts,
  RulePackDescriptor,
  SourceLocation,
  TypeScriptDiagnosticSeverity,
  TypeScriptExportFact,
  TypeScriptHarnessConfig,
  TypeScriptHarnessFinding,
  TypeScriptHarnessReport,
  TypeScriptHarnessRule,
  TypeScriptHarnessRunMode,
  TypeScriptRulePack,
  TypeScriptImportFact,
  TypeScriptImportEdgeFact,
  TypeScriptModuleLayer,
  TypeScriptModuleReport,
  TypeScriptModuleResponsibilityFact,
  TypeScriptModuleResponsibilityKind,
  TypeScriptModuleRole,
  TypeScriptNativeImportResolutionFact,
  TypeScriptNativeDiagnostic,
  TypeScriptNativeDiagnosticRelatedInformation,
  TypeScriptPackageBuildToolConfigSource,
  TypeScriptPackageBuildToolDependencySource,
  TypeScriptPackageBuildToolFact,
  TypeScriptPackageBuildToolName,
  TypeScriptPackageBuildToolSignalFact,
  TypeScriptPackageBuildToolSignalKind,
  TypeScriptPackageDependencyFact,
  TypeScriptPackageDependencySource,
  TypeScriptPackageImportOwnerFact,
  TypeScriptPackageEntryResolutionFact,
  TypeScriptPackageExtensionActivation,
  TypeScriptPackageExtensionConfigSource,
  TypeScriptPackageExtensionDependencySource,
  TypeScriptPackageExtensionFact,
  TypeScriptPackageExtensionName,
  TypeScriptPathAliasFact,
  TypeScriptProjectHarnessAgentSnapshot,
  TypeScriptProjectHarnessAgentSnapshotPackage,
  TypeScriptProjectConfigFacts,
  TypeScriptProjectHarnessScope,
  TypeScriptProjectReferencePackageFact,
  TypeScriptProjectReferenceResolutionFact,
  TypeScriptEffectErrorChannelKind,
  TypeScriptEffectConcurrencySignalFact,
  TypeScriptEffectConcurrencySignalKind,
  TypeScriptEffectPromiseInteropRiskFact,
  TypeScriptEffectPromiseInteropRiskKind,
  TypeScriptEffectProductionBoundaryMissingCapability,
  TypeScriptEffectProductionBoundarySignalFact,
  TypeScriptEffectProductionBoundarySignalKind,
  TypeScriptEffectResourceScopeRiskFact,
  TypeScriptEffectRuntimeCallFact,
  TypeScriptEffectRuntimeCallKind,
  TypeScriptEffectSchemaBoundarySignalFact,
  TypeScriptEffectSchemaBoundarySignalKind,
  TypeScriptEffectServiceContainerKind,
  TypeScriptEffectServiceMethodFact,
  TypeScriptPublicAsyncEffectSurfaceFact,
  TypeScriptPublicDataFieldFact,
  TypeScriptPublicDiscriminatedUnionVariantFieldFact,
  TypeScriptPublicFunctionControlFlowFact,
  TypeScriptPublicFunctionParamFact,
  TypeScriptPublicReturnObjectShapeFact,
  TypeScriptReactHookCallSignalFact,
  TypeScriptReactHookCallViolationKind,
  TypeScriptReactRenderOwnerKind,
  TypeScriptReactRenderPuritySignalFact,
  TypeScriptReactRenderPuritySignalKind,
  TypeScriptReactStaticDefinitionSignalFact,
  TypeScriptReactStaticDefinitionSignalKind,
  TypeScriptPublicTypeAliasFact,
  TypeScriptPublicTupleApiSurfaceFact,
  TypeScriptReasoningDiagnosticFact,
  TypeScriptReasoningImportSummaryFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningOwnerBranchFact,
  TypeScriptReasoningOwnerBranchRole,
  TypeScriptReasoningOwnerDependencyFact,
  TypeScriptReasoningSourceShadowFact,
  TypeScriptReasoningTree,
  TypeScriptOwnerResponsibility,
  TypeScriptRenderOptions,
  TypeScriptVerificationDependencySignal,
  TypeScriptVerificationEvidence,
  TypeScriptVerificationPerformanceIndex,
  TypeScriptVerificationPerformanceRecord,
  TypeScriptVerificationPhase,
  TypeScriptVerificationPlan,
  TypeScriptVerificationPolicy,
  TypeScriptVerificationProfileCandidate,
  TypeScriptVerificationProfileCandidateState,
  TypeScriptVerificationProfileHint,
  TypeScriptVerificationProfileIndex,
  TypeScriptVerificationReceipt,
  TypeScriptVerificationReceiptStatus,
  TypeScriptVerificationReportArtifact,
  TypeScriptVerificationReportBundle,
  TypeScriptVerificationReportObligation,
  TypeScriptVerificationReportOptions,
  TypeScriptVerificationReportPersistence,
  TypeScriptVerificationReportTemplate,
  TypeScriptVerificationReportTraceConfig,
  TypeScriptVerificationReportWriteConfig,
  TypeScriptVerificationReportWriteReceipt,
  TypeScriptVerificationRequirement,
  TypeScriptVerificationResolutionNote,
  TypeScriptVerificationSkillBinding,
  TypeScriptVerificationSkillDescriptor,
  TypeScriptVerificationTask,
  TypeScriptVerificationTaskContract,
  TypeScriptVerificationTaskIndex,
  TypeScriptVerificationTaskKind,
  TypeScriptVerificationTaskRecord,
  TypeScriptVerificationTaskState,
  TypeScriptVerificationWaiver,
  TypeScriptWorkspacePackageFact,
];

const publicModelContract: PublicModelContract | undefined = undefined;

test("public facade exposes the stable M13 runtime surface", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "DEFAULT_IGNORED_DIR_NAMES",
    "TypeScriptVerificationReportWriteError",
    "activeTypeScriptVerificationProfileCandidates",
    "activeTypeScriptVerificationProfileHints",
    "advisoryFindings",
    "assertTypeScriptLangHarnessClean",
    "assertTypeScriptProjectHarnessAgentClean",
    "assertTypeScriptProjectHarnessClean",
    "assertTypeScriptProjectHarnessEmbeddedClean",
    "blockingFindings",
    "buildTypeScriptProjectHarnessAgentSnapshot",
    "buildTypeScriptVerificationPerformanceIndex",
    "buildTypeScriptVerificationProfileIndex",
    "buildTypeScriptVerificationProfileIndexForReport",
    "buildTypeScriptVerificationProfileIndexWithConfig",
    "buildTypeScriptVerificationReportBundle",
    "buildTypeScriptVerificationReportBundleWithOptions",
    "buildTypeScriptVerificationTaskIndex",
    "defaultTypeScriptHarnessConfig",
    "defaultTypeScriptVerificationPolicy",
    "defaultTypeScriptVerificationReportOptions",
    "discoverTypeScriptFiles",
    "fileCount",
    "isTypeScriptHarnessClean",
    "parseTypeScriptProjectFiles",
    "parseTypeScriptSourceFile",
    "parsedCount",
    "planTypeScriptProjectVerification",
    "planTypeScriptProjectVerificationForReport",
    "planTypeScriptProjectVerificationWithConfig",
    "readProjectResolution",
    "renderAssertionMessage",
    "renderTypeScriptHarnessRulesMarkdown",
    "renderTypeScriptProjectHarness",
    "renderTypeScriptProjectHarnessAdvice",
    "renderTypeScriptProjectHarnessAgentCompactText",
    "renderTypeScriptProjectHarnessAgentSnapshot",
    "renderTypeScriptProjectHarnessJson",
    "renderTypeScriptReasoningTree",
    "renderTypeScriptVerificationPerformanceIndex",
    "renderTypeScriptVerificationPerformanceIndexJson",
    "renderTypeScriptVerificationPlan",
    "renderTypeScriptVerificationPlanJson",
    "renderTypeScriptVerificationProfileIndex",
    "renderTypeScriptVerificationProfileIndexJson",
    "renderTypeScriptVerificationReportArtifactJson",
    "renderTypeScriptVerificationReportBundleJson",
    "renderTypeScriptVerificationSkillContracts",
    "renderTypeScriptVerificationTaskIndexJson",
    "runTypeScriptLangHarness",
    "runTypeScriptProjectHarness",
    "runTypeScriptProjectHarnessAgentSnapshot",
    "typeScriptAgentPolicyRules",
    "typeScriptExtensionPolicyRules",
    "typeScriptHarnessRulesMarkdown",
    "typeScriptModularityRules",
    "typeScriptProjectPolicyRules",
    "typeScriptRulePackDescriptors",
    "typeScriptRulePackRuleIds",
    "typeScriptSemanticRules",
    "typeScriptSyntaxRules",
    "typeScriptTestLayoutRules",
    "typeScriptVerificationProfileIndexIsClear",
    "withDisabledTypeScriptRule",
    "withDisabledTypeScriptRulePack",
    "withDisabledTypeScriptRules",
    "withDisabledTypeScriptVerificationTaskKind",
    "withDisabledTypeScriptVerificationTaskKinds",
    "withTypeScriptBlockingSeverities",
    "withTypeScriptRulePackSeverity",
    "withTypeScriptRuleSeverity",
    "withTypeScriptVerificationDependencySignal",
    "withTypeScriptVerificationProfileHint",
    "withTypeScriptVerificationReceipt",
    "withTypeScriptVerificationResponsibilityTaskKinds",
    "withTypeScriptVerificationSkillBinding",
    "withTypeScriptVerificationSkillDescriptor",
    "withTypeScriptVerificationTaskContract",
    "withTypeScriptVerificationWaiver",
    "writeTypeScriptHarnessRulesToUnitTests",
    "writeTypeScriptVerificationReports",
  ]);
  assert.equal("buildTypeScriptReasoningTree" in api, false);
  assert.equal("evaluateDefaultRulePacks" in api, false);
  assert.equal(publicModelContract, undefined);
});

test("public runner renders compact agent snapshots from parser-native facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-public-api-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "generated"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/public-api",
      type: "module",
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        baseUrl: ".",
        rootDirs: ["src", "generated"],
        paths: {
          "@app/*": ["src/*"],
        },
      },
      include: ["src/**/*.ts", "generated/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "domain.ts"),
    ["export interface Domain { id: string }", "export const domain = 1;"].join("\n"),
  );
  fs.writeFileSync(path.join(root, "generated", "generated.ts"), "export const generated = 1;\n");
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    [
      'import { generated } from "./generated.js";',
      'export { domain } from "@app/domain";',
      'export type { Domain } from "@app/domain";',
      "export const indexed = generated;",
    ].join("\n"),
  );

  const report = api.runTypeScriptProjectHarness(root);
  const snapshot = api.renderTypeScriptReasoningTree(report);
  const projectSnapshot = api.runTypeScriptProjectHarnessAgentSnapshot(root);
  const renderedProjectSnapshot = api.renderTypeScriptProjectHarnessAgentSnapshot(projectSnapshot);

  assert.equal(api.isTypeScriptHarnessClean(report), true);
  assert.equal(renderedProjectSnapshot, snapshot);
  assert.match(snapshot, /^Modules: source=3 branches=3 deps=3 paths=1 findings=2/u);
  assert.match(snapshot, /OwnerBranches:/u);
  assert.match(snapshot, /src\/index\.ts \[root, facade\] owner=src/u);
  assert.match(snapshot, /OwnerDependencies:/u);
  assert.match(snapshot, /src\/index\.ts --relative\/import--> generated\/generated\.ts/u);
  assert.match(snapshot, /src\/index\.ts --path-alias\/export--> src\/domain\.ts/u);
  assert.match(snapshot, /src\/index\.ts --path-alias\/type-export--> src\/domain\.ts/u);
  assert.doesNotMatch(snapshot, /^\{/u);
  assert.doesNotMatch(snapshot, /"modules":/u);
});

test("public agent-clean assertion surfaces advisory findings as test-gate feedback", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-agent-clean-"));
  writeAdviceOnlyProject(root);

  const blockingOnlyReport = api.assertTypeScriptProjectHarnessClean(root);
  assert.equal(api.isTypeScriptHarnessClean(blockingOnlyReport), true);
  assert.ok(
    blockingOnlyReport.findings.some((finding) => finding.ruleId === "TS-AGENT-POLICY-004"),
  );

  assert.throws(
    () => api.assertTypeScriptProjectHarnessAgentClean(root),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /AgentCompactText: mode=advice findings=3 tasks=3/u);
      assert.match(error.message, /Directive: edit listed targets/u);
      assert.match(error.message, /RepairTasks:/u);
      assert.match(error.message, /\[TS-AGENT-POLICY-004\] Info x1: .+ task=1/u);
      assert.match(error.message, /\[TS-AGENT-POLICY-005\] Info x1: .+ task=2/u);
      assert.match(error.message, /\[TS-AGENT-POLICY-006\] Info x1: .+ task=3/u);
      assert.match(error.message, /Public function exposes multiple flag parameters/u);
      assert.match(error.message, /targets:\n   - @ src\/api\.ts/u);
      assert.match(error.message, /fix:/u);
      assert.doesNotMatch(error.message, /Contract:/u);
      assert.doesNotMatch(error.message, /RuleIndex:/u);
      assert.doesNotMatch(error.message, /Help:/u);
      assert.doesNotMatch(error.message, /\n  rule:/u);
      assert.doesNotMatch(error.message, /\n  problem:/u);
      assert.doesNotMatch(error.message, /\n  facts:/u);
      assert.doesNotMatch(error.message, /FindingGroups:/u);
      assert.doesNotMatch(error.message, /^\[ok\]/u);
      return true;
    },
  );

  const config = api.withDisabledTypeScriptRulePack(
    api.defaultTypeScriptHarnessConfig(),
    "agent_policy",
  );
  api.assertTypeScriptProjectHarnessAgentClean(root, config);
});

test("public embedded assertion emits advice without failing info-only projects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-embedded-clean-"));
  writeAdviceOnlyProject(root);
  const advice: string[] = [];

  const report = api.assertTypeScriptProjectHarnessEmbeddedClean(root, {
    writeAdvice: (message) => advice.push(message),
  });

  assert.equal(api.isTypeScriptHarnessClean(report), true);
  assert.equal(advice.length, 1);
  assert.match(advice[0] ?? "", /^AgentCompactText: mode=advice findings=3 tasks=3/u);
  assert.match(advice[0] ?? "", /Directive: edit listed targets/u);
});

test("public embedded assertion defaults to a fast non-semantic policy pass", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-embedded-fast-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const bad: string = 1;\n");

  const fullReport = api.runTypeScriptProjectHarness(root);
  const embeddedFastReport = api.assertTypeScriptProjectHarnessEmbeddedClean(root, {
    emitAdvice: false,
  });
  const embeddedSemanticReport = api.assertTypeScriptProjectHarnessEmbeddedClean(root, {
    collectSemanticDiagnostics: true,
    emitAdvice: false,
  });

  assert.ok(fullReport.findings.some((finding) => finding.ruleId === "TS-SEM-R001"));
  assert.ok(embeddedFastReport.findings.every((finding) => finding.ruleId !== "TS-SEM-R001"));
  assert.ok(embeddedSemanticReport.findings.some((finding) => finding.ruleId === "TS-SEM-R001"));
});

test("public agent compact text renderer can select blocking or all findings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-agent-compact-"));
  writeAdviceOnlyProject(root);

  const report = api.runTypeScriptProjectHarness(root);
  const blockingCompact = api.renderTypeScriptProjectHarnessAgentCompactText(report, {
    findings: "blocking",
  });
  const allCompact = api.renderTypeScriptProjectHarnessAgentCompactText(report, {
    findings: "all",
    maxActionGroups: 1,
    maxTargetExamples: 1,
  });

  assert.equal(blockingCompact, "");
  assert.match(allCompact, /AgentCompactText: mode=all findings=3 tasks=3/u);
  assert.match(allCompact, /RepairTasks:/u);
  assert.match(allCompact, /targets:/u);
  assert.match(allCompact, /\.\.\. \+2 repair tasks/u);
  assert.doesNotMatch(allCompact, /FindingGroups:/u);
});

function writeAdviceOnlyProject(root: string): void {
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  fs.writeFileSync(
    path.join(root, "src", "api.ts"),
    [
      "export function configure(",
      "  ownerId: string,",
      "  includeDrafts: boolean,",
      "  forceRefresh: boolean,",
      "  region: string,",
      "  timeoutMs: number,",
      "  traceId: string",
      "): [string, number] {",
      "  return [ownerId, timeoutMs];",
      "}",
    ].join("\n"),
  );
}
