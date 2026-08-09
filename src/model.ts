/**
 * Public data model for TypeScript harness reports.
 *
 * This module defines the DTO boundary shared by parser facts, policy
 * findings, compact renderers, and external consumers.
 */
import type { TypeScriptPackageBuildToolFact } from "./model/build_tools.js";
import type { TypeScriptPackageExtensionFact } from "./model/extensions.js";
import type {
  TypeScriptModuleReport,
  TypeScriptModuleRole,
  TypeScriptReasoningModule,
} from "./model/module_facts.js";
import type { TypeScriptPackageDependencySource } from "./model/package_dependencies.js";
import type { TypeScriptVerificationPolicy } from "./verification/model.js";

export type {
  TypeScriptPackageBuildToolConfigSource,
  TypeScriptPackageBuildToolDependencySource,
  TypeScriptPackageBuildToolFact,
  TypeScriptPackageBuildToolName,
  TypeScriptPackageBuildToolSignalFact,
  TypeScriptPackageBuildToolSignalKind,
} from "./model/build_tools.js";
export type {
  TypeScriptEffectErrorChannelKind,
  TypeScriptEffectConcurrencySignalFact,
  TypeScriptEffectConcurrencySignalKind,
  TypeScriptEffectProductionBoundaryMissingCapability,
  TypeScriptEffectProductionBoundarySignalFact,
  TypeScriptEffectProductionBoundarySignalKind,
  TypeScriptEffectRuntimeBoundaryKind,
  TypeScriptEffectRuntimeCallFact,
  TypeScriptEffectRuntimeCallKind,
  TypeScriptEffectSchemaBoundarySignalFact,
  TypeScriptEffectSchemaBoundarySignalKind,
  TypeScriptModuleResponsibilityFact,
  TypeScriptModuleResponsibilityKind,
  TypeScriptEffectPromiseInteropRiskFact,
  TypeScriptEffectPromiseInteropRiskKind,
  TypeScriptEffectResourceScopeRiskFact,
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
  TypeScriptPublicTupleApiSurfaceFact,
  TypeScriptPublicTypeAliasFact,
} from "./model/native_syntax.js";
export type {
  TypeScriptPackageExtensionActivation,
  TypeScriptPackageExtensionConfigSource,
  TypeScriptPackageExtensionCoverage,
  TypeScriptPackageExtensionDependencySource,
  TypeScriptPackageExtensionFact,
  TypeScriptPackageExtensionName,
} from "./model/extensions.js";
export type { TypeScriptPackageDependencySource } from "./model/package_dependencies.js";
export type {
  TypeScriptModuleLayer,
  TypeScriptModuleReport,
  TypeScriptModuleRole,
  TypeScriptReasoningModule,
} from "./model/module_facts.js";

export type TypeScriptDiagnosticSeverity = "info" | "warning" | "error";

export type TypeScriptHarnessRunMode = "project" | "explicit";

export interface RulePackDescriptor {
  readonly id: string;
  readonly version: string;
  readonly domains: readonly string[];
  readonly defaultMode: "blocking" | "advisory";
}

export type TypeScriptRulePack =
  | "syntax"
  | "semantic"
  | "project_policy"
  | "modularity"
  | "test_layout"
  | "agent_policy"
  | "extension_policy";

export interface TypeScriptHarnessRule {
  readonly ruleId: string;
  readonly packId: string;
  readonly severity: TypeScriptDiagnosticSeverity;
  readonly title: string;
  readonly requirement: string;
  readonly labels: Readonly<Record<string, string>>;
}

export interface SourceLocation {
  readonly path?: string;
  readonly line: number;
  readonly column: number;
}

export interface TypeScriptHarnessFinding {
  readonly ruleId: string;
  readonly packId: string;
  readonly severity: TypeScriptDiagnosticSeverity;
  readonly title: string;
  readonly summary: string;
  readonly location: SourceLocation;
  readonly requirement: string;
  readonly sourceLine?: string;
  readonly label: string;
  readonly labels: Readonly<Record<string, string>>;
}

export interface TypeScriptImportFact {
  readonly moduleSpecifier: string;
  readonly kind: "import" | "export" | "dynamic-import";
  readonly isTypeOnly: boolean;
  readonly location: SourceLocation;
}

export interface TypeScriptNativeImportResolutionFact {
  readonly moduleSpecifier: string;
  readonly kind: TypeScriptImportFact["kind"];
  readonly isTypeOnly: boolean;
  readonly location: SourceLocation;
  readonly resolution: "relative" | "path-alias" | "package-import" | "external" | "unresolved";
  readonly resolvedPath?: string;
}

