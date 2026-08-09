/**
 * Semantic-search packet builders for workspace, prime, and owner views.
 */

import type { TypeScriptExportFact, TypeScriptHarnessReport } from "../../model.js";
import {
  edgeFact,
  findingGroups,
  findingNode,
  ownerFact,
  ownerNode,
  packageFact,
  packageNode,
  primeNextActions,
  rankedOwners,
  workspacePackageEdge,
  workspacePackageFact,
  workspacePackageNode,
  workspaceRootPackageFact,
} from "./facts.js";
import { ownerFallback } from "./owner-fallback.js";
import { basePacket } from "./packet-base.js";
import { primeTypeScriptAxisNodes } from "./prime-axes.js";
import type {
  SemanticSearchBuildOptions,
  SemanticSearchEdge,
  SemanticSearchItem,
  SemanticSearchPacket,
  SemanticSearchSynthesis,
} from "./types.js";
import {
  MAX_FINDINGS,
  MAX_PRIME_EDGES,
  MAX_PRIME_OWNERS,
  MAX_WORKSPACE_EDGES,
  MAX_WORKSPACE_PACKAGES,
} from "./types.js";
import { findOwner, relPath, stripNodePrefix } from "./utils.js";
import { rankedWorkspacePackages } from "./workspace-ranking.js";

export function buildWorkspacePacket(
  report: TypeScriptHarnessReport,
  options: SemanticSearchBuildOptions,
): SemanticSearchPacket {
  const tree = report.reasoningTree;
  const workspacePackages = rankedWorkspacePackages(report).slice(0, MAX_WORKSPACE_PACKAGES);
  const packageFacts = [
    workspaceRootPackageFact(report),
    ...workspacePackages.map((workspacePackage) => workspacePackageFact(report, workspacePackage)),
  ];
  const packagePaths = new Set(
    workspacePackages.map((workspacePackage) => relPath(report, workspacePackage.path)),
  );
  const workspaceOwnerCount = tree.packageImportOwners.filter(
    (owner) => owner.ownerKind === "workspace",
  ).length;
  const edges = uniqueWorkspaceEdges(
    tree.packageImportOwners
      .filter((owner) => owner.ownerKind === "workspace")
      .filter((owner) => packagePaths.has(relPath(report, owner.packagePath)))
      .map((owner) => workspacePackageEdge(report, owner)),
  ).slice(0, MAX_WORKSPACE_EDGES);
  const findings = findingGroups(report).slice(0, MAX_FINDINGS);
  const nextActions = [
    ...workspacePackages.slice(0, 8).map((workspacePackage) => ({
      kind: "prime" as const,
      target: relPath(report, workspacePackage.path),
    })),
    ...(workspacePackages.length === 0 ? [{ kind: "prime" as const, target: "." }] : []),
  ];
  return basePacket(report, options, {
    header: {
      kind: "search-workspace",
      fields: {
        mode: workspacePackages.length > 0 ? "workspace-index" : "single-package",
        package: tree.packageName ?? ".",
        packages: tree.workspacePackages.length,
        shown: workspacePackages.length,
        edge: workspaceOwnerCount,
        external: tree.packageDependencies.length,
        find: report.findings.length,
      },
    },
    packages: packageFacts,
    nodes: [...packageFacts.map((pkg) => workspacePackageNode(pkg)), ...findings.map(findingNode)],
    edges,
    owners: [],
    hits: [],
    findings,
    nextActions,
    notes: [
      ...(workspacePackages.length === 0
        ? [
            {
              kind: "not-found" as const,
              message: "workspace packages not found; use search prime for the package map",
            },
          ]
        : []),
      ...(tree.workspacePackages.length > workspacePackages.length
        ? [
            {
              kind: "fact-scope" as const,
              message: `workspace package list capped at ${MAX_WORKSPACE_PACKAGES}`,
            },
          ]
        : []),
    ],
  });
}

