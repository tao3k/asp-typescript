/**
 * CLI renderer for TypeScript graph-turbo provider facts.
 */
import {
  collectLocatedSemanticGraphFieldFacts,
  type LocatedTypeScriptSemanticGraphFieldFact,
} from "../parser/semantic_graph_facts.js";
import { collectTypeScriptSemanticGraphProjectFact } from "../parser/semantic_graph_project_facts.js";
import { projectGraphPayload } from "./semantic-graph-project-facts.js";

const LANGUAGE_ID = "typescript" as const;
const PROVIDER_ID = "ts-harness" as const;
const PROVENANCE = "parser" as const;
const CONFIDENCE = "exact" as const;
const FRESHNESS = "fresh" as const;

export type ProviderGraphNodeKind =
  | "build"
  | "collection"
  | "dependency"
  | "field"
  | "package"
  | "test"
  | "type";

export interface ProviderGraphNode {
  readonly id: string;
  readonly kind: ProviderGraphNodeKind;
  readonly role: string;
  readonly value: string;
  readonly action: string;
  readonly path?: string;
  readonly ownerPath?: string;
  readonly symbol?: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly locator?: string;
  readonly matchText?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export interface ProviderGraphEdge {
  readonly source: string;
  readonly target: string;
  readonly relation: string;
}

export interface ProviderGraphFactsPayload {
  readonly schemaId: "agent.semantic-protocols.semantic-fact-graph";
  readonly schemaVersion: "1";
  readonly protocolId: "agent.semantic-protocols.semantic-language";
  readonly protocolVersion: "1";
  readonly languageId: typeof LANGUAGE_ID;
  readonly providerId: typeof PROVIDER_ID;
  readonly projectRoot: string;
  readonly query: string;
  readonly nodes: readonly ProviderGraphNode[];
  readonly edges: readonly ProviderGraphEdge[];
}

export function renderTypeScriptSemanticGraphFactsJson(
  projectRoot: string,
  query: string,
  stdin: string,
): string {
  return `${JSON.stringify(buildTypeScriptSemanticGraphFacts(projectRoot, query, stdin))}\n`;
}

export function buildTypeScriptSemanticGraphFacts(
  projectRootInput: string,
  query: string,
  stdin: string,
): ProviderGraphFactsPayload {
  const facts = collectLocatedSemanticGraphFieldFacts(projectRootInput, stdin)
    .filter((fact) => factMatchesQuery(fact, query))
    .slice(0, 64);
  return graphPayload(
    projectRootInput,
    query,
    facts,
    projectGraphPayload(collectTypeScriptSemanticGraphProjectFact(projectRootInput)),
  );
}

function graphPayload(
  projectRoot: string,
  query: string,
  facts: readonly LocatedTypeScriptSemanticGraphFieldFact[],
  projectFacts: {
    readonly nodes: readonly ProviderGraphNode[];
    readonly edges: readonly ProviderGraphEdge[];
  },
): ProviderGraphFactsPayload {
  const nodes: ProviderGraphNode[] = [];
  const edges: ProviderGraphEdge[] = [];
  const collectionIds = new Set<string>();
  for (const fact of facts) {
    const fieldId = fieldIdFor(fact);
    const typeId = typeIdFor(fact);
    const locator = `${fact.path}:${fact.line}:${fact.line}`;
    const fields = graphFields(fact);
    nodes.push(fieldNode(fact, fieldId, locator, fields));
    nodes.push(typeNode(fact, typeId, locator, fields));
    edges.push({ source: fieldId, target: typeId, relation: "has_type" });
    appendCollection(nodes, edges, collectionIds, fact, fieldId, typeId);
    if (query.trim().length > 0) {
      edges.push({ source: stableId("query", query), target: fieldId, relation: "matches" });
    }
  }
  return {
    schemaId: "agent.semantic-protocols.semantic-fact-graph",
    schemaVersion: "1",
    protocolId: "agent.semantic-protocols.semantic-language",
    protocolVersion: "1",
    languageId: LANGUAGE_ID,
    providerId: PROVIDER_ID,
    projectRoot,
    query,
    nodes: [...nodes, ...projectFacts.nodes],
    edges: [...edges, ...projectFacts.edges, ...packageBridgeEdges(nodes, projectFacts.nodes)],
  };
}

function packageBridgeEdges(
  nodes: readonly ProviderGraphNode[],
  projectNodes: readonly ProviderGraphNode[],
): readonly ProviderGraphEdge[] {
  const packageNode = projectNodes.find((node) => node.kind === "package");
  if (packageNode === undefined) return [];
  return nodes
    .filter((node) => ["field", "hot", "owner"].includes(node.kind))
    .map((node) => ({ source: node.id, target: packageNode.id, relation: "belongs_to" }));
}

function graphFields(
  fact: LocatedTypeScriptSemanticGraphFieldFact,
): Readonly<Record<string, unknown>> {
  const family = collectionFamily(fact.collectionKind);
  return {
    languageId: LANGUAGE_ID,
    providerId: PROVIDER_ID,
    semanticFactKind: "field",
    provenance: PROVENANCE,
    confidence: CONFIDENCE,
    freshness: FRESHNESS,
    containerKind: fact.containerKind,
    containerName: fact.containerName,
    fieldName: fact.fieldName,
    typeValue: fact.typeValue,
    elementShape: fact.collectionKind === undefined ? "scalar" : "collection",
    contextLocator: `${fact.path}:${fact.contextStartLine}:${fact.contextEndLine}`,
    contextStartLine: fact.contextStartLine,
    contextEndLine: fact.contextEndLine,
    field: fieldFact(fact),
    ...(fact.collectionKind === undefined
      ? {}
      : {
          collectionKind: fact.collectionKind,
          collectionFamily: family,
          collectionImpl: fact.collectionKind,
        }),
  };
}

function fieldNode(
  fact: LocatedTypeScriptSemanticGraphFieldFact,
  fieldId: string,
  locator: string,
  fields: Readonly<Record<string, unknown>>,
): ProviderGraphNode {
  return {
    id: fieldId,
    kind: "field",
    role: `${fact.containerKind}-field`,
    value: `${fact.fieldName}: ${fact.typeValue}`,
    action: "code",
    path: fact.path,
    ownerPath: fact.path,
    symbol: fact.fieldName,
    startLine: fact.line,
    endLine: fact.line,
    locator,
    matchText: `${fact.containerName}.${fact.fieldName}: ${fact.typeValue}`,
    fields,
  };
}

function typeNode(
  fact: LocatedTypeScriptSemanticGraphFieldFact,
  typeId: string,
  locator: string,
  fields: Readonly<Record<string, unknown>>,
): ProviderGraphNode {
  const typeFields: Record<string, unknown> = { ...fields };
  delete typeFields.field;
  return {
    id: typeId,
    kind: "type",
    role: "field-type",
    value: fact.typeValue,
    action: "evidence",
    path: fact.path,
    ownerPath: fact.path,
    symbol: typeSymbol(fact.typeValue),
    startLine: fact.line,
    endLine: fact.line,
    locator,
    fields: {
      ...typeFields,
      semanticFactKind: "type",
      type: typeFact(fact),
    },
  };
}

function appendCollection(
  nodes: ProviderGraphNode[],
  edges: ProviderGraphEdge[],
  collectionIds: Set<string>,
  fact: LocatedTypeScriptSemanticGraphFieldFact,
  fieldId: string,
  typeId: string,
): void {
  if (fact.collectionKind === undefined) return;
  const collectionId = `collection:${fact.collectionKind}`;
  if (!collectionIds.has(collectionId)) {
    collectionIds.add(collectionId);
    nodes.push({
      id: collectionId,
      kind: "collection",
      role: "family",
      value: fact.collectionKind,
      action: "evidence",
      symbol: fact.collectionKind,
      fields: {
        languageId: LANGUAGE_ID,
        providerId: PROVIDER_ID,
        semanticFactKind: "collection",
        provenance: PROVENANCE,
        confidence: CONFIDENCE,
        freshness: FRESHNESS,
        collectionKind: fact.collectionKind,
        collectionFamily: collectionFamily(fact.collectionKind),
        collectionImpl: fact.collectionKind,
        collection: collectionFact(fact),
      },
    });
  }
  edges.push({ source: fieldId, target: collectionId, relation: "collection_of" });
  edges.push({ source: typeId, target: collectionId, relation: "collection_of" });
}

function fieldFact(
  fact: LocatedTypeScriptSemanticGraphFieldFact,
): Readonly<Record<string, unknown>> {
  return {
    ownerKind: fieldOwnerKind(fact.containerKind),
    name: fact.fieldName,
    ownerPath: fact.path,
    access: accessModes(fact.collectionKind),
  };
}

function typeFact(
  fact: LocatedTypeScriptSemanticGraphFieldFact,
): Readonly<Record<string, unknown>> {
  return { name: fact.typeValue };
}

function collectionFact(
  fact: LocatedTypeScriptSemanticGraphFieldFact,
): Readonly<Record<string, unknown>> {
  return {
    family: collectionFamily(fact.collectionKind),
    impl: fact.collectionKind ?? "unknown",
    mutation: mutationModes(fact.collectionKind),
  };
}

function fieldOwnerKind(containerKind: string): string {
  return containerKind === "type" ? "object" : containerKind;
}

function collectionFamily(collectionKind: string | undefined): string | undefined {
  if (collectionKind === undefined) return undefined;
  if (collectionKind === "map" || collectionKind === "record") return "map";
  if (collectionKind === "set") return "set";
  return "sequence";
}

function accessModes(collectionKind: string | undefined): readonly string[] {
  if (collectionKind === undefined) return ["read", "write", "validate"];
  if (collectionKind === "map" || collectionKind === "record") {
    return ["read", "write", "validate"];
  }
  if (collectionKind === "tuple") return ["read", "validate"];
  return ["read", "append", "validate"];
}

function mutationModes(collectionKind: string | undefined): readonly string[] {
  if (collectionKind === undefined || collectionKind === "tuple") return [];
  if (collectionKind === "map" || collectionKind === "record") {
    return ["insert", "update", "remove"];
  }
  if (collectionKind === "set") return ["insert", "remove"];
  return ["append", "insert", "remove"];
}

function factMatchesQuery(fact: LocatedTypeScriptSemanticGraphFieldFact, query: string): boolean {
  const terms = queryTerms(query);
  if (terms.length === 0) return true;
  const shapeTerms = new Set([
    "field",
    "fields",
    "type",
    "types",
    "collection",
    "collections",
    "scalar",
    "scalars",
  ]);
  const collectionTerms = new Set([
    "array",
    "arrays",
    "list",
    "lists",
    "map",
    "maps",
    "set",
    "sets",
    "record",
    "records",
    "tuple",
    "tuples",
  ]);
  const contextTerms = new Set([
    "concurrency",
    "concurrent",
    "cancellation",
    "interruption",
    "resource",
    "resources",
    "leak",
    "leaks",
    "queue",
    "queues",
    "stream",
    "streams",
    "scope",
    "scopes",
    "fiber",
    "fibers",
  ]);
  const haystack = [
    fact.path,
    fact.containerKind,
    fact.containerName,
    fact.fieldName,
    fact.typeValue,
    fact.collectionKind ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const hasContextTerm = terms.some((term) => contextTerms.has(term));
  const textTerms = terms.filter(
    (term) => !shapeTerms.has(term) && !collectionTerms.has(term) && !contextTerms.has(term),
  );
  if (
    textTerms.length > 0 &&
    !hasContextTerm &&
    !textTerms.some((term) => haystack.includes(term))
  ) {
    return false;
  }
  if (terms.some((term) => term === "collection" || term === "collections")) {
    return fact.collectionKind !== undefined;
  }
  if (terms.some((term) => term === "scalar" || term === "scalars")) {
    return fact.collectionKind === undefined;
  }
  return terms.every((term) => {
    if (term === "array" || term === "arrays" || term === "list" || term === "lists") {
      return fact.collectionKind === "array";
    }
    if (term === "map" || term === "maps") return fact.collectionKind === "map";
    if (term === "set" || term === "sets") return fact.collectionKind === "set";
    if (term === "record" || term === "records") return fact.collectionKind === "record";
    if (term === "tuple" || term === "tuples") return fact.collectionKind === "tuple";
    return true;
  });
}

function fieldIdFor(fact: LocatedTypeScriptSemanticGraphFieldFact): string {
  return stableId(
    "field",
    `${fact.path}:${fact.containerKind}:${fact.containerName}:${fact.fieldName}:${fact.line}`,
  );
}

function typeIdFor(fact: LocatedTypeScriptSemanticGraphFieldFact): string {
  return stableId("type", `${fact.path}:${fact.fieldName}:${fact.typeValue}:${fact.line}`);
}

function typeSymbol(typeValue: string): string {
  const candidate = typeValue.split(/[<[\s|&]/u, 1)[0] ?? "";
  return candidate.length > 0 ? candidate : typeValue;
}

function stableId(kind: string, value: string): string {
  const rendered = [...value].map((character) => {
    if (/^[A-Za-z0-9]$/u.test(character)) return character.toLowerCase();
    if (["/", ".", "_", "-"].includes(character)) return character;
    return "-";
  });
  return `${kind}:${rendered.join("").replace(/^-+|-+$/gu, "")}`;
}

function queryTerms(query: string): string[] {
  return query
    .split(/[^A-Za-z0-9_]+/u)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}
