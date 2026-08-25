import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { TYPE_SCRIPT_LANGUAGE_ID, TYPE_SCRIPT_PROVIDER_ID } from "../cli/semantic-language.js";

import { packageDependencyFacts } from "../parser/package_dependencies.js";
import { parsePackageJsonDocument } from "../parser/package_document.js";
import { parsePnpmWorkspacePackages } from "../parser/pnpm_workspace.js";
import type { ParsedPackageJsonDocument } from "../parser/types.js";
import type { CliStreams } from "./project_resolution_io.js";
import { decodeJsonObjectEnvelope } from "../protocol/json_object_envelope.js";

const REQUEST_SCHEMA_ID = "agent.semantic-protocols.provider-project-resolution-request";
const RESPONSE_SCHEMA_ID = "agent.semantic-protocols.provider-project-resolution-response";
const PROJECT_RESOLUTION_SCHEMA_ID = "agent.semantic-protocols.project-resolution";
const PACKAGE_GRAPH_SCHEMA_ID = "agent.semantic-protocols.language-package-graph";
const PROJECT_RESOLUTION_PARSER_ID = "typescript.package-json";

type ProjectResolutionCollectionScope =
  | { readonly kind: "complete-generation" }
  | { readonly kind: "explicit-owners"; readonly ownerPaths: readonly string[] };

interface ProjectResolutionRequest {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly languageId: string;
  readonly providerId: string;
  readonly candidateBase: ".";
  readonly candidateGeneration: {
    readonly algorithm: string;
    readonly digest: string;
    readonly authorities: readonly string[];
  };
  readonly collectionScope: ProjectResolutionCollectionScope;
  readonly candidatePaths: readonly string[];
  readonly policyExclusions: readonly {
    readonly path: string;
    readonly authority: string;
    readonly reasonKind: string;
  }[];
}

interface ParsedPackage {
  readonly packageId: string;
  readonly name: string;
  readonly root: string;
  readonly manifestPath: string;
  readonly document: ParsedPackageJsonDocument;
  readonly targets: readonly LanguageTarget[];
}

interface LanguageTarget {
  readonly targetId: string;
  readonly name: string;
  readonly kind: "library" | "binary" | "test";
  readonly explicit: boolean;
  readonly sourceRoots: readonly string[];
  readonly entrypoints: readonly string[];
  readonly generatedRoots: readonly string[];
  readonly scopePaths: readonly string[];
}

interface ProjectResolutionFailure {
  readonly reasonKind: string;
  readonly message: string;
  readonly nextAction: string;
}

class ProjectResolutionNotApplicable extends Error {}

export function resolveProjectResolutionRequest(
  requestValue: unknown,
  cwd: string,
): Record<string, unknown> {
  let request: ProjectResolutionRequest;
  try {
    request = requestValue as ProjectResolutionRequest;
    validateRequest(request);
  } catch (error) {
    return projectResolutionFailure({
      reasonKind: "project-entry-invalid",
      message: error instanceof Error ? error.message : String(error),
      nextAction: "send-valid-project-resolution-request",
    });
  }

  try {
    const workspaceRoot = fs.realpathSync(cwd);
    const candidatePaths = normalizedCandidatePaths(request, workspaceRoot);
    const scope = resolveTypeScriptProject(request, workspaceRoot, candidatePaths);
    return {
      schemaId: RESPONSE_SCHEMA_ID,
      schemaVersion: "1",
      languageId: TYPE_SCRIPT_LANGUAGE_ID,
      providerId: TYPE_SCRIPT_PROVIDER_ID,
      state: "resolved",
      scope,
    };
  } catch (error) {
    if (error instanceof ProjectResolutionNotApplicable) {
      return {
        schemaId: RESPONSE_SCHEMA_ID,
        schemaVersion: "1",
        languageId: TYPE_SCRIPT_LANGUAGE_ID,
        providerId: TYPE_SCRIPT_PROVIDER_ID,
        state: "not-applicable",
      };
    }
    return projectResolutionFailure({
      reasonKind: "project-entry-invalid",
      message: error instanceof Error ? error.message : String(error),
      nextAction: "repair-typescript-project-entry",
    });
  }
}

