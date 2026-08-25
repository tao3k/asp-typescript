/**
 * Packet payload builders for dependency and deps semantic-search views.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { TypeScriptHarnessReport } from "../../model.js";
import {
  dependencyApiHit,
  dependencyApiManifestHit,
  dependencyApiNode,
  dependencyApiUsageMatches,
  dependencyWorkspaceVersion,
  dependencyVersionScope,
  dependencyVersionStatus,
  parseDependencyApiQuery,
} from "./deps.js";
import { ownerNode } from "./facts.js";
import {
  dependencyEdge,
  dependencyImportMatches,
  dependencyManifestHit,
  dependencyManifestMatches,
  dependencyNodesForMatches,
  dependencyPackageRoots,
  ownersForHits,
  packageRootFromSpecifier,
} from "./hits.js";
import type {
  SemanticSearchBuildOptions,
  SemanticSearchCache,
  SemanticSearchHit,
  SemanticSearchPacketPayload,
} from "./types.js";

export function buildDependencyPacketPayload(
  report: TypeScriptHarnessReport,
  options: SemanticSearchBuildOptions,
): SemanticSearchPacketPayload {
  const query = options.query ?? "";
  const manifestMatches = dependencyManifestMatches(report, query);
  const matches: ReturnType<typeof dependencyImportMatches> = [];
  const hits = manifestMatches.map((match) => dependencyManifestHit(report, match));
  const packageRoots = dependencyPackageRoots(matches, manifestMatches);
  const queryPackageRoot = packageRootFromSpecifier(query) ?? query.trim();
  const edges: ReturnType<typeof dependencyEdge>[] = [];
  const owners: ReturnType<typeof ownersForHits> = [];
  const cache = dependencySearchCache(report, hits);
  return {
    header: {
      kind: "search-dependency",
      fields: {
        q: query,
        dep: packageRoots.length,
        manifest: manifestMatches.length,
        own: owners.length,
        hit: hits.length,
        edge: edges.length,
        topology: "asp-owned",
        view: "graph",
      },
    },
    nodes: [
      ...owners.map((owner) => ownerNode(owner)),
      ...dependencyNodesForMatches(matches, manifestMatches, query),
    ],
    edges,
    owners,
    ...(cache ? { cache } : {}),
    hits,
    findings: [],
    nextActions: [
      ...(queryPackageRoot === ""
        ? []
        : [
            { kind: "public-external-types" as const, target: queryPackageRoot },
            { kind: "import" as const, target: query },
          ]),
    ],
    notes: [
      ...(query.trim() === ""
        ? [{ kind: "empty-query" as const, message: "dependency search requires a package query" }]
        : []),
      ...(query.trim() !== "" && hits.length === 0
        ? [{ kind: "not-found" as const, message: `dependency usage not found: ${query}` }]
        : []),
      {
        kind: "fact-scope" as const,
        message:
          "dependency view exposes manifest facts only; ASP owns dependency topology and source/import indexes",
      },
    ],
  };
}

export function buildDepsPacketPayload(
  report: TypeScriptHarnessReport,
  options: SemanticSearchBuildOptions,
): SemanticSearchPacketPayload {
  const queryText = options.query ?? "";
  const query = parseDependencyApiQuery(queryText);
  const manifestMatches =
    query === undefined ? [] : dependencyManifestMatches(report, query.packageRoot);
  const allDependencyMatches =
    query === undefined || query.apiQuery === undefined
      ? []
      : dependencyImportMatches(report, query.packageRoot);
  const workspaceVersion =
    query === undefined
      ? {}
      : dependencyWorkspaceVersion(report, query.packageRoot, manifestMatches);
  const versionStatus =
    query === undefined
      ? "unknown"
      : dependencyVersionStatus(query, manifestMatches, workspaceVersion);
  const versionScope = dependencyVersionScope(versionStatus);
  const matches =
    query === undefined || query.apiQuery === undefined || versionScope !== "current"
      ? []
      : dependencyApiUsageMatches(report, query, allDependencyMatches);
  const hits =
    query === undefined
      ? []
      : [
          ...manifestMatches.map((match) =>
            dependencyApiManifestHit(
              report,
              match,
              query,
              workspaceVersion,
              versionStatus,
              versionScope,
            ),
          ),
          ...matches.map((match) =>
            dependencyApiHit(report, match, query, workspaceVersion, versionStatus, versionScope),
          ),
        ];
  const edges = matches.map((match) => dependencyEdge(report, match));
  const owners = ownersForHits(report, hits);
  const cache = dependencySearchCache(
    report,
    hits,
    dependencyWorkspaceVersionPaths(workspaceVersion.workspaceVersionSource),
  );
  return {
    header: {
      kind: "search-deps",
      fields: {
        q: queryText,
        dep: query === undefined ? 0 : 1,
        ...(query === undefined ? {} : { package: query.packageRoot }),
        ...(query?.requestedVersion === undefined
          ? {}
          : { requestedVersion: query.requestedVersion }),
        ...(workspaceVersion.currentWorkspaceVersion === undefined
          ? {}
          : { currentWorkspaceVersion: workspaceVersion.currentWorkspaceVersion }),
        ...(workspaceVersion.workspaceVersionSource === undefined
          ? {}
          : { workspaceVersionSource: workspaceVersion.workspaceVersionSource }),
        versionStatus,
        versionScope,
        ...(query?.apiQuery === undefined ? {} : { api: query.apiQuery }),
        manifest: manifestMatches.length,
        usage: matches.length,
        hit: hits.length,
        topology: "asp-owned",
        view: "hits",
      },
    },
    nodes:
      query === undefined
        ? []
        : [
            dependencyApiNode(
              query,
              manifestMatches,
              matches,
              workspaceVersion,
              versionStatus,
              versionScope,
            ),
          ],
    edges,
    owners,
    ...(cache ? { cache } : {}),
    hits,
    findings: [],
    nextActions:
      query === undefined
        ? []
        : [
            { kind: "dependency" as const, target: query.packageRoot },
            { kind: "public-external-types" as const, target: query.packageRoot },
            ...(query.apiQuery === undefined ? [] : [{ kind: "api" as const, target: query.raw }]),
            ...(query.apiQuery === undefined || versionScope !== "current"
              ? []
              : [
                  { kind: "lexical" as const, target: query.apiQuery },
                  { kind: "tests" as const, target: query.apiQuery },
                ]),
          ],
    notes: [
      ...(queryText.trim() === ""
        ? [{ kind: "empty-query" as const, message: "deps search requires a dependency query" }]
        : []),
      ...(queryText.trim() !== "" && query === undefined
        ? [
            {
              kind: "not-found" as const,
              message: `dependency query is not a package: ${queryText}`,
            },
          ]
        : []),
      ...(query !== undefined && hits.length === 0
        ? [{ kind: "not-found" as const, message: `dependency API usage not found: ${queryText}` }]
        : []),
      ...(versionScope === "external"
        ? [
            {
              kind: "fact-scope" as const,
              message:
                "requested dependency version is outside the current workspace resolution; local import usage is not attributed to that version",
            },
          ]
        : []),
      {
        kind: "fact-scope" as const,
        message:
          query?.apiQuery === undefined
            ? "deps view exposes manifest facts only; ASP owns dependency topology and source/import indexes"
            : "deps API view anchors usage to package manifest, lockfile version, and TypeScript import facts; external API docs require a separate provider",
      },
    ],
  };
}

function dependencySearchCache(
  report: TypeScriptHarnessReport,
  hits: readonly SemanticSearchHit[],
  extraPaths: readonly string[] = [],
): SemanticSearchCache | undefined {
  const paths = new Set<string>();
  for (const hit of hits) {
    paths.add(hit.location.path);
  }
  for (const extraPath of extraPaths) {
    paths.add(extraPath);
  }
  const fileHashes = [...paths].sort().flatMap((relativePath) => {
    const fileHash = hashWorkspaceFile(report.reasoningTree.projectRoot, relativePath);
    return fileHash === undefined ? [] : [fileHash];
  });
  if (fileHashes.length === 0) return undefined;
  return { fileHashes, rawSourceStored: false };
}

function dependencyWorkspaceVersionPaths(
  source: "package-lock" | "package-json" | undefined,
): readonly string[] {
  switch (source) {
    case "package-lock":
      return ["package-lock.json"];
    case "package-json":
      return ["package.json"];
    default:
      return [];
  }
}

function hashWorkspaceFile(
  projectRoot: string,
  relativePath: string,
): { readonly path: string; readonly sha256: string } | undefined {
  const normalizedPath = relativePath.split(path.sep).join("/");
  if (!isSafeRelativePath(normalizedPath)) return undefined;
  const root = path.resolve(projectRoot);
  const absolutePath = path.resolve(root, normalizedPath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    return undefined;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return undefined;
  }
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
  return { path: normalizedPath, sha256 };
}

function isSafeRelativePath(value: string): boolean {
  if (value === "" || value.startsWith("/") || value.includes("\0")) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