export interface TypeScriptSourceTextFixtureFact {
  readonly fixturePath: string;
  readonly location: SourceLocation;
  readonly lineEnd: number;
}

export interface TypeScriptExportFact {
  readonly name: string;
  readonly kind:
    | "default"
    | "export-assignment"
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "variable"
    | "namespace"
    | "global-namespace"
    | "export-list"
    | "reexport"
    | "namespace-reexport"
    | "star";
  readonly isTypeOnly: boolean;
  readonly location: SourceLocation;
}

export interface TypeScriptNativeDiagnosticRelatedInformation {
  readonly code: number;
  readonly source?: string;
  readonly message: string;
  readonly category: TypeScriptDiagnosticSeverity;
  readonly location: SourceLocation;
  readonly sourceLine?: string;
}

export interface TypeScriptNativeDiagnostic extends TypeScriptNativeDiagnosticRelatedInformation {
  readonly relatedInformation: readonly TypeScriptNativeDiagnosticRelatedInformation[];
}

export interface TypeScriptPathAliasFact {
  readonly pattern: string;
  readonly targets: readonly string[];
  readonly baseUrl?: string;
}

export interface TypeScriptCompilerOptionFacts {
  readonly module?: string;
  readonly moduleResolution?: string;
  readonly target?: string;
  readonly rootDir?: string;
  readonly rootDirs: readonly string[];
  readonly outDir?: string;
  readonly jsx?: string;
  readonly allowJs: boolean;
  readonly checkJs: boolean;
  readonly noEmit: boolean;
  readonly composite: boolean;
  readonly declaration: boolean;
  readonly emitDeclarationOnly: boolean;
  readonly declarationMap: boolean;
  readonly sourceMap: boolean;
}

export interface TypeScriptProjectConfigFacts {
  readonly configPath?: string;
  readonly fileNames: readonly string[];
  readonly projectReferences: readonly string[];
  readonly projectReferencePackages: readonly TypeScriptProjectReferencePackageFact[];
  readonly pathAliases: readonly TypeScriptPathAliasFact[];
  readonly baseUrl?: string;
  readonly compilerOptions: TypeScriptCompilerOptionFacts;
  readonly diagnostics: readonly TypeScriptNativeDiagnostic[];
}

export interface PackageJsonEntryTargetFact {
  readonly target: string;
  readonly conditions: readonly string[];
  readonly location: SourceLocation;
}

export interface PackageJsonEntryFact {
  readonly subpath: string;
  readonly targets: readonly string[];
  readonly targetDetails: readonly PackageJsonEntryTargetFact[];
  readonly location: SourceLocation;
}

export interface PackageJsonScriptFact {
  readonly name: string;
  readonly command: string;
  readonly location: SourceLocation;
}

export interface PackageJsonWorkspaceFact {
  readonly pattern: string;
  readonly location: SourceLocation;
}

export interface TypeScriptPackageDependencyFact {
  readonly name: string;
  readonly versionRange: string;
  readonly source: TypeScriptPackageDependencySource;
  readonly location: SourceLocation;
}

export interface TypeScriptWorkspacePackageFact {
  readonly path: string;
  readonly packageJsonPath: string;
  readonly pattern: string;
  readonly location: SourceLocation;
  readonly name?: string;
  readonly packageType?: string;
  readonly configPath?: string;
  readonly diagnostics: readonly TypeScriptNativeDiagnostic[];
}

export interface TypeScriptProjectReferencePackageFact {
  readonly path: string;
  readonly packageJsonPath: string;
  readonly name?: string;
  readonly packageType?: string;
  readonly configPath?: string;
  readonly compilerOptions?: TypeScriptCompilerOptionFacts;
  readonly diagnostics: readonly TypeScriptNativeDiagnostic[];
}

export interface PackageJsonFacts {
  readonly path?: string;
  readonly name?: string;
  readonly packageType?: string;
  readonly hasExports: boolean;
  readonly hasImports: boolean;
  readonly entrypoints: readonly PackageJsonEntryFact[];
  readonly exports: readonly PackageJsonEntryFact[];
  readonly imports: readonly PackageJsonEntryFact[];
  readonly bins: readonly PackageJsonEntryFact[];
  readonly dependencies: readonly TypeScriptPackageDependencyFact[];
  readonly scripts: readonly PackageJsonScriptFact[];
  readonly workspaces: readonly PackageJsonWorkspaceFact[];
  readonly workspacePackages: readonly TypeScriptWorkspacePackageFact[];
  readonly packageExtensions: readonly TypeScriptPackageExtensionFact[];
  readonly packageBuildTools: readonly TypeScriptPackageBuildToolFact[];
  readonly scriptNames: readonly string[];
  readonly workspacePatterns: readonly string[];
  readonly diagnostics: readonly TypeScriptNativeDiagnostic[];
}

