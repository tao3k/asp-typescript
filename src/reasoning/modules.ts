import path from "node:path";

import type {
  TypeScriptModuleLayer,
  TypeScriptModuleReport,
  TypeScriptModuleRole,
  TypeScriptPackageEntryResolutionFact,
  AspTypeScriptProjectScope,
  TypeScriptReasoningModule,
} from "../model.js";
import { CONFIG_FILE_STEMS, MODULE_FILE_EXTENSIONS } from "./constants.js";
import { isInsideAny, relativeProjectPath } from "./path_utils.js";

export function reasoningModules(
  scope: AspTypeScriptProjectScope,
  modules: readonly TypeScriptModuleReport[],
  entrypointOwnerPaths: ReadonlySet<string>,
): TypeScriptReasoningModule[] {
  const entrypointOwnerRoots = packageEntrypointOwnerRoots(scope.projectRoot, entrypointOwnerPaths);
  return modules
    .map((moduleReport) =>
      reasoningModuleFromRole(
        scope.projectRoot,
        moduleReport,
        moduleRole(scope, moduleReport, entrypointOwnerPaths, entrypointOwnerRoots),
      ),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function explicitReasoningModules(
  projectRoot: string,
  modules: readonly TypeScriptModuleReport[],
): TypeScriptReasoningModule[] {
  return modules
    .map((moduleReport) =>
      reasoningModuleFromRole(projectRoot, moduleReport, explicitModuleRole(moduleReport)),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function packageBinOwnerPaths(
  packageEntryResolutions: readonly TypeScriptPackageEntryResolutionFact[],
): ReadonlySet<string> {
  return new Set(
    packageEntryResolutions.flatMap((entry) =>
      entry.kind === "bin" && entry.toPath !== undefined ? [entry.toPath] : [],
    ),
  );
}

export function packageEntrypointOwnerPaths(
  scope: AspTypeScriptProjectScope,
  packageEntryResolutions: readonly TypeScriptPackageEntryResolutionFact[],
  modulePaths: ReadonlySet<string>,
): ReadonlySet<string> {
  const ownerPaths = new Set(packageBinOwnerPaths(packageEntryResolutions));
  for (const script of scope.packageJson.scripts) {
    for (const target of packageScriptEntrypointTargets(script.command)) {
      const resolved = resolveProjectModuleTarget(scope, target, modulePaths);
      if (resolved !== undefined) {
        ownerPaths.add(resolved);
      }
    }
  }
  return ownerPaths;
}

function reasoningModuleFromRole(
  projectRoot: string,
  moduleReport: TypeScriptModuleReport,
  role: TypeScriptModuleRole,
): TypeScriptReasoningModule {
  return {
    path: moduleReport.path,
    role,
    layer: moduleLayer(projectRoot, moduleReport.path, role),
    isValid: moduleReport.isValid,
    hasIntentDoc: moduleReport.hasIntentDoc,
    lineCount: moduleReport.lineCount,
    syntaxDiagnosticCount: moduleReport.diagnostics.length,
    semanticDiagnosticCount: moduleReport.semanticDiagnostics.length,
    exportNames: moduleReport.exports.map((exportFact) => exportFact.name).sort(),
    typeOnlyExportNames: moduleReport.exports
      .filter((exportFact) => exportFact.isTypeOnly)
      .map((exportFact) => exportFact.name)
      .sort(),
    importSpecifiers: moduleReport.imports.map((importFact) => importFact.moduleSpecifier).sort(),
    publicFunctionParams: moduleReport.publicFunctionParams,
    publicTupleApiSurfaces: moduleReport.publicTupleApiSurfaces,
    publicDataFields: moduleReport.publicDataFields,
    publicTypeAliases: moduleReport.publicTypeAliases,
    publicDiscriminatedUnionVariantFields: moduleReport.publicDiscriminatedUnionVariantFields,
    publicFunctionControlFlows: moduleReport.publicFunctionControlFlows,
    publicReturnObjectShapes: moduleReport.publicReturnObjectShapes,
    moduleResponsibilities: moduleReport.moduleResponsibilities,
    publicAsyncEffectSurfaces: moduleReport.publicAsyncEffectSurfaces,
    effectRuntimeCalls: moduleReport.effectRuntimeCalls,
    effectPromiseInteropRisks: moduleReport.effectPromiseInteropRisks,
    effectResourceScopeRisks: moduleReport.effectResourceScopeRisks,
    effectConcurrencySignals: moduleReport.effectConcurrencySignals,
    effectSchemaBoundarySignals: moduleReport.effectSchemaBoundarySignals,
    effectProductionBoundarySignals: moduleReport.effectProductionBoundarySignals,
    effectServiceMethods: moduleReport.effectServiceMethods,
    reactRenderPuritySignals: moduleReport.reactRenderPuritySignals,
    reactHookCallSignals: moduleReport.reactHookCallSignals,
    reactStaticDefinitionSignals: moduleReport.reactStaticDefinitionSignals,
  };
}

function moduleLayer(
  projectRoot: string,
  modulePath: string,
  role: TypeScriptModuleRole,
): TypeScriptModuleLayer {
  const relativePath = relativeProjectPath(projectRoot, modulePath);
  if (role === "test") {
    return "test";
  }
  if (role === "config") {
    return "config";
  }
  if (relativePath === "src/parser.ts" || relativePath.startsWith("src/parser/")) {
    return "parser";
  }
  if (relativePath === "src/reasoning.ts" || relativePath.startsWith("src/reasoning/")) {
    return "reasoning";
  }
  if (relativePath === "src/rules.ts" || relativePath.startsWith("src/rules/")) {
    return "policy";
  }
  if (relativePath === "src/render.ts") {
    return "render";
  }
  if (
    relativePath === "src/model.ts" ||
    relativePath.startsWith("src/model/") ||
    (relativePath.startsWith("src/") && path.basename(relativePath) === "model.ts")
  ) {
    return "model";
  }
  if (relativePath.startsWith("src/")) {
    return "asp";
  }
  return "unknown";
}

function moduleRole(
  scope: AspTypeScriptProjectScope,
  moduleReport: TypeScriptModuleReport,
  entrypointOwnerPaths: ReadonlySet<string>,
  entrypointOwnerRoots: readonly string[],
): TypeScriptModuleRole {
  if (moduleReport.isDeclarationFile) {
    return "declaration";
  }
  const filePath = moduleReport.path;
  const fileName = path.basename(filePath);
  if (isInsideAny(filePath, scope.testPaths) || isTestFileName(fileName)) {
    return "test";
  }
  if (isConfigFileName(fileName)) {
    return "config";
  }
  if (
    isEntryPointPath(filePath) ||
    isRuntimeAdapterEntrypoint(moduleReport) ||
    entrypointOwnerPaths.has(filePath) ||
    isDirectChildOfAny(filePath, entrypointOwnerRoots)
  ) {
    return "entrypoint";
  }
  if (isFacadePath(scope, filePath)) {
    return "facade";
  }
  if (isInsideAny(filePath, scope.sourcePaths)) {
    return "source";
  }
  // Fallback: if the file is in tsconfig's fileNames or under a project reference, it's source
  if (isInsideAny(filePath, scope.config.fileNames)) {
    return "source";
  }
  if (isInsideProjectReference(scope.config.projectReferences, filePath)) {
    return "source";
  }
  return "unknown";
}

function explicitModuleRole(moduleReport: TypeScriptModuleReport): TypeScriptModuleRole {
  if (moduleReport.isDeclarationFile) {
    return "declaration";
  }
  const filePath = moduleReport.path;
  const fileName = path.basename(filePath);
  if (isTestFileName(fileName)) {
    return "test";
  }
  if (isConfigFileName(fileName)) {
    return "config";
  }
  if (isEntryPointPath(filePath) || isRuntimeAdapterEntrypoint(moduleReport)) {
    return "entrypoint";
  }
  if (moduleFileNames("index").includes(fileName)) {
    return "facade";
  }
  return moduleReport.scriptKind === "unknown" ? "unknown" : "source";
}

function isEntryPointPath(filePath: string): boolean {
  const fileName = path.basename(filePath);
  if (moduleFileNames("main").includes(fileName)) {
    return true;
  }
  return path.basename(path.dirname(filePath)) === "bin";
}

function isRuntimeAdapterEntrypoint(moduleReport: TypeScriptModuleReport): boolean {
  return (
    moduleReport.imports.some((importFact) =>
      isRuntimeAdapterImportSpecifier(importFact.moduleSpecifier),
    ) && moduleReport.exports.some((exportFact) => isRuntimeAdapterExportName(exportFact.name))
  );
}

function isRuntimeAdapterImportSpecifier(moduleSpecifier: string): boolean {
  return (
    moduleSpecifier === "node:http" ||
    moduleSpecifier === "node:https" ||
    moduleSpecifier === "http" ||
    moduleSpecifier === "https" ||
    moduleSpecifier === "express" ||
    moduleSpecifier === "fastify" ||
    moduleSpecifier === "hono" ||
    moduleSpecifier === "@hono/node-server"
  );
}

function isRuntimeAdapterExportName(exportName: string): boolean {
  const normalized = exportName.toLowerCase();
  return (
    normalized.includes("middleware") ||
    normalized.endsWith("handler") ||
    normalized.endsWith("server") ||
    normalized.includes("route") ||
    normalized.includes("api")
  );
}

function packageEntrypointOwnerRoots(
  projectRoot: string,
  entrypointOwnerPaths: ReadonlySet<string>,
): string[] {
  const roots = new Set<string>();
  for (const ownerPath of entrypointOwnerPaths) {
    const relativePath = relativeProjectPath(projectRoot, ownerPath);
    const parts = relativePath.split("/");
    if (parts[0] === "src" && parts[1] === "bin") {
      roots.add(path.join(projectRoot, "src", "bin"));
    }
    if (parts[0] === "src" && parts[1] === "cli" && parts.length === 3) {
      roots.add(path.join(projectRoot, "src", "cli"));
    }
    if (path.basename(path.dirname(ownerPath)) === "bin") {
      roots.add(path.dirname(ownerPath));
    }
  }
  return [...roots].sort();
}

function isDirectChildOfAny(filePath: string, directories: readonly string[]): boolean {
  return directories.some((directory) => {
    const relativePath = path.relative(directory, filePath);
    return (
      relativePath.length > 0 &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath) &&
      !relativePath.includes(path.sep)
    );
  });
}

function packageScriptEntrypointTargets(command: string): string[] {
  return commandTokens(command).filter(isScriptEntrypointTarget);
}

function commandTokens(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  for (const char of command) {
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === " " || char === "\t" || char === "\n") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function isScriptEntrypointTarget(token: string): boolean {
  if (token.startsWith("-") || token.includes("=") || token.includes("$")) {
    return false;
  }
  return MODULE_FILE_EXTENSIONS.some((extension) => token.endsWith(extension));
}

function resolveProjectModuleTarget(
  scope: AspTypeScriptProjectScope,
  target: string,
  modulePaths: ReadonlySet<string>,
): string | undefined {
  const direct = resolveCandidatePath(path.resolve(scope.projectRoot, target), modulePaths);
  if (direct !== undefined) {
    return direct;
  }
  const outDir = scope.config.compilerOptions.outDir;
  if (outDir === undefined) {
    return undefined;
  }
  const outputPath = path.resolve(scope.projectRoot, target);
  const relativeOutput = path.relative(outDir, outputPath);
  if (relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
    return undefined;
  }
  const sourceBase = scope.config.compilerOptions.rootDir ?? scope.projectRoot;
  return resolveCandidatePath(path.resolve(sourceBase, relativeOutput), modulePaths);
}

function resolveCandidatePath(
  candidatePath: string,
  modulePaths: ReadonlySet<string>,
): string | undefined {
  if (modulePaths.has(candidatePath)) {
    return candidatePath;
  }
  const extensionStart = candidatePath.length - path.extname(candidatePath).length;
  const candidateStem =
    extensionStart === candidatePath.length
      ? candidatePath
      : candidatePath.slice(0, extensionStart);
  for (const extension of MODULE_FILE_EXTENSIONS) {
    const withoutExtension = `${candidateStem}${extension}`;
    if (modulePaths.has(withoutExtension)) {
      return withoutExtension;
    }
  }
  return undefined;
}

function isFacadePath(scope: AspTypeScriptProjectScope, filePath: string): boolean {
  const fileName = path.basename(filePath);
  if (!moduleFileNames("index").includes(fileName)) return false;
  if (isInsideAny(filePath, scope.sourcePaths)) return true;
  // Fallback: for monorepo workspace packages using project references
  if (isInsideProjectReference(scope.config.projectReferences, filePath)) return true;
  return false;
}

function isTestFileName(fileName: string): boolean {
  return MODULE_FILE_EXTENSIONS.some(
    (extension) => fileName.endsWith(`.test${extension}`) || fileName.endsWith(`.spec${extension}`),
  );
}

function isConfigFileName(fileName: string): boolean {
  return CONFIG_FILE_STEMS.some((stem) => moduleFileNames(stem).includes(fileName));
}

/** Check if a file path is a child of any project reference directory. */
function isInsideProjectReference(projectReferences: readonly string[], filePath: string): boolean {
  for (const ref of projectReferences) {
    if (filePath.startsWith(ref + path.sep)) return true;
  }
  return false;
}

function moduleFileNames(stem: string): readonly string[] {
  return MODULE_FILE_EXTENSIONS.map((extension) => `${stem}${extension}`);
}
