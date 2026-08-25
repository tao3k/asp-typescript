/**
 * Project parser implementation for TypeScript harness runs.
 *
 * This module coordinates project scope discovery, TypeScript compiler inputs,
 * source parsing, and native parser fact assembly.
 */
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import type {
  TypeScriptHarnessConfig,
  TypeScriptModuleReport,
  TypeScriptProjectHarnessScope,
} from "../model.js";
import { readTypeScriptConfigFacts, readTypeScriptProgramInputs } from "./config.js";
import {
  DEFAULT_IGNORED_DIR_NAMES,
  discoverTypeScriptFiles,
  existingChildPaths,
  isTypeScriptSourcePath,
  packageProjectRoot,
  pathFromInput,
} from "./files.js";
import { readPackageJsonFacts } from "./package_json.js";
import { resolveNativeImportFact } from "./resolution.js";
import {
  collectImportFacts,
  moduleReportFromSourceFile,
  parseTypeScriptSourceFile,
} from "./source_file.js";
import { nativeDiagnosticFromTsDiagnostic } from "./diagnostics.js";

export {
  DEFAULT_IGNORED_DIR_NAMES,
  discoverTypeScriptFiles,
  isTypeScriptSourcePath,
  parseTypeScriptSourceFile,
  pathFromInput,
};

export function readProjectResolution(
  projectRootInput: string | URL,
  config: Pick<
    TypeScriptHarnessConfig,
    "ignoredDirNames" | "includeHiddenDirNames" | "includeTests" | "sourceDirNames" | "testDirNames"
  >,
): TypeScriptProjectHarnessScope {
  const projectRoot = packageProjectRoot(pathFromInput(projectRootInput));
  const configFacts = readTypeScriptConfigFacts(projectRoot);
  const packageJson = readPackageJsonFacts(projectRoot);

  const rootSourcePaths = existingChildPaths(projectRoot, config.sourceDirNames);
  const rootTestPaths = config.includeTests
    ? existingChildPaths(projectRoot, config.testDirNames)
    : [];

  // Discover workspace package source/test dirs
  const workspaceSourcePaths = workspaceChildPaths(
    projectRoot,
    packageJson.workspacePackages,
    config.sourceDirNames,
  );
  const workspaceTestPaths = config.includeTests
    ? workspaceChildPaths(projectRoot, packageJson.workspacePackages, config.testDirNames)
    : [];

  return {
    projectRoot,
    sourcePaths: dedupeSorted([...rootSourcePaths, ...workspaceSourcePaths]),
    testPaths: dedupeSorted([...rootTestPaths, ...workspaceTestPaths]),
    config: configFacts,
    packageJson,
  };
}

/** For each workspace package, find existing child dirs matching the given names. */
function workspaceChildPaths(
  projectRoot: string,
  workspacePackages: readonly { readonly path: string }[],
  dirNames: readonly string[],
): string[] {
  const dirs: string[] = [];
  for (const wp of workspacePackages) {
    if (wp.path === projectRoot) continue;
    for (const name of dirNames) {
      const candidate = path.join(wp.path, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        dirs.push(candidate);
      }
    }
  }
  return dirs;
}

function dedupeSorted(items: string[]): string[] {
  return [...new Set(items)].sort();
}

export function projectFileNames(
  scope: TypeScriptProjectHarnessScope,
  config: Pick<TypeScriptHarnessConfig, "ignoredDirNames" | "includeHiddenDirNames">,
): string[] {
  if (scope.config.fileNames.length > 0) {
    return [...scope.config.fileNames].sort();
  }
  const fallbackRoots =
    scope.sourcePaths.length > 0 || scope.testPaths.length > 0
      ? [...scope.sourcePaths, ...scope.testPaths]
      : [scope.projectRoot];
  return discoverTypeScriptFiles(
    fallbackRoots,
    config.ignoredDirNames,
    config.includeHiddenDirNames,
  );
}

