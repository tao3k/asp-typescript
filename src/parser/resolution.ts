import path from "node:path";

import ts from "typescript";

import type {
  TypeScriptImportFact,
  TypeScriptNativeImportResolutionFact,
  AspTypeScriptProjectScope,
} from "../model.js";

export function resolveNativeImportFact(
  scope: AspTypeScriptProjectScope,
  containingFile: string,
  importFact: TypeScriptImportFact,
  compilerOptions: ts.CompilerOptions,
  resolutionCache: ts.ModuleResolutionCache,
): TypeScriptNativeImportResolutionFact {
  const resolvedModule = ts.resolveModuleName(
    importFact.moduleSpecifier,
    containingFile,
    compilerOptions,
    ts.sys,
    resolutionCache,
  ).resolvedModule;
  const resolvedPath =
    resolvedModule === undefined ? undefined : path.resolve(resolvedModule.resolvedFileName);
  const resolution = classifyNativeImportResolution(
    scope,
    importFact.moduleSpecifier,
    resolvedModule,
  );
  const fact: TypeScriptNativeImportResolutionFact = {
    moduleSpecifier: importFact.moduleSpecifier,
    kind: importFact.kind,
    isTypeOnly: importFact.isTypeOnly,
    location: importFact.location,
    resolution,
  };
  if (resolvedPath !== undefined && resolution !== "external") {
    return { ...fact, resolvedPath };
  }
  return fact;
}

function classifyNativeImportResolution(
  scope: AspTypeScriptProjectScope,
  moduleSpecifier: string,
  resolvedModule: ts.ResolvedModuleFull | undefined,
): TypeScriptNativeImportResolutionFact["resolution"] {
  if (resolvedModule === undefined) {
    if (
      moduleSpecifier.startsWith(".") ||
      moduleSpecifier.startsWith("#") ||
      matchesPathAlias(scope, moduleSpecifier)
    ) {
      return "unresolved";
    }
    return "external";
  }
  const resolvedPath = path.resolve(resolvedModule.resolvedFileName);
  if (resolvedModule.isExternalLibraryImport === true || isInsideNodeModules(resolvedPath)) {
    return "external";
  }
  if (moduleSpecifier.startsWith(".")) {
    return "relative";
  }
  if (moduleSpecifier.startsWith("#")) {
    return "package-import";
  }
  if (isInsideProject(scope.projectRoot, resolvedPath)) {
    return matchesPathAlias(scope, moduleSpecifier) ? "path-alias" : "package-import";
  }
  return "external";
}

function matchesPathAlias(scope: AspTypeScriptProjectScope, moduleSpecifier: string): boolean {
  return scope.config.pathAliases.some((alias) => {
    const wildcard = alias.pattern.indexOf("*");
    if (wildcard === -1) {
      return moduleSpecifier === alias.pattern;
    }
    return (
      moduleSpecifier.startsWith(alias.pattern.slice(0, wildcard)) &&
      moduleSpecifier.endsWith(alias.pattern.slice(wildcard + 1))
    );
  });
}

function isInsideProject(projectRoot: string, filePath: string): boolean {
  const relativePath = path.relative(projectRoot, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function isInsideNodeModules(filePath: string): boolean {
  return filePath.split(path.sep).includes("node_modules");
}
