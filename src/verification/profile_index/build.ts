import path from "node:path";

import { defaultAspTypeScriptConfig } from "../../config.js";
import type {
  AspTypeScriptConfig,
  AspTypeScriptReport,
  TypeScriptImportEdgeFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningOwnerBranchFact,
} from "../../model.js";
import { runAspTypeScript } from "../../runner.js";
import { taskKindsForResponsibilities } from "../profile.js";
import type {
  TypeScriptOwnerResponsibility,
  TypeScriptVerificationEvidence,
  TypeScriptVerificationPolicy,
  TypeScriptVerificationProfileCandidate,
  TypeScriptVerificationProfileCandidateState,
  TypeScriptVerificationProfileHint,
  TypeScriptVerificationProfileIndex,
} from "../model.js";

interface ProfileSignals {
  readonly ownerModules: number;
  readonly childModules: number;
  readonly externalImports: number;
  readonly packageImportImports: number;
  readonly unresolvedImports: number;
  readonly ownerDeps: number;
  readonly dependencyRoots: readonly string[];
  readonly configuredDependencyRoots: readonly string[];
  readonly unconfiguredDependencyRoots: readonly string[];
  readonly externalRoots: readonly string[];
  readonly packageImportRoots: readonly string[];
  readonly signalResponsibilities: readonly TypeScriptOwnerResponsibility[];
  readonly packageEntries: readonly string[];
}

export function buildTypeScriptVerificationProfileIndex(
  projectRootInput: string | URL,
): TypeScriptVerificationProfileIndex {
  return buildTypeScriptVerificationProfileIndexWithConfig(
    projectRootInput,
    defaultAspTypeScriptConfig(),
  );
}

export function buildTypeScriptVerificationProfileIndexWithConfig(
  projectRootInput: string | URL,
  config: AspTypeScriptConfig,
): TypeScriptVerificationProfileIndex {
  return buildTypeScriptVerificationProfileIndexForReport(
    runAspTypeScript(projectRootInput, config),
    config.verificationPolicy,
  );
}

export function buildTypeScriptVerificationProfileIndexForReport(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
): TypeScriptVerificationProfileIndex {
  const candidates = report.reasoningTree.modules
    .filter(isProfileCandidateModule)
    .map((moduleReport) => profileCandidate(report, policy, moduleReport))
    .filter(
      (candidate): candidate is TypeScriptVerificationProfileCandidate => candidate !== undefined,
    )
    .sort(
      (left, right) =>
        left.packageRoot.localeCompare(right.packageRoot) ||
        left.ownerPath.localeCompare(right.ownerPath),
    );
  return {
    projectRoot: report.reasoningTree.projectRoot,
    candidates,
  };
}

function profileCandidate(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
  moduleReport: TypeScriptReasoningModule,
): TypeScriptVerificationProfileCandidate | undefined {
  const branch = ownerBranchForModule(report, moduleReport);
  const signals = profileSignals(report, policy, moduleReport, branch);
  const responsibilities = suggestedResponsibilities(moduleReport, signals);
  if (responsibilities.length === 0) {
    return undefined;
  }
  const matchingHint = matchingProfileHint(report, policy, moduleReport.path);
  const configuredResponsibilities = matchingHint?.responsibilities ?? [];
  return {
    packageRoot: report.reasoningTree.projectRoot,
    ownerPath: moduleReport.path,
    hintPath: compactPath(report, moduleReport.path),
    ownerNamespace: branch?.ownerNamespace ?? ownerNamespace(report, moduleReport),
    state: profileCandidateState(matchingHint, responsibilities),
    suggestedResponsibilities: responsibilities,
    configuredResponsibilities: [...configuredResponsibilities].sort(),
    suggestedTaskKinds: taskKindsForResponsibilities(responsibilities, policy),
    evidence: profileEvidence(moduleReport, signals),
  };
}

function isProfileCandidateModule(moduleReport: TypeScriptReasoningModule): boolean {
  return (
    moduleReport.role === "entrypoint" ||
    moduleReport.role === "facade" ||
    moduleReport.role === "source" ||
    moduleReport.role === "config"
  );
}