function projectResolutionFailure(failure: ProjectResolutionFailure): Record<string, unknown> {
  return {
    schemaId: RESPONSE_SCHEMA_ID,
    schemaVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    state: "failed",
    failure,
  };
}

/** Resolve package-manager scope from a typed repository candidate snapshot. */
export function runProjectResolutionCommand(
  _argv: readonly string[],
  streams: CliStreams,
  cwd: string,
): number {
  let request: ProjectResolutionRequest;
  try {
    if (streams.stdin === undefined) {
      throw new Error("project-resolution requires a typed request payload");
    }
    request = decodeJsonObjectEnvelope<ProjectResolutionRequest>(
      streams.stdin,
      "project-resolution request",
    );
    validateRequest(request);
  } catch (error) {
    writeFailure(streams, {
      reasonKind: "project-entry-invalid",
      message: error instanceof Error ? error.message : String(error),
      nextAction: "send-valid-project-resolution-request",
    });
    return 0;
  }

  streams.stdout.write(`${JSON.stringify(resolveProjectResolutionRequest(request, cwd))}\n`);
  return 0;
}

function validateRequest(request: ProjectResolutionRequest): void {
  if (request.schemaId !== REQUEST_SCHEMA_ID || request.schemaVersion !== "1") {
    throw new Error("project-resolution request schema must be v1");
  }
  if (
    request.languageId !== TYPE_SCRIPT_LANGUAGE_ID ||
    request.providerId !== TYPE_SCRIPT_PROVIDER_ID
  ) {
    throw new Error("project-resolution request provider identity does not match asp-typescript");
  }
  if (request.candidateBase !== "." || request.candidateGeneration.digest.length === 0) {
    throw new Error("project-resolution requires candidateBase=. and candidateGeneration.digest");
  }
  const collectionScope = request.collectionScope;
  if (typeof collectionScope !== "object" || collectionScope === null) {
    throw new Error("project-resolution collectionScope is invalid");
  }
  if (collectionScope.kind === "complete-generation") {
    if (Object.keys(collectionScope).length !== 1) {
      throw new Error("complete-generation collectionScope only accepts kind");
    }
  } else if (collectionScope.kind === "explicit-owners") {
    if (
      !Array.isArray(collectionScope.ownerPaths) ||
      collectionScope.ownerPaths.length === 0 ||
      new Set(collectionScope.ownerPaths).size !== collectionScope.ownerPaths.length ||
      collectionScope.ownerPaths.some((ownerPath) => {
        if (typeof ownerPath !== "string" || ownerPath.length === 0 || path.isAbsolute(ownerPath)) {
          return true;
        }
        const normalized = slashPath(path.normalize(ownerPath));
        return normalized === "." || normalized !== ownerPath;
      })
    ) {
      throw new Error(
        "explicit-owners collectionScope requires unique normalized workspace-relative ownerPaths",
      );
    }
  } else {
    throw new Error("project-resolution collectionScope is invalid");
  }
  if (!Array.isArray(request.candidatePaths) || !Array.isArray(request.policyExclusions)) {
    throw new Error("project-resolution candidates and policy exclusions are required");
  }
}

