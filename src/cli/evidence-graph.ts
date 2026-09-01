/**
 * Provider-owned evidence graph packets for TypeScript projects.
 */

import fs from "node:fs";
import path from "node:path";

import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
} from "./semantic-language.js";

const EVIDENCE_GRAPH_SCHEMA_ID = "agent.semantic-protocols.semantic-evidence-graph";
const EVIDENCE_GRAPH_PROTOCOL_ID = "agent.semantic-protocols.evidence-graph";
const GRAPH_TURBO_REQUEST_SCHEMA_ID = "agent.semantic-protocols.semantic-graph-turbo-request";
const SEMANTIC_LANGUAGE_PROTOCOL_ID = "agent.semantic-protocols.semantic-language";

type JsonObject = Record<string, unknown>;

export function buildTypeScriptEvidenceGraph(projectRoot: string): JsonObject {
  const root = path.resolve(projectRoot);
  const ownerPath = selectOwnerPath(root);
  const ownerId = nodeId("typescript:owner", ownerPath);
  const claimId = nodeId("typescript:claim", ownerPath);
  const receiptId = nodeId("typescript:receipt", "policy-api");
  const actionId = nodeId("typescript:action", "attach-policy-api-receipt");
  const gapId = nodeId("typescript:gap", `${ownerPath}:receipt`);
  const nodes: JsonObject[] = [
    {
      nodeId: ownerId,
      kind: "owner",
      label: ownerPath,
      ownerPath,
      status: "current",
      location: { path: ownerPath, line: 1, column: 0 },
      fields: { languageId: TYPE_SCRIPT_LANGUAGE_ID, source: "provider-project" },
    },
    {
      nodeId: claimId,
      kind: "invariant-candidate",
      label: "TypeScript provider behavior needs executable evidence",
      ownerPath,
      candidateId: "typescript.evidence.project-harness",
      status: "needs-injection",
      summary:
        "Project-level TypeScript policy and semantic search behavior should be linked to verification receipts.",
      location: { path: ownerPath, line: 1, column: 0 },
      fields: {
        sourceRuleId: "TS-EVIDENCE-GRAPH",
        receiptKind: "policy-evaluation",
      },
    },
    {
      nodeId: receiptId,
      kind: "verification-receipt",
      label: "TypeScript dependency policy API receipt",
      receiptId: "typescript.policy.api",
      status: "needs-injection",
      summary:
        "Attach the receipt emitted by the TypeScript dependency policy API before treating the claim as verified.",
      fields: {
        authority: "typescript-lang-project-harness-api",
        trigger: "package-test",
      },
    },
    {
      nodeId: actionId,
      kind: "review-action",
      label: "Attach TypeScript dependency policy API receipt",
      actionId: "typescript.attach-policy-api-receipt",
      status: "missing",
      summary: "run-receipt",
      fields: {
        priority: "p0",
        targetId: "typescript.evidence.project-harness",
      },
    },
  ];
  const edges = [
    edge("typescript:edge:owner-claim", "supports-claim", ownerId, claimId),
    edge("typescript:edge:claim-receipt", "requires-evidence", claimId, receiptId),
    edge("typescript:edge:action-claim", "requires-evidence", actionId, claimId),
  ];
  const gaps: JsonObject[] = [
    {
      gapId,
      ownerPath,
      summary: "No attached TypeScript dependency policy API receipt for this evidence graph.",
      severity: "warning",
      fields: { requiredReceiptId: "typescript.policy.api" },
    },
  ];
  return {
    schemaId: EVIDENCE_GRAPH_SCHEMA_ID,
    schemaVersion: "1",
    protocolId: EVIDENCE_GRAPH_PROTOCOL_ID,
    protocolVersion: "1",
    graphId: "typescript.evidence.graph",
    producer: producer(),
    project: project(root),
    summary: summary(nodes, edges, gaps),
    nodes,
    edges,
    gaps,
    fields: {
      next: "pipe JSON to `asp graph render --packet - --view seeds`",
    },
  };
}