export function buildPrimePacket(
  report: TypeScriptHarnessReport,
  options: SemanticSearchBuildOptions,
): SemanticSearchPacket {
  const tree = report.reasoningTree;
  const owners = rankedOwners(report)
    .slice(0, MAX_PRIME_OWNERS)
    .map((branch) => ownerFact(report, branch));
  const edgeSet = new Set(owners.map((owner) => owner.path));
  const edges = tree.ownerDependencies
    .filter((dependency) => dependency.toPath !== undefined)
    .map((dependency) => edgeFact(report, dependency))
    .filter(
      (edge) => edgeSet.has(stripNodePrefix(edge.from)) || edgeSet.has(stripNodePrefix(edge.to)),
    )
    .slice(0, MAX_PRIME_EDGES);
  const findings = findingGroups(report).slice(0, MAX_FINDINGS);
  const nextActions = primeNextActions(owners);
  const primeAxisNodes = primeTypeScriptAxisNodes(report);
  const searchSynthesis = primeGraphSynthesis(report, owners, edges, findings);
  return basePacket(report, options, {
    header: {
      kind: "search-prime",
      fields: {
        mode: "package",
        package: tree.packageName ?? ".",
        sourceFiles: tree.modules.length,
        owners: tree.ownerBranches.length,
        edges: tree.ownerDependencies.length,
        findings: report.findings.length,
        analysis: "structure",
        nativeSyntaxFacts: "skipped",
        policyFindings: "skipped",
        extensions: tree.packageExtensions.length,
        buildTools: tree.packageBuildTools.length,
        workspaces: tree.workspacePackages.length,
        projectReferences: tree.projectReferences.length,
      },
    },
    packages: [packageFact(report)],
    nodes: [
      packageNode(report),
      ...primeAxisNodes,
      ...owners.map((owner) => ownerNode(owner)),
      ...findings.map((finding) => findingNode(finding)),
    ],
    edges,
    owners,
    searchSynthesis,
    hits: [],
    findings,
    nextActions,
    notes: [],
  });
}

export function buildOwnerPacket(
  report: TypeScriptHarnessReport,
  options: SemanticSearchBuildOptions,
): SemanticSearchPacket {
  const query = options.query ?? "";
  const branch = findOwner(report, query);
  if (branch === undefined) {
    const fallback = ownerFallback(report, query);
    if (fallback !== undefined) {
      const owner = fallback.owner;
      return basePacket(report, options, {
        header: {
          kind: "search-owner",
          fields: {
            q: query,
            role: owner.role,
            public: owner.public,
            edge: 0,
            find: 0,
          },
        },
        nodes: [ownerNode(owner)],
        edges: [],
        owners: [owner],
        hits: [],
        findings: [],
        nextActions: owner.nextActions ?? [],
        notes: [
          {
            kind: "owner-not-found" as const,
            message: fallback.message,
          },
        ],
      });
    }

    return basePacket(report, options, {
      header: {
        kind: "search-owner",
        fields: { q: query, own: 0, edge: 0, find: 0 },
      },
      nodes: [],
      edges: [],
      owners: [],
      hits: [],
      findings: [],
      nextActions: [{ kind: "prime" as const, target: "search-prime" }],
      notes: [{ kind: "not-found" as const, message: `owner not found: ${query}` }],
    });
  }

  const owner = ownerFact(report, branch);
  const ownerPath = owner.path;
  const edges = report.reasoningTree.ownerDependencies
    .filter((dependency) => {
      const fromPath = relPath(report, dependency.fromPath);
      const toPath = dependency.toPath ? relPath(report, dependency.toPath) : undefined;
      return fromPath === ownerPath || toPath === ownerPath;
    })
    .map((dependency) => edgeFact(report, dependency))
    .slice(0, MAX_PRIME_EDGES);
  const findings = findingGroups(report).filter((finding) => finding.location.path === ownerPath);
  const searchSynthesis = ownerGraphSynthesis(ownerPath, edges, findings);
  const shouldIncludeItems =
    options.pipes?.includes("items") === true || options.renderMode === "seeds";
  const items = shouldIncludeItems ? ownerItems(report, ownerPath) : [];
  const nextActions =
    items.length > 0 ? ownerItemNextActions(ownerPath, items) : (owner.nextActions ?? []);
  return basePacket(report, options, {
    header: {
      kind: "search-owner",
      fields: {
        q: query,
        role: owner.role,
        public: owner.public,
        edge: edges.length,
        find: findings.length,
        ...(options.pipes?.length ? { pipes: options.pipes } : {}),
      },
    },
    nodes: [ownerNode(owner), ...findings.map((finding) => findingNode(finding))],
    edges,
    owners: [owner],
    ...(items.length > 0 ? { items } : {}),
    searchSynthesis,
    hits: [],
    findings,
    nextActions,
    notes: [],
  });
}