function normalizedCandidatePaths(
  request: ProjectResolutionRequest,
  workspaceRoot: string,
): string[] {
  return [
    ...new Set(
      request.candidatePaths.map((candidatePath) => {
        const normalized = slashPath(path.normalize(candidatePath)).replace(/^\.\//u, "");
        if (
          normalized.length === 0 ||
          path.isAbsolute(candidatePath) ||
          normalized === ".." ||
          normalized.startsWith("../")
        ) {
          throw new Error(`ProjectResolution candidate is not scope-relative: ${candidatePath}`);
        }
        const absolute = path.resolve(workspaceRoot, normalized);
        if (!isWithin(workspaceRoot, absolute)) {
          throw new Error(`ProjectResolution candidate escaped scope root: ${candidatePath}`);
        }
        return normalized;
      }),
    ),
  ].sort();
}

function resolveTypeScriptProject(
  request: ProjectResolutionRequest,
  workspaceRoot: string,
  candidatePaths: readonly string[],
): Record<string, unknown> {
  const startedAt = process.hrtime.bigint();
  const candidateManifestPaths = candidatePaths.filter(
    (candidatePath) => path.posix.basename(candidatePath) === "package.json",
  );
  if (candidateManifestPaths.length === 0) {
    throw new ProjectResolutionNotApplicable(
      "TypeScript project scope has no candidate project entry package.json",
    );
  }
  if (!candidateManifestPaths.includes("package.json")) {
    throw new Error("TypeScript project scope requires candidate project entry package.json");
  }
  const entryManifest = "package.json";
  const manifestPaths = selectedWorkspaceManifestPaths(
    workspaceRoot,
    candidatePaths,
    candidateManifestPaths,
  );
  const packageRoots = manifestPaths.map((manifestPath) =>
    path.posix.dirname(manifestPath) === "." ? "" : path.posix.dirname(manifestPath),
  );
  const packages: ParsedPackage[] = [];
  const unresolved: {
    readonly state: string;
    readonly path: string;
    readonly reasonKind: string;
  }[] = [];
  for (const manifestPath of manifestPaths) {
    try {
      packages.push(parsePackage(workspaceRoot, manifestPath, packageRoots, candidatePaths));
    } catch (error) {
      unresolved.push({
        state: "manifest-invalid",
        path: manifestPath,
        reasonKind: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (packages.length === 0) {
    throw new Error("TypeScript project scope found no valid candidate package.json");
  }
  const packageIdsByName = new Map(packages.map((pkg) => [pkg.name, pkg.packageId]));
  const dependencyFacts = packages.flatMap((pkg) =>
    packageDependencyFacts(pkg.document).map((dependency) => ({
      packageId: pkg.packageId,
      dependency,
      toPackageId: packageIdsByName.get(dependency.name),
    })),
  );
  const internalDependencyEdges = dependencyFacts
    .filter(
      (
        fact,
      ): fact is typeof fact & {
        readonly toPackageId: string;
      } => fact.toPackageId !== undefined,
    )
    .map(({ packageId, dependency, toPackageId }) => ({
      fromPackageId: packageId,
      toPackageId,
      kind:
        dependency.source === "devDependencies"
          ? "dev"
          : dependency.versionRange.startsWith("workspace:")
            ? "workspace"
            : "normal",
    }));
  const externalDependencies = dependencyFacts
    .filter(({ toPackageId }) => toPackageId === undefined)
    .map(({ packageId, dependency }) => ({
      dependencyId: stableId(
        "npm-dependency",
        `${packageId}\0${dependency.source}\0${dependency.name}`,
      ),
      name: dependency.name,
      kind: dependency.source === "devDependencies" ? "dev" : "normal",
      requested: dependency.versionRange,
    }));
  const lockfiles = candidatePaths.filter(
    (candidatePath) =>
      packageRoots.includes(
        path.posix.dirname(candidatePath) === "." ? "" : path.posix.dirname(candidatePath),
      ) &&
      ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"].includes(
        path.posix.basename(candidatePath),
      ),
  );
  const parserId = PROJECT_RESOLUTION_PARSER_ID;
  const packageGraph = {
    schemaId: PACKAGE_GRAPH_SCHEMA_ID,
    schemaVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    projectEntry: entryManifest,
    parserId,
    manifests: manifestPaths.map((manifestPath) =>
      projectFile(workspaceRoot, manifestPath, "package-json"),
    ),
    lockfiles: lockfiles.map((lockfilePath) =>
      projectFile(workspaceRoot, lockfilePath, lockfileKind(lockfilePath)),
    ),
    packages: packages.map(({ document, root, targets, ...pkg }) => {
      const version = (document.packageJson as { readonly version?: unknown }).version;
      return {
        ...pkg,
        ...(typeof version === "string" ? { version } : {}),
        root: root.length === 0 ? "." : root,
        workspaceMember: true,
        targets: targets.map(({ scopePaths: _, ...target }) => target),
      };
    }),
    internalDependencyEdges,
    externalDependencies,
    unresolved,
  };
  const sourceScopes = packages.flatMap((pkg) =>
    pkg.targets
      .filter((target) => target.sourceRoots.length > 0)
      .map((target) => ({
        scopeId: stableId("typescript-source-scope", `${pkg.packageId}\0${target.targetId}`),
        packageId: pkg.packageId,
        targetId: target.targetId,
        roots: target.sourceRoots,
        explicitPaths: target.explicit ? target.scopePaths : [],
        extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"],
        includeAuthority: target.explicit ? "manifest-explicit" : "package-manager",
        exclusions: [],
        classifications: [target.kind === "test" ? "test" : "production"],
      })),
  );
  return {
    schemaId: PROJECT_RESOLUTION_SCHEMA_ID,
    schemaVersion: "1",
    state: "resolved",
    completeness: "exact",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    parserId,
    candidateGenerationDigest: request.candidateGeneration.digest,
    projectEntry: entryManifest,
    packageGraph,
    sourceScopes,
    conflicts: [],
    metrics: {
      parsedManifestCount: manifestPaths.length,
      parsedLockfileCount: lockfiles.length,
      affectedPackageCount: packages.length,
      fullWorkspaceReads: 0,
      fullManifestReparses: 0,
      dbOpens: 0,
      elapsedMicros: Number((process.hrtime.bigint() - startedAt) / 1_000n),
    },
  };
}

function selectedWorkspaceManifestPaths(
  workspaceRoot: string,
  candidatePaths: readonly string[],
  candidateManifestPaths: readonly string[],
): string[] {
  const rootDocument = readPackageDocument(workspaceRoot, "package.json");
  const patterns = packageJsonWorkspacePatterns(rootDocument);
  if (candidatePaths.includes("pnpm-workspace.yaml")) {
    const workspacePath = path.join(workspaceRoot, "pnpm-workspace.yaml");
    patterns.push(
      ...parsePnpmWorkspacePackages(workspacePath, fs.readFileSync(workspacePath, "utf8")).map(
        ({ pattern }) => pattern,
      ),
    );
  }
  if (patterns.length === 0) return ["package.json"];
  const positivePatterns = patterns.filter((pattern) => !pattern.startsWith("!"));
  const negativePatterns = patterns
    .filter((pattern) => pattern.startsWith("!"))
    .map((pattern) => pattern.slice(1));
  return candidateManifestPaths
    .filter((manifestPath) => {
      if (manifestPath === "package.json") return true;
      const packageRoot = path.posix.dirname(manifestPath);
      return (
        positivePatterns.some((pattern) => matchesGlob(packageRoot, pattern)) &&
        !negativePatterns.some((pattern) => matchesGlob(packageRoot, pattern))
      );
    })
    .sort();
}

function packageJsonWorkspacePatterns(document: ParsedPackageJsonDocument): string[] {
  const workspaces = document.packageJson.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces.filter((pattern): pattern is string => typeof pattern === "string");
  }
  if (typeof workspaces !== "object" || workspaces === null) return [];
  const packages = (workspaces as { readonly packages?: unknown }).packages;
  return Array.isArray(packages)
    ? packages.filter((pattern): pattern is string => typeof pattern === "string")
    : [];
}

function parsePackage(
  workspaceRoot: string,
  manifestPath: string,
  packageRoots: readonly string[],
  candidatePaths: readonly string[],
): ParsedPackage {
  const document = readPackageDocument(workspaceRoot, manifestPath);
  const root = path.posix.dirname(manifestPath) === "." ? "" : path.posix.dirname(manifestPath);
  const packageName =
    typeof document.packageJson.name === "string"
      ? document.packageJson.name
      : root.length === 0
        ? path.basename(workspaceRoot)
        : path.posix.basename(root);
  const packageId = stableId("npm-package", `${packageName}\0${root}`);
  const sourcePaths = packageSourcePaths(workspaceRoot, root, packageRoots, candidatePaths);
  const configExplicit = ["tsconfig.json", "jsconfig.json"]
    .map((name) => resolveRelative(root, name))
    .some((configPath) => candidatePaths.includes(configPath));
  const testPaths = sourcePaths.filter(isTestSourcePath);
  const libraryPaths = sourcePaths.filter((sourcePath) => !isTestSourcePath(sourcePath));
  const targets: LanguageTarget[] = [
    {
      targetId: stableId("typescript-target", `${packageId}\0library\0${packageName}`),
      name: packageName,
      kind: "library",
      explicit: configExplicit,
      sourceRoots: sourceRoots(libraryPaths),
      entrypoints: [],
      generatedRoots: [],
      scopePaths: libraryPaths,
    },
  ];
  if (testPaths.length > 0) {
    targets.push({
      targetId: stableId("typescript-target", `${packageId}\0test\0${packageName}`),
      name: `${packageName}-tests`,
      kind: "test",
      explicit: configExplicit,
      sourceRoots: sourceRoots(testPaths),
      entrypoints: [],
      generatedRoots: [],
      scopePaths: testPaths,
    });
  }
  for (const [binaryName, binaryPath] of packageBinaryEntries(document, packageName)) {
    if (candidatePaths.includes(resolveRelative(root, binaryPath))) {
      targets.push({
        targetId: stableId("typescript-target", `${packageId}\0binary\0${binaryName}`),
        name: binaryName,
        kind: "binary",
        explicit: true,
        sourceRoots: sourceRoots([resolveRelative(root, binaryPath)]),
        entrypoints: [resolveRelative(root, binaryPath)],
        generatedRoots: [],
        scopePaths: [resolveRelative(root, binaryPath)],
      });
    }
  }
  return { packageId, name: packageName, root, manifestPath, document, targets };
}

function packageSourcePaths(
  workspaceRoot: string,
  packageRoot: string,
  packageRoots: readonly string[],
  candidatePaths: readonly string[],
): string[] {
  const packageCandidates = candidatePaths.filter(
    (candidatePath) =>
      owningPackageRoot(candidatePath, packageRoots) === packageRoot &&
      isTypeScriptOrJavaScriptSource(candidatePath),
  );
  const configPath = ["tsconfig.json", "jsconfig.json"]
    .map((name) => resolveRelative(packageRoot, name))
    .find((candidatePath) => candidatePaths.includes(candidatePath));
  if (configPath === undefined) return packageCandidates;

  const absoluteConfigPath = path.join(workspaceRoot, configPath);
  const readResult = ts.readConfigFile(absoluteConfigPath, ts.sys.readFile);
  if (readResult.error !== undefined) return packageCandidates;
  const candidateSet = new Set(
    packageCandidates.map((candidatePath) => path.resolve(workspaceRoot, candidatePath)),
  );
  const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory(rootDir, extensions, excludes, includes, depth) {
      const normalizedRoot = path.resolve(rootDir);
      return [...candidateSet].filter((candidatePath) => {
        if (!isWithin(normalizedRoot, candidatePath)) return false;
        if (
          extensions !== undefined &&
          extensions.length > 0 &&
          !extensions.some((extension) => candidatePath.endsWith(extension))
        ) {
          return false;
        }
        const relative = slashPath(path.relative(normalizedRoot, candidatePath));
        if (depth !== undefined && relative.split("/").length - 1 > depth) return false;
        if (includes !== undefined && includes.length > 0 && !matchesAnyGlob(relative, includes)) {
          return false;
        }
        return excludes === undefined || !matchesAnyGlob(relative, excludes);
      });
    },
  };
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    host,
    path.dirname(absoluteConfigPath),
    undefined,
    absoluteConfigPath,
  );
  return parsed.fileNames
    .map((fileName) => path.resolve(fileName))
    .filter((fileName) => candidateSet.has(fileName))
    .map((fileName) => slashPath(path.relative(workspaceRoot, fileName)))
    .sort();
}

function readPackageDocument(
  workspaceRoot: string,
  manifestPath: string,
): ParsedPackageJsonDocument {
  const absoluteManifestPath = path.join(workspaceRoot, manifestPath);
  return parsePackageJsonDocument(
    absoluteManifestPath,
    fs.readFileSync(absoluteManifestPath, "utf8"),
  );
}

function packageBinaryEntries(
  document: ParsedPackageJsonDocument,
  packageName: string,
): readonly (readonly [string, string])[] {
  const bin = document.packageJson.bin;
  if (typeof bin === "string") return [[packageName, bin]];
  if (typeof bin !== "object" || bin === null || Array.isArray(bin)) return [];
  return Object.entries(bin).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

function projectFile(
  workspaceRoot: string,
  relativePath: string,
  kind: string,
): { readonly path: string; readonly kind: string; readonly digest: string } {
  return {
    path: relativePath,
    kind,
    digest: `sha256:${sha256(fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8"))}`,
  };
}

function lockfileKind(lockfilePath: string): string {
  switch (path.posix.basename(lockfilePath)) {
    case "pnpm-lock.yaml":
      return "pnpm-lock";
    case "yarn.lock":
      return "yarn-lock";
    case "bun.lock":
    case "bun.lockb":
      return "bun-lock";
    default:
      return "npm-lock";
  }
}

function sourceRoots(sourcePaths: readonly string[]): string[] {
  return [
    ...new Set(
      sourcePaths.map((sourcePath) => {
        const parent = path.posix.dirname(sourcePath);
        return parent === "." ? sourcePath : parent;
      }),
    ),
  ].sort();
}

function matchesAnyGlob(candidatePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(candidatePath, pattern));
}

function matchesGlob(candidatePath: string, pattern: string): boolean {
  const normalizedPattern = slashPath(pattern).replace(/^\.\//u, "").replace(/\/+$/u, "");
  let expression = "^";
  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const character = normalizedPattern[index]!;
    if (character === "*" && normalizedPattern[index + 1] === "*") {
      if (normalizedPattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += character.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
    }
  }
  return new RegExp(`${expression}$`, "u").test(slashPath(candidatePath));
}

function isTypeScriptOrJavaScriptSource(candidatePath: string): boolean {
  return [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].some((extension) =>
    candidatePath.endsWith(extension),
  );
}

function isTestSourcePath(candidatePath: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__)\//u.test(candidatePath) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(candidatePath)
  );
}

