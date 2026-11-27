import path from "node:path";

import type {
  PackageJsonEntryFact,
  TypeScriptImportFact,
  TypeScriptModuleReport,
  TypeScriptPackageImportOwnerFact,
  TypeScriptPackageEntryResolutionFact,
  AspTypeScriptProjectScope,
  TypeScriptProjectReferencePackageFact,
  TypeScriptProjectReferenceResolutionFact,
  TypeScriptWorkspacePackageFact,
} from "../model.js";
import { resolveCandidatePath } from "./candidate_paths.js";
import { samePath } from "./path_utils.js";

export function resolveProjectReferences(
  scope: AspTypeScriptProjectScope,
): TypeScriptProjectReferenceResolutionFact[] {
  return scope.config.projectReferences
    .map((referencePath) => {
      const referencedPackage = scope.config.projectReferencePackages.find((candidate) =>
        isSameProjectReference(referencePath, candidate.path, candidate.configPath),
      );
      if (referencedPackage === undefined) {
        return {
          referencePath,
          resolution: "external" as const,
        };
      }
      const fact: TypeScriptProjectReferenceResolutionFact = {
        referencePath,
        resolution: "referenced-package",
        packagePath: referencedPackage.path,
      };
      const withName =
        referencedPackage.name === undefined
          ? fact
          : { ...fact, packageName: referencedPackage.name };
      return referencedPackage.configPath === undefined
        ? withName
        : { ...withName, configPath: referencedPackage.configPath };
    })
    .sort((left, right) => left.referencePath.localeCompare(right.referencePath));
}

export function resolvePackageImportOwners(
  scope: AspTypeScriptProjectScope,
  modules: readonly TypeScriptModuleReport[],
): TypeScriptPackageImportOwnerFact[] {
  const namedPackages = namedPackageOwners(scope);
  return modules
    .flatMap((moduleReport) =>
      moduleReport.imports.flatMap((importFact) =>
        packageImportOwnerFact(moduleReport.path, importFact, namedPackages),
      ),
    )
    .sort((left, right) =>
      `${left.fromPath}:${left.moduleSpecifier}`.localeCompare(
        `${right.fromPath}:${right.moduleSpecifier}`,
      ),
    );
}

export function resolvePackageEntries(
  scope: AspTypeScriptProjectScope,
  modulePaths: ReadonlySet<string>,
): TypeScriptPackageEntryResolutionFact[] {
  return [
    ...resolvePackageEntryGroup("field", scope.packageJson.entrypoints, scope, modulePaths),
    ...resolvePackageEntryGroup("exports", scope.packageJson.exports, scope, modulePaths),
    ...resolvePackageEntryGroup("imports", scope.packageJson.imports, scope, modulePaths),
    ...resolvePackageEntryGroup("bin", scope.packageJson.bins, scope, modulePaths),
  ].sort((left, right) =>
    `${left.kind}:${left.subpath}:${left.conditions.join("/")}:${left.target}`.localeCompare(
      `${right.kind}:${right.subpath}:${right.conditions.join("/")}:${right.target}`,
    ),
  );
}

interface NamedPackageOwner {
  readonly path: string;
  readonly name: string;
  readonly ownerKind: TypeScriptPackageImportOwnerFact["ownerKind"];
}

function namedPackageOwners(scope: AspTypeScriptProjectScope): NamedPackageOwner[] {
  const packagesByName = new Map<string, NamedPackageOwner>();
  for (const packageOwner of scope.config.projectReferencePackages) {
    addNamedPackageOwner(packagesByName, packageOwner, "project-reference");
  }
  for (const packageOwner of scope.packageJson.workspacePackages) {
    addNamedPackageOwner(packagesByName, packageOwner, "workspace");
  }
  return [...packagesByName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function addNamedPackageOwner(
  packagesByName: Map<string, NamedPackageOwner>,
  packageOwner: TypeScriptProjectReferencePackageFact | TypeScriptWorkspacePackageFact,
  ownerKind: TypeScriptPackageImportOwnerFact["ownerKind"],
): void {
  if (packageOwner.name === undefined || packagesByName.has(packageOwner.name)) {
    return;
  }
  packagesByName.set(packageOwner.name, {
    path: packageOwner.path,
    name: packageOwner.name,
    ownerKind,
  });
}

function packageImportOwnerFact(
  fromPath: string,
  importFact: TypeScriptImportFact,
  namedPackages: readonly NamedPackageOwner[],
): TypeScriptPackageImportOwnerFact[] {
  const packageOwner = namedPackages.find((referencedPackage) =>
    matchesPackageSpecifier(importFact.moduleSpecifier, referencedPackage.name),
  );
  if (packageOwner === undefined) {
    return [];
  }
  return [
    {
      fromPath,
      moduleSpecifier: importFact.moduleSpecifier,
      kind: importFact.kind,
      isTypeOnly: importFact.isTypeOnly,
      location: importFact.location,
      packagePath: packageOwner.path,
      packageName: packageOwner.name,
      ownerKind: packageOwner.ownerKind,
      via:
        importFact.moduleSpecifier === packageOwner.name
          ? ("package-name" as const)
          : ("package-subpath" as const),
    },
  ];
}

function resolvePackageEntryGroup(
  kind: TypeScriptPackageEntryResolutionFact["kind"],
  entries: readonly PackageJsonEntryFact[],
  scope: AspTypeScriptProjectScope,
  modulePaths: ReadonlySet<string>,
): TypeScriptPackageEntryResolutionFact[] {
  return entries.flatMap((entry) =>
    entry.targetDetails.map((targetDetail) => {
      const { target } = targetDetail;
      if (!target.startsWith(".")) {
        return {
          kind,
          subpath: entry.subpath,
          target,
          conditions: targetDetail.conditions,
          resolution: "external" as const,
          location: targetDetail.location,
        };
      }
      const resolved = resolvePackageTarget(scope, target, modulePaths);
      return resolved === undefined
        ? {
            kind,
            subpath: entry.subpath,
            target,
            conditions: targetDetail.conditions,
            resolution: "unresolved" as const,
            location: targetDetail.location,
          }
        : {
            kind,
            subpath: entry.subpath,
            target,
            conditions: targetDetail.conditions,
            resolution: "parser-visible" as const,
            toPath: resolved,
            location: targetDetail.location,
          };
    }),
  );
}

function resolvePackageTarget(
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

function matchesPackageSpecifier(moduleSpecifier: string, packageName: string): boolean {
  return moduleSpecifier === packageName || moduleSpecifier.startsWith(`${packageName}/`);
}

function isSameProjectReference(
  referencePath: string,
  packagePath: string,
  configPath: string | undefined,
): boolean {
  return (
    samePath(referencePath, packagePath) ||
    (configPath !== undefined &&
      (samePath(referencePath, configPath) ||
        samePath(path.join(referencePath, "tsconfig.json"), configPath)))
  );
}