function suggestedResponsibilities(
  moduleReport: TypeScriptReasoningModule,
  signals: ProfileSignals,
): readonly TypeScriptOwnerResponsibility[] {
  return [
    isPublicSurface(moduleReport, signals) ? "public_api" : undefined,
    signals.externalImports > 0 || signals.packageImportImports > 0 || signals.ownerDeps >= 3
      ? "external_dependency"
      : undefined,
    ...signals.signalResponsibilities,
  ]
    .filter(
      (responsibility): responsibility is TypeScriptOwnerResponsibility =>
        responsibility !== undefined,
    )
    .sort();
}

function isPublicSurface(
  moduleReport: TypeScriptReasoningModule,
  signals: ProfileSignals,
): boolean {
  return (
    moduleReport.role === "entrypoint" ||
    moduleReport.role === "facade" ||
    moduleReport.exportNames.length > 0 ||
    signals.packageEntries.length > 0
  );
}

function profileSignals(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
  moduleReport: TypeScriptReasoningModule,
  branch: TypeScriptReasoningOwnerBranchFact | undefined,
): ProfileSignals {
  const ownerPaths = ownerModulePaths(report, moduleReport, branch);
  const ownerPathSet = new Set(ownerPaths);
  const ownerDeps = report.reasoningTree.ownerDependencies.filter(
    (dependency) => ownerPathSet.has(dependency.fromPath) && !dependency.isTestContext,
  ).length;
  const packageEntries = report.reasoningTree.packageEntryResolutions
    .filter(
      (entry) =>
        entry.resolution === "parser-visible" &&
        entry.toPath !== undefined &&
        ownerPathSet.has(entry.toPath),
    )
    .map((entry) => `${entry.kind}:${entry.subpath}`);
  const edges = report.reasoningTree.edges.filter((edge) => ownerPathSet.has(edge.fromPath));
  const externalRoots = uniqueSortedStrings(
    edges
      .filter((edge) => edge.resolution === "external")
      .map((edge) => dependencyRoot(edge.moduleSpecifier)),
  );
  const packageImportRoots = uniqueSortedStrings(
    edges
      .filter((edge) => edge.resolution === "package-import")
      .map((edge) => packageImportRoot(edge.moduleSpecifier)),
  );
  const ownerImportRoots = uniqueSortedStrings(
    report.reasoningTree.packageImportOwners
      .filter((owner) => ownerPathSet.has(owner.fromPath))
      .flatMap((owner) => [
        dependencyRoot(owner.moduleSpecifier),
        owner.packageName,
        owner.packageName.replace(/^@types\//u, ""),
      ]),
  );
  const dependencyRoots = uniqueSortedStrings([
    ...externalRoots,
    ...packageImportRoots,
    ...ownerImportRoots,
  ]);
  const configuredDependencyRoots = dependencyRoots.filter(
    (dependency) => matchingDependencySignals(policy, dependency).length > 0,
  );
  const unconfiguredDependencyRoots = dependencyRoots.filter(
    (dependency) => matchingDependencySignals(policy, dependency).length === 0,
  );
  const signalResponsibilities = uniqueSortedResponsibilities(
    dependencyRoots.flatMap((dependency) =>
      matchingDependencySignals(policy, dependency).flatMap((signal) => signal.responsibilities),
    ),
  );
  return {
    ownerModules: ownerPaths.length,
    childModules: uniqueSortedStrings(branch?.childEdges.flatMap(ownerPath) ?? []).length,
    externalImports: countEdges(edges, "external"),
    packageImportImports: countEdges(edges, "package-import"),
    unresolvedImports: countEdges(edges, "unresolved"),
    ownerDeps,
    dependencyRoots,
    configuredDependencyRoots,
    unconfiguredDependencyRoots,
    externalRoots,
    packageImportRoots,
    signalResponsibilities,
    packageEntries: [...new Set(packageEntries)].sort(),
  };
}

function profileEvidence(
  moduleReport: TypeScriptReasoningModule,
  signals: ProfileSignals,
): readonly TypeScriptVerificationEvidence[] {
  const evidence: TypeScriptVerificationEvidence[] = [
    { label: "module", value: `role=${moduleReport.role} layer=${moduleReport.layer}` },
    { label: "exports", value: String(moduleReport.exportNames.length) },
    {
      label: "imports",
      value: `external=${signals.externalImports} package_import=${signals.packageImportImports} unresolved=${signals.unresolvedImports}`,
    },
    { label: "owner_deps", value: String(signals.ownerDeps) },
  ];
  pushCountEvidence(evidence, "owner_modules", signals.ownerModules, 1);
  pushCountEvidence(evidence, "child_modules", signals.childModules, 0);
  pushListEvidence(evidence, "external_roots", signals.externalRoots);
  pushListEvidence(evidence, "package_import_roots", signals.packageImportRoots);
  pushListEvidence(evidence, "dependency_roots", signals.dependencyRoots);
  pushListEvidence(evidence, "configured_dependency_roots", signals.configuredDependencyRoots);
  pushListEvidence(evidence, "unconfigured_dependency_roots", signals.unconfiguredDependencyRoots);
  pushListEvidence(evidence, "dependency_responsibilities", signals.signalResponsibilities);
  if (signals.packageEntries.length > 0) {
    evidence.push({ label: "package_entries", value: signals.packageEntries.join(",") });
  }
  return evidence;
}

function pushCountEvidence(
  evidence: TypeScriptVerificationEvidence[],
  label: string,
  value: number,
  floor: number,
): void {
  if (value > floor) {
    evidence.push({ label, value: String(value) });
  }
}

function pushListEvidence(
  evidence: TypeScriptVerificationEvidence[],
  label: string,
  values: readonly string[],
): void {
  if (values.length > 0) {
    evidence.push({ label, value: values.join(",") });
  }
}

function profileCandidateState(
  matchingHint: TypeScriptVerificationProfileHint | undefined,
  responsibilities: readonly TypeScriptOwnerResponsibility[],
): TypeScriptVerificationProfileCandidateState {
  if (matchingHint === undefined) {
    return "missing_profile";
  }
  const configured = new Set(matchingHint.responsibilities);
  return responsibilities.every((responsibility) => configured.has(responsibility))
    ? "configured"
    : "profile_drift";
}

function matchingProfileHint(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
  ownerPath: string,
): TypeScriptVerificationProfileHint | undefined {
  return policy.profileHints.find(
    (hint) => normalizeHintOwnerPath(report, hint.ownerPath) === ownerPath,
  );
}

function ownerBranchForModule(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
): TypeScriptReasoningOwnerBranchFact | undefined {
  return report.reasoningTree.ownerBranches.find((branch) => branch.path === moduleReport.path);
}

function countEdges(
  edges: readonly TypeScriptImportEdgeFact[],
  resolution: AspTypeScriptReport["reasoningTree"]["edges"][number]["resolution"],
): number {
  return edges.filter((edge) => edge.resolution === resolution).length;
}

function ownerModulePaths(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
  branch: TypeScriptReasoningOwnerBranchFact | undefined,
): readonly string[] {
  const modulePaths = new Set<string>([moduleReport.path]);
  for (const childPath of branch?.childEdges.flatMap(ownerPath) ?? []) {
    modulePaths.add(childPath);
  }
  return [...modulePaths].sort((left, right) => left.localeCompare(right));
}

function ownerPath(edge: TypeScriptImportEdgeFact): readonly string[] {
  return edge.toPath === undefined ? [] : [edge.toPath];
}

function dependencyRoot(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope !== undefined && name !== undefined ? `${scope}/${name}` : specifier;
  }
  if (specifier.startsWith("node:")) {
    return specifier;
  }
  const [root] = specifier.split("/");
  return root ?? specifier;
}

function packageImportRoot(specifier: string): string {
  const [root] = specifier.split("/");
  return root ?? specifier;
}

function matchingDependencySignals(
  policy: TypeScriptVerificationPolicy,
  dependency: string,
): TypeScriptVerificationPolicy["dependencySignals"] {
  return policy.dependencySignals.filter((signal) => signal.dependency === dependency);
}

function uniqueSortedResponsibilities(
  responsibilities: readonly TypeScriptOwnerResponsibility[],
): readonly TypeScriptOwnerResponsibility[] {
  return [...new Set(responsibilities)].sort();
}

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeHintOwnerPath(report: AspTypeScriptReport, ownerPath: string): string {
  return path.isAbsolute(ownerPath)
    ? path.resolve(ownerPath)
    : path.resolve(report.reasoningTree.projectRoot, ownerPath);
}

function ownerNamespace(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
): string {
  const relativePath = compactPath(report, moduleReport.path);
  const extension = path.extname(relativePath);
  return extension.length === 0 ? relativePath : relativePath.slice(0, -extension.length);
}

function compactPath(report: AspTypeScriptReport, value: string): string {
  return path.relative(report.reasoningTree.projectRoot, value).replaceAll("\\", "/") || ".";
}