export function parseTypeScriptProjectFiles(
  scope: TypeScriptProjectHarnessScope,
  fileNames: readonly string[],
  options: {
    readonly collectSemanticDiagnostics?: boolean;
    readonly collectNativeSyntaxFacts?: boolean;
    readonly useCompilerProgram?: boolean;
  } = {},
): TypeScriptModuleReport[] {
  const programInputs = readTypeScriptProgramInputs(scope);
  const collectSemanticDiagnostics = options.collectSemanticDiagnostics ?? true;
  const useCompilerProgram = options.useCompilerProgram ?? collectSemanticDiagnostics;
  const rootNames = [...fileNames].map((fileName) => path.resolve(fileName)).sort();
  if (!useCompilerProgram) {
    return parseStandaloneProjectFiles(scope, rootNames, programInputs.options, options);
  }
  const host = ts.createCompilerHost(programInputs.options, true);
  const createProgramOptions: ts.CreateProgramOptions = {
    rootNames,
    options: programInputs.options,
    host,
  };
  let program: ts.Program;
  try {
    program = ts.createProgram(
      programInputs.projectReferences === undefined
        ? createProgramOptions
        : { ...createProgramOptions, projectReferences: programInputs.projectReferences },
    );
  } catch {
    return parseStandaloneProjectFiles(scope, rootNames, programInputs.options, options);
  }
  const resolutionCache = ts.createModuleResolutionCache(
    scope.projectRoot,
    (fileName) => fileName,
    programInputs.options,
  );
  return rootNames.map((fileName) => {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile === undefined) {
      // Monorepo workspace file: not in the root program. Parse standalone + resolve imports per-file.
      const standalone = parseTypeScriptSourceFile(fileName, options);
      if (standalone.imports.length === 0) return standalone;
      const resolutions = standalone.imports.map((importFact) =>
        resolveNativeImportFact(
          scope,
          fileName,
          importFact,
          programInputs.options,
          resolutionCache,
        ),
      );
      return { ...standalone, importResolutions: resolutions };
    }
    const semanticDiagnostics = collectSemanticDiagnostics
      ? program
          .getSemanticDiagnostics(sourceFile)
          .map((diagnostic) =>
            nativeDiagnosticFromTsDiagnostic(diagnostic, fileName, sourceFile.text),
          )
      : [];
    const imports = collectImportFacts(sourceFile);
    return moduleReportFromSourceFile(
      sourceFile,
      program
        .getSyntacticDiagnostics(sourceFile)
        .map((diagnostic) =>
          nativeDiagnosticFromTsDiagnostic(diagnostic, fileName, sourceFile.text),
        ),
      semanticDiagnostics,
      imports.map((importFact) =>
        resolveNativeImportFact(
          scope,
          sourceFile.fileName,
          importFact,
          programInputs.options,
          resolutionCache,
        ),
      ),
      imports,
      options,
    );
  });
}

function parseStandaloneProjectFiles(
  scope: TypeScriptProjectHarnessScope,
  rootNames: readonly string[],
  compilerOptions: ts.CompilerOptions,
  options: { readonly collectNativeSyntaxFacts?: boolean },
): TypeScriptModuleReport[] {
  const resolutionCache = ts.createModuleResolutionCache(
    scope.projectRoot,
    (fileName) => fileName,
    compilerOptions,
  );
  return rootNames.map((fileName) =>
    parseStandaloneProjectFile(scope, fileName, compilerOptions, resolutionCache, options),
  );
}

function parseStandaloneProjectFile(
  scope: TypeScriptProjectHarnessScope,
  fileName: string,
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
  options: { readonly collectNativeSyntaxFacts?: boolean },
): TypeScriptModuleReport {
  const standalone = parseTypeScriptSourceFile(fileName, options);
  if (standalone.imports.length === 0) return standalone;
  const resolutions = standalone.imports.map((importFact) =>
    resolveNativeImportFact(scope, fileName, importFact, compilerOptions, resolutionCache),
  );
  return { ...standalone, importResolutions: resolutions };
}