export function renderTypeScriptEvidenceGraph(graph: JsonObject): string {
  const graphSummary = graph.summary as Record<string, number>;
  return (
    `evidence-graph nodes=${graphSummary.nodes} edges=${graphSummary.edges} ` +
    `owners=${graphSummary.owners} claims=${graphSummary.claims} ` +
    `stale-items=${graphSummary.staleItems} gaps=${graphSummary.gaps}\n`
  );
}

export function renderTypeScriptEvidenceGraphJson(projectRoot: string): string {
  return `${JSON.stringify(buildTypeScriptEvidenceGraph(projectRoot))}\n`;
}

export function buildTypeScriptEvidenceAnalysisRequest(projectRoot: string): JsonObject {
  const graph = buildTypeScriptEvidenceGraph(projectRoot);
  const analysisGraph = toAnalysisGraph(graph);
  const graphSummary = graph.summary as Record<string, number>;
  const requestSummary = {
    graphs: 1,
    nodes: graphSummary.nodes,
    edges: graphSummary.edges,
    owners: graphSummary.owners,
    claims: graphSummary.claims,
    staleItems: graphSummary.staleItems,
    gaps: graphSummary.gaps,
  };
  return {
    schemaId: GRAPH_TURBO_REQUEST_SCHEMA_ID,
    schemaVersion: "1",
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: "1",
    packetKind: "graph-turbo-request",
    requestId: `typescript.evidence.analysis.graphs-${requestSummary.graphs}.nodes-${requestSummary.nodes}.gaps-${requestSummary.gaps}`,
    surface: "evidence-analyze",
    queryTerms: ["typescript evidence quality"],
    profile: "evidence-quality",
    algorithm: "typed-ppr-diverse",
    seedIds: analysisSeedIds(analysisGraph),
    budget: 8,
    producer: producer(),
    project: analysisProject(path.resolve(projectRoot)),
    summary: requestSummary,
    graphs: [analysisGraph],
    fields: {
      next: "pipe JSON to `asp graph render --packet - --view seeds`",
    },
  };
}

export function renderTypeScriptEvidenceAnalysisRequest(request: JsonObject): string {
  const requestSummary = request.summary as Record<string, number>;
  return (
    `evidence-analysis profile=${String(request.profile)} graphs=${requestSummary.graphs} ` +
    `nodes=${requestSummary.nodes} edges=${requestSummary.edges} ` +
    `owners=${requestSummary.owners} claims=${requestSummary.claims} ` +
    `stale-items=${requestSummary.staleItems} gaps=${requestSummary.gaps} ` +
    'next="asp graph render --packet - --view seeds"\n'
  );
}

export function renderTypeScriptEvidenceAnalysisRequestJson(projectRoot: string): string {
  return `${JSON.stringify(buildTypeScriptEvidenceAnalysisRequest(projectRoot))}\n`;
}

function toAnalysisGraph(graph: JsonObject): JsonObject {
  return {
    graphId: graph.graphId,
    summary: graph.summary,
    nodes: (graph.nodes as JsonObject[]).map(analysisNode),
    edges: (graph.edges as JsonObject[]).map(analysisEdge),
    gaps: graph.gaps,
  };
}

function analysisNode(node: JsonObject): JsonObject {
  const location =
    typeof node.location === "object" && node.location !== null
      ? (node.location as JsonObject)
      : {};
  const ownerPath = node.ownerPath as string | undefined;
  const locationPath = location.path as string | undefined;
  const rendered: JsonObject = {
    id: node.nodeId,
    kind: node.kind,
    role: nodeRole(String(node.kind)),
    value: node.label,
    fields: { ...((node.fields as JsonObject | undefined) ?? {}) },
  };
  const pathValue = ownerPath ?? locationPath;
  if (pathValue !== undefined) {
    rendered.path = pathValue;
    rendered.ownerPath = ownerPath ?? pathValue;
  }
  if (typeof location.line === "number" && pathValue !== undefined) {
    rendered.locator = `${pathValue}:${location.line}:${location.line}`;
    rendered.startLine = location.line;
    rendered.endLine = location.line;
  }
  const fields = rendered.fields as JsonObject;
  for (const key of ["candidateId", "receiptId", "actionId", "summary", "status"]) {
    if (node[key] !== undefined) fields[key] = String(node[key]);
  }
  return rendered;
}