export interface TypeScriptProjectHarnessScope {
  readonly projectRoot: string;
  readonly sourcePaths: readonly string[];
  readonly testPaths: readonly string[];
  readonly config: TypeScriptProjectConfigFacts;
  readonly packageJson: PackageJsonFacts;
}

export interface TypeScriptHarnessConfig {
  readonly ignoredDirNames: readonly string[];
  readonly includeHiddenDirNames: readonly string[];
  readonly includeTests: boolean;
  readonly sourceDirNames: readonly string[];
  readonly testDirNames: readonly string[];
  readonly blockingSeverities: readonly TypeScriptDiagnosticSeverity[];
  readonly disabledRuleIds: readonly string[];
  readonly disabledRulePacks: readonly TypeScriptRulePack[];
  readonly ruleSeverityOverrides: Readonly<Partial<Record<string, TypeScriptDiagnosticSeverity>>>;
  readonly rulePackSeverityOverrides: Readonly<
    Partial<Record<TypeScriptRulePack, TypeScriptDiagnosticSeverity>>
  >;
  readonly blockingRuleIds: readonly string[];
  readonly verificationPolicy: TypeScriptVerificationPolicy;
}

export interface TypeScriptImportEdgeFact {
  readonly fromPath: string;
  readonly moduleSpecifier: string;
  readonly kind: TypeScriptImportFact["kind"];
  readonly isTypeOnly: boolean;
  readonly location: SourceLocation;
  readonly resolution: TypeScriptNativeImportResolutionFact["resolution"];
  readonly toPath?: string;
}

export interface TypeScriptReasoningDiagnosticFact {
  readonly ownerPath: string;
  readonly phase: "syntax" | "semantic" | "config" | "package-json";
  readonly code: number;
  readonly source?: string;
  readonly category: TypeScriptDiagnosticSeverity;
  readonly message: string;
  readonly location: SourceLocation;
  readonly sourceLine?: string;
  readonly relatedInformation: readonly TypeScriptNativeDiagnosticRelatedInformation[];
}

export interface TypeScriptReasoningImportSummaryFact {
  readonly totalImports: number;
  readonly relativeImports: number;
  readonly pathAliasImports: number;
  readonly packageImportImports: number;
  readonly externalImports: number;
  readonly unresolvedImports: number;
}

export type TypeScriptReasoningOwnerBranchRole = "root" | TypeScriptModuleRole;

export interface TypeScriptReasoningOwnerBranchFact {
  readonly path: string;
  readonly ownerNamespace: string;
  readonly roles: readonly TypeScriptReasoningOwnerBranchRole[];
  readonly hasIntentDoc: boolean;
  readonly importSummary: TypeScriptReasoningImportSummaryFact;
  readonly exportNames: readonly string[];
  readonly typeOnlyExportNames: readonly string[];
  readonly childEdges: readonly TypeScriptImportEdgeFact[];
}

export interface TypeScriptReasoningOwnerDependencyFact {
  readonly fromPath: string;
  readonly fromRole: TypeScriptModuleRole;
  readonly moduleSpecifier: string;
  readonly kind: TypeScriptImportFact["kind"];
  readonly isTypeOnly: boolean;
  readonly isTestContext: boolean;
  readonly location: SourceLocation;
  readonly resolution: Exclude<TypeScriptNativeImportResolutionFact["resolution"], "external">;
  readonly toPath?: string;
  readonly toRole?: TypeScriptModuleRole;
}

export interface TypeScriptReasoningSourceShadowFact {
  readonly ownerNamespace: string;
  readonly paths: readonly string[];
}

export interface TypeScriptPackageEntryResolutionFact {
  readonly kind: "exports" | "imports" | "bin" | "field";
  readonly subpath: string;
  readonly target: string;
  readonly conditions: readonly string[];
  readonly resolution: "parser-visible" | "external" | "unresolved";
  readonly location: SourceLocation;
  readonly toPath?: string;
}

export interface TypeScriptProjectReferenceResolutionFact {
  readonly referencePath: string;
  readonly resolution: "referenced-package" | "external";
  readonly packagePath?: string;
  readonly packageName?: string;
  readonly configPath?: string;
}

