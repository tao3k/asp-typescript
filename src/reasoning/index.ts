import type {
  TypeScriptModuleReport,
  AspTypeScriptProjectScope,
  TypeScriptReasoningTree,
} from "../model.js";
import { moduleDiagnostics, reasoningDiagnostics } from "./diagnostics.js";
import { importEdges } from "./import_edges.js";
import {
  explicitReasoningModules,
  packageEntrypointOwnerPaths,
  reasoningModules,
} from "./modules.js";
import { ownerBranches, ownerDependencies } from "./owner_facts.js";
import {
  resolvePackageImportOwners,
  resolvePackageEntries,
  resolveProjectReferences,
} from "./package_facts.js";
import { commonAncestor } from "./path_utils.js";
import { orphanedSourceFiles, shadowedSourceOwners } from "./source_shape.js";

export function buildTypeScriptReasoningTree(
  scope: AspTypeScriptProjectScope,
  modules: readonly TypeScriptModuleReport[],
): TypeScriptReasoningTree {
  const modulePaths = new Set(modules.map((moduleReport) => moduleReport.path));
  const packageEntryResolutions = resolvePackageEntries(scope, modulePaths);
  const entrypointOwnerPaths = packageEntrypointOwnerPaths(
    scope,
    packageEntryResolutions,
    modulePaths,
  );
  const reasoningModuleFacts = reasoningModules(scope, modules, entrypointOwnerPaths);
  const edges = modules
    .flatMap((moduleReport) => importEdges(moduleReport, modulePaths))
    .sort((left, right) =>
      `${left.fromPath}:${left.moduleSpecifier}`.localeCompare(
        `${right.fromPath}:${right.moduleSpecifier}`,
      ),
    );
  const ownerDependencyFacts = ownerDependencies(reasoningModuleFacts, edges);
  const tree: TypeScriptReasoningTree = {
    runMode: "project",
    projectRoot: scope.projectRoot,
    compilerOptions: scope.config.compilerOptions,
    projectReferences: scope.config.projectReferences,
    projectReferenceResolutions: resolveProjectReferences(scope),
    sourceRoots: scope.sourcePaths,
    testRoots: scope.testPaths,
    pathAliases: scope.config.pathAliases,
    packageEntrypoints: scope.packageJson.entrypoints,
    packageExports: scope.packageJson.exports,
    packageImports: scope.packageJson.imports,
    packageBins: scope.packageJson.bins,
    packageDependencies: scope.packageJson.dependencies,
    packageScripts: scope.packageJson.scripts,
    packageWorkspaces: scope.packageJson.workspaces,
    packageExtensions: scope.packageJson.packageExtensions,
    packageBuildTools: scope.packageJson.packageBuildTools,
    workspacePackages: scope.packageJson.workspacePackages,
    workspacePatterns: scope.packageJson.workspacePatterns,
    projectReferencePackages: scope.config.projectReferencePackages,
    packageImportOwners: resolvePackageImportOwners(scope, modules),
    packageEntryResolutions,
    diagnostics: reasoningDiagnostics(scope, modules),
    modules: reasoningModuleFacts,
    ownerBranches: ownerBranches(scope.projectRoot, reasoningModuleFacts, edges),
    ownerDependencies: ownerDependencyFacts,
    shadowedSourceOwners: shadowedSourceOwners(
      scope.projectRoot,
      reasoningModuleFacts,
      ownerDependencyFacts,
    ),
    orphanedSourceFiles: orphanedSourceFiles(
      reasoningModuleFacts,
      ownerDependencyFacts,
      packageEntryResolutions,
    ),
    edges,
  };
  return withOptionalProjectFacts(tree, scope);
}

export function buildExplicitTypeScriptReasoningTree(
  rootPaths: readonly string[],
  modules: readonly TypeScriptModuleReport[],
): TypeScriptReasoningTree {
  const projectRoot = commonAncestor([
    ...rootPaths,
    ...modules.map((moduleReport) => moduleReport.path),
  ]);
  const reasoningModuleFacts = explicitReasoningModules(projectRoot, modules);
  return {
    runMode: "explicit",
    projectRoot,
    compilerOptions: emptyCompilerOptionFacts(),
    projectReferences: [],
    projectReferenceResolutions: [],
    sourceRoots: [],
    testRoots: [],
    pathAliases: [],
    packageEntrypoints: [],
    packageExports: [],
    packageImports: [],
    packageBins: [],
    packageDependencies: [],
    packageScripts: [],
    packageWorkspaces: [],
    packageExtensions: [],
    packageBuildTools: [],
    workspacePackages: [],
    workspacePatterns: [],
    projectReferencePackages: [],
    packageImportOwners: [],
    packageEntryResolutions: [],
    diagnostics: moduleDiagnostics(modules),
    modules: reasoningModuleFacts,
    ownerBranches: ownerBranches(projectRoot, reasoningModuleFacts, []),
    ownerDependencies: [],
    shadowedSourceOwners: shadowedSourceOwners(projectRoot, reasoningModuleFacts, []),
    orphanedSourceFiles: [],
    edges: [],
  };
}

function withOptionalProjectFacts(
  tree: TypeScriptReasoningTree,
  scope: AspTypeScriptProjectScope,
): TypeScriptReasoningTree {
  const withPackageName =
    scope.packageJson.name === undefined ? tree : { ...tree, packageName: scope.packageJson.name };
  return scope.config.configPath === undefined
    ? withPackageName
    : { ...withPackageName, configPath: scope.config.configPath };
}

function emptyCompilerOptionFacts(): TypeScriptReasoningTree["compilerOptions"] {
  return {
    rootDirs: [],
    allowJs: false,
    checkJs: false,
    noEmit: false,
    composite: false,
    declaration: false,
    emitDeclarationOnly: false,
    declarationMap: false,
    sourceMap: false,
  };
}