function analysisEdge(edgeValue: JsonObject): JsonObject {
  return {
    source: edgeValue.fromNodeId,
    target: edgeValue.toNodeId,
    relation: edgeValue.kind,
    fields: { edgeId: edgeValue.edgeId },
  };
}

function analysisSeedIds(graph: JsonObject): string[] {
  const nodes = graph.nodes as JsonObject[];
  const seeds = nodes.filter((node) => node.kind === "owner").map((node) => String(node.id));
  if (seeds.length > 0) return seeds;
  return nodes.length > 0 ? [String(nodes[0]!.id)] : [];
}

function producer(): JsonObject {
  return {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
  };
}

function project(root: string): JsonObject {
  const packageName = packageNameForRoot(root);
  return {
    root,
    ...(packageName === undefined ? {} : { package: packageName }),
    fields: {},
  };
}

function analysisProject(root: string): JsonObject {
  return {
    root,
    package: packageNameForRoot(root) ?? null,
    fields: {},
  };
}

function summary(nodes: JsonObject[], edges: JsonObject[], gaps: JsonObject[]): JsonObject {
  return {
    nodes: nodes.length,
    edges: edges.length,
    owners: nodes.filter((node) => node.kind === "owner").length,
    claims: nodes.filter((node) => node.kind === "invariant-candidate").length,
    staleItems: nodes.filter((node) => node.status === "stale" || node.status === "expired").length,
    gaps: gaps.length,
  };
}

function edge(edgeId: string, kind: string, fromNodeId: string, toNodeId: string): JsonObject {
  return { edgeId, kind, fromNodeId, toNodeId };
}

function nodeRole(kind: string): string {
  if (kind === "owner") return "path";
  if (kind === "invariant-candidate") return "claim";
  if (kind === "verification-receipt") return "receipt";
  if (kind === "review-action") return "action";
  return "evidence";
}

function selectOwnerPath(root: string): string {
  for (const candidate of ["package.json", "tsconfig.json"]) {
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }
  for (const sourceRoot of ["src", "."]) {
    const base = path.join(root, sourceRoot);
    if (!fs.existsSync(base)) continue;
    const found = firstSourceFile(root, base);
    if (found !== undefined) return found;
  }
  return ".";
}

function firstSourceFile(root: string, directory: string): string | undefined {
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const nested = firstSourceFile(root, entryPath);
      if (nested !== undefined) return nested;
    } else if (/\.[cm]?tsx?$/u.test(entry.name)) {
      return slashPath(path.relative(root, entryPath));
    }
  }
  return undefined;
}

function packageNameForRoot(root: string): string | undefined {
  const manifest = path.join(root, "package.json");
  if (!fs.existsSync(manifest)) return undefined;
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8")) as { readonly name?: unknown };
    return typeof value.name === "string" && value.name.length > 0 ? value.name : undefined;
  } catch {
    return undefined;
  }
}

function nodeId(prefix: string, raw: string): string {
  return `${prefix}:${sanitizeIdPart(raw)}`;
}

function sanitizeIdPart(raw: string): string {
  let output = "";
  for (const character of raw) {
    output += /^[A-Za-z0-9._:-]$/u.test(character) ? character.toLowerCase() : ".";
  }
  while (output.includes("..")) output = output.replaceAll("..", ".");
  const trimmed = output.replace(/^\.+|\.+$/gu, "");
  return trimmed.length > 0 ? trimmed : "root";
}

function slashPath(value: string): string {
  return value.split(path.sep).join("/");
}