export interface TypeScriptPackageImportOwnerFact {
  readonly fromPath: string;
  readonly moduleSpecifier: string;
  readonly kind: TypeScriptImportFact["kind"];
  readonly isTypeOnly: boolean;
  readonly location: SourceLocation;
  readonly packagePath: string;
  readonly packageName: string;
  readonly ownerKind: "project-reference" | "workspace";
  readonly via: "package-name" | "package-subpath";
}

export interface TypeScriptReasoningTree {
  readonly runMode: TypeScriptHarnessRunMode;
  readonly projectRoot: string;
  readonly packageName?: string;
  readonly configPath?: string;
  readonly compilerOptions: TypeScriptCompilerOptionFacts;
  readonly projectReferences: readonly string[];
  readonly projectReferenceResolutions: readonly TypeScriptProjectReferenceResolutionFact[];
  readonly sourceRoots: readonly string[];
  readonly testRoots: readonly string[];
  readonly pathAliases: readonly TypeScriptPathAliasFact[];
  readonly packageEntrypoints: readonly PackageJsonEntryFact[];
  readonly packageExports: readonly PackageJsonEntryFact[];
  readonly packageImports: readonly PackageJsonEntryFact[];
  readonly packageBins: readonly PackageJsonEntryFact[];
  readonly packageDependencies: readonly TypeScriptPackageDependencyFact[];
  readonly packageScripts: readonly PackageJsonScriptFact[];
  readonly packageWorkspaces: readonly PackageJsonWorkspaceFact[];
  readonly packageExtensions: readonly TypeScriptPackageExtensionFact[];
  readonly packageBuildTools: readonly TypeScriptPackageBuildToolFact[];
  readonly workspacePackages: readonly TypeScriptWorkspacePackageFact[];
  readonly workspacePatterns: readonly string[];
  readonly projectReferencePackages: readonly TypeScriptProjectReferencePackageFact[];
  readonly packageImportOwners: readonly TypeScriptPackageImportOwnerFact[];
  readonly packageEntryResolutions: readonly TypeScriptPackageEntryResolutionFact[];
  readonly diagnostics: readonly TypeScriptReasoningDiagnosticFact[];
  readonly modules: readonly TypeScriptReasoningModule[];
  readonly ownerBranches: readonly TypeScriptReasoningOwnerBranchFact[];
  readonly ownerDependencies: readonly TypeScriptReasoningOwnerDependencyFact[];
  readonly shadowedSourceOwners: readonly TypeScriptReasoningSourceShadowFact[];
  readonly orphanedSourceFiles: readonly string[];
  readonly edges: readonly TypeScriptImportEdgeFact[];
}

export interface TypeScriptHarnessReport {
  readonly runMode: TypeScriptHarnessRunMode;
  readonly modules: readonly TypeScriptModuleReport[];
  readonly findings: readonly TypeScriptHarnessFinding[];
  readonly rootPaths: readonly string[];
  readonly blockingSeverities: readonly TypeScriptDiagnosticSeverity[];
  readonly blockingRuleIds: readonly string[];
  readonly projectResolution?: TypeScriptProjectHarnessScope;
  readonly reasoningTree: TypeScriptReasoningTree;
}

export interface TypeScriptProjectHarnessAgentSnapshotPackage {
  readonly packageRoot: string;
  readonly packagePath: string;
  readonly report: TypeScriptHarnessReport;
}

export interface TypeScriptProjectHarnessAgentSnapshot {
  readonly projectRoot: string;
  readonly packages: readonly TypeScriptProjectHarnessAgentSnapshotPackage[];
}

export function blockingFindings(
  report: TypeScriptHarnessReport,
): readonly TypeScriptHarnessFinding[] {
  const severities = new Set(report.blockingSeverities);
  const ruleIds = new Set(report.blockingRuleIds);
  return report.findings.filter(
    (finding) => severities.has(finding.severity) || ruleIds.has(finding.ruleId),
  );
}

export function advisoryFindings(
  report: TypeScriptHarnessReport,
): readonly TypeScriptHarnessFinding[] {
  return report.findings.filter((finding) => finding.severity === "info");
}

export function isTypeScriptHarnessClean(report: TypeScriptHarnessReport): boolean {
  return blockingFindings(report).length === 0;
}

export function fileCount(report: TypeScriptHarnessReport): number {
  return report.reasoningTree.modules.length;
}

export function parsedCount(report: TypeScriptHarnessReport): number {
  return report.reasoningTree.modules.filter((moduleReport) => moduleReport.isValid).length;
}