function ownerItems(
  report: TypeScriptHarnessReport,
  ownerPath: string,
): readonly SemanticSearchItem[] {
  const moduleReport = report.modules.find((mod) => relPath(report, mod.path) === ownerPath);
  if (moduleReport === undefined) return [];

  return [...moduleReport.exports]
    .filter((exportFact) => exportFact.name !== "")
    .map((exportFact) => ownerItem(ownerPath, exportFact))
    .sort(compareOwnerItems);
}

function ownerItem(ownerPath: string, exportFact: TypeScriptExportFact): SemanticSearchItem {
  const itemKind = exportKindToItemKind(exportFact.kind);
  return {
    name: exportFact.name,
    kind: itemKind,
    ownerPath,
    location: {
      path: ownerPath,
      lineRange: `${exportFact.location.line}:${exportFact.location.line}`,
    },
    fields: {
      exported: true,
      exportKind: exportFact.kind,
      typeOnly: exportFact.isTypeOnly,
      structuralSelector: `typescript://${ownerPath}#item/${itemKind}/${exportFact.name}`,
    },
  };
}

function ownerItemNextActions(
  ownerPath: string,
  items: readonly SemanticSearchItem[],
): readonly import("./types.js").SemanticSearchNextAction[] {
  const terms = selectedOwnerItemTerms(items);
  if (terms.length === 0) return [];
  const command = [
    "ts-harness",
    "search",
    "lexical",
    ...terms.flatMap((term) => ["--query-set", term]),
    "--owner",
    ownerPath,
    "owner",
    "--workspace",
    ".",
    "--view",
    "seeds",
  ]
    .map(commandArg)
    .join(" ");
  return [
    {
      kind: "lexical",
      target: terms[0]!,
      ownerPath,
      fields: {
        command,
        composition: "query-set",
        querySet: terms,
        reason: "co-located-owner-items",
      },
    },
  ];
}

function selectedOwnerItemTerms(items: readonly SemanticSearchItem[]): readonly string[] {
  return [...items]
    .sort(compareOwnerItemsForNextAction)
    .slice(0, 4)
    .map((item) => item.name);
}

function compareOwnerItemsForNextAction(
  left: SemanticSearchItem,
  right: SemanticSearchItem,
): number {
  const rankDiff = nextActionItemRank(left) - nextActionItemRank(right);
  if (rankDiff !== 0) return rankDiff;
  return compareOwnerItems(left, right);
}

function nextActionItemRank(item: SemanticSearchItem): number {
  if (/^[A-Z].*Packet/u.test(item.name)) return 0;
  if (/^[A-Z].*Owner$/u.test(item.name)) return 1;
  if (/^[A-Z].*Owner/u.test(item.name)) return 2;
  if (/^[A-Z].*NextAction/u.test(item.name)) return 3;
  if (/^[A-Z].*Synthesis/u.test(item.name)) return 4;
  return itemKindRank(item.kind) + 5;
}

function commandArg(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function compareOwnerItems(left: SemanticSearchItem, right: SemanticSearchItem): number {
  const rankDiff = itemKindRank(left.kind) - itemKindRank(right.kind);
  if (rankDiff !== 0) return rankDiff;
  const lineDiff =
    lineRangeStart(left.location?.lineRange) - lineRangeStart(right.location?.lineRange);
  return lineDiff !== 0 ? lineDiff : left.name.localeCompare(right.name);
}

function lineRangeStart(lineRange: string | undefined): number {
  if (lineRange === undefined) return Number.MAX_SAFE_INTEGER;
  const start = Number.parseInt(lineRange.split(":", 1)[0] ?? "", 10);
  return Number.isFinite(start) ? start : Number.MAX_SAFE_INTEGER;
}

function itemKindRank(kind: SemanticSearchItem["kind"]): number {
  switch (kind) {
    case "interface":
      return 0;
    case "type":
      return 1;
    case "class":
      return 2;
    case "function":
      return 3;
    case "enum":
      return 4;
    case "namespace":
      return 5;
    case "variable":
      return 6;
    default:
      return 7;
  }
}

function exportKindToItemKind(kind: TypeScriptExportFact["kind"]): SemanticSearchItem["kind"] {
  switch (kind) {
    case "function":
    case "class":
    case "interface":
    case "type":
    case "enum":
    case "variable":
    case "namespace":
      return kind;
    default:
      return "export";
  }
}

function uniqueWorkspaceEdges(edges: readonly SemanticSearchEdge[]): readonly SemanticSearchEdge[] {
  const seen = new Set<string>();
  const unique: SemanticSearchEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}:${edge.kind}:${edge.to}:${edge.label ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(edge);
  }
  return unique;
}