function isUnder(root: string, candidatePath: string): boolean {
  return root.length === 0 || candidatePath === root || candidatePath.startsWith(`${root}/`);
}

function owningPackageRoot(candidatePath: string, packageRoots: readonly string[]): string {
  return (
    [...packageRoots]
      .filter((packageRoot) => isUnder(packageRoot, candidatePath))
      .sort((left, right) => right.length - left.length)[0] ?? ""
  );
}

function isWithin(root: string, candidatePath: string): boolean {
  const relative = path.relative(root, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveRelative(root: string, candidatePath: string): string {
  return slashPath(path.posix.normalize(path.posix.join(root, candidatePath))).replace(
    /^\.\//u,
    "",
  );
}

function slashPath(candidatePath: string): string {
  return candidatePath.replaceAll(path.sep, "/");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(namespace: string, basis: string): string {
  return `${namespace}-${sha256(`${namespace}\0${basis}`).slice(0, 16)}`;
}

function writeFailure(streams: CliStreams, failure: ProjectResolutionFailure): void {
  streams.stdout.write(
    `${JSON.stringify({
      schemaId: RESPONSE_SCHEMA_ID,
      schemaVersion: "1",
      languageId: TYPE_SCRIPT_LANGUAGE_ID,
      providerId: TYPE_SCRIPT_PROVIDER_ID,
      state: "failed",
      failure,
    })}\n`,
  );
}