function primeGraphSynthesis(
  report: TypeScriptHarnessReport,
  owners: readonly ReturnType<typeof ownerFact>[],
  edges: readonly SemanticSearchEdge[],
  findings: readonly ReturnType<typeof findingGroups>[number][],
): SemanticSearchSynthesis {
  const selectedOwners = owners.map((owner) => owner.path);
  const selectedOwnerSet = new Set(selectedOwners);
  const frontierOwners = rankedOwnerFrontier(report, selectedOwnerSet).slice(0, 4);
  const findingOwners = uniqueStrings(findings.map((finding) => finding.location.path)).slice(0, 4);
  return {
    algorithm: "owner-rank-frontier",
    scope: "prime",
    summary: "owner graph ranked and capped for agent planning",
    seeds: frontierOwners.slice(0, 4).map((target) => ({ kind: "owner" as const, target })),
    selectedOwners: owners.length,
    selectedEdges: edges.length,
    highImpactOwners: selectedOwners.slice(0, 4),
    frontierOwners,
    findingOwners,
    fields: {
      analysis: "structure",
      nativeSyntaxFacts: "skipped",
      policyFindings: "skipped",
    },
  };
}

function ownerGraphSynthesis(
  ownerPath: string,
  edges: readonly SemanticSearchEdge[],
  findings: readonly ReturnType<typeof findingGroups>[number][],
): SemanticSearchSynthesis {
  const incomingOwners: string[] = [];
  const outgoingOwners: string[] = [];
  for (const edge of edges) {
    const from = stripNodePrefix(edge.from);
    const to = stripNodePrefix(edge.to);
    if (to === ownerPath && from !== ownerPath) incomingOwners.push(from);
    if (from === ownerPath && to !== ownerPath) outgoingOwners.push(to);
  }
  const frontierOwners = uniqueStrings([...incomingOwners, ...outgoingOwners]).slice(0, 4);
  return {
    algorithm: "bounded-reachability-depth1",
    scope: "owner",
    summary: "bounded owner frontier from incoming and outgoing graph edges",
    seeds: frontierOwners.slice(0, 4).map((target) => ({ kind: "owner" as const, target })),
    ownerPath,
    incomingOwners: incomingOwners.length,
    outgoingOwners: outgoingOwners.length,
    frontierOwners,
    findingOwners: uniqueStrings(findings.map((finding) => finding.location.path)).slice(0, 4),
  };
}

function rankedOwnerFrontier(
  report: TypeScriptHarnessReport,
  selectedOwners: ReadonlySet<string>,
): readonly string[] {
  const counts = new Map<string, number>();
  for (const dependency of report.reasoningTree.ownerDependencies) {
    const from = relPath(report, dependency.fromPath);
    const to = dependency.toPath === undefined ? undefined : relPath(report, dependency.toPath);
    if (to === undefined) continue;
    if (selectedOwners.has(from) && !selectedOwners.has(to)) addFrontierOwner(counts, to);
    if (selectedOwners.has(to) && !selectedOwners.has(from)) addFrontierOwner(counts, from);
  }
  return [...counts.entries()]
    .sort(([leftPath, leftCount], [rightPath, rightCount]) => {
      if (leftCount !== rightCount) return rightCount - leftCount;
      return leftPath.localeCompare(rightPath);
    })
    .map(([ownerPath]) => ownerPath);
}

function addFrontierOwner(counts: Map<string, number>, ownerPath: string): void {
  counts.set(ownerPath, (counts.get(ownerPath) ?? 0) + 1);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
