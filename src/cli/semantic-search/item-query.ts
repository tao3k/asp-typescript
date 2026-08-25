/**
 * Builds parser-owned owner item query packets for the TypeScript search CLI.
 *
 * This module owns compact item inventories, semantic query packets, and the
 * owner search packet projection. Direct source-read windows live in
 * item-read.ts so query packet construction stays focused on item selection.
 */
import {
  queryTypeScriptOwnerItems,
  type TypeScriptItemQueryMatch,
} from "../../parser/native_syntax/item-query.js";
import {
  SEMANTIC_LANGUAGE_PROTOCOL_ID,
  SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
  SEMANTIC_QUERY_PACKET_SCHEMA_ID,
  SEMANTIC_SEARCH_PACKET_SCHEMA_ID,
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
} from "../semantic-language.js";
import type { SemanticSearchItem, SemanticSearchPacket } from "./types.js";

export type OwnerItemQueryOutputMode = "code" | "names";

export interface SemanticQueryPacket {
  readonly schemaId: typeof SEMANTIC_QUERY_PACKET_SCHEMA_ID;
  readonly schemaVersion: "1";
  readonly protocolId: typeof SEMANTIC_LANGUAGE_PROTOCOL_ID;
  readonly protocolVersion: typeof SEMANTIC_LANGUAGE_PROTOCOL_VERSION;
  readonly languageId: typeof TYPE_SCRIPT_LANGUAGE_ID;
  readonly providerId: typeof TYPE_SCRIPT_PROVIDER_ID;
  readonly binary: typeof TYPE_SCRIPT_BINARY;
  readonly namespace: typeof TYPE_SCRIPT_PROVIDER_NAMESPACE;
  readonly digestAlgorithm: "typescript-source-fingerprint-v1";
  readonly parserIdentityDigest: string;
  readonly sourceSnapshotEnvelope?: string;
  readonly queryPackDigest: string;
  readonly sourceBlobDigest: string;
  readonly parserFactDigest: string;
  readonly structuralSelector: string;
  readonly projectionMode: "code" | "names";
  readonly projectionEncoding: "base64";
  readonly projectionPayloadBase64: string;
  readonly method: "query/owner-items";
  readonly projectRoot: string;
  readonly ownerPath: string;
  readonly query: string;
  readonly queryTerms: readonly string[];
  readonly matchMode: "exact" | "fallback-contains" | "mixed" | "unknown";
  readonly outputMode: OwnerItemQueryOutputMode;
  readonly patchSafety: SemanticQueryPatchSafety;
  readonly queryCoverage: readonly SemanticQueryCoverage[];
  readonly matches: readonly SemanticQueryMatch[];
  readonly syntaxQueryRef?: string;
  readonly syntaxMatchRefs?: readonly string[];
  readonly syntaxCaptureRefs?: readonly string[];
  readonly syntaxAnchor?: SemanticQuerySyntaxAnchor;
  readonly truncated: boolean;
  readonly notes?: readonly SemanticQueryNote[];
}

interface SemanticQuerySyntaxAnchor {
  readonly nodeType: string;
  readonly field?: string;
  readonly capture?: string;
  readonly location: {
    readonly path: string;
    readonly lineRange: string;
  };
}

interface SemanticQueryPatchSafety {
  readonly level: "navigation-safe" | "read-safe" | "patch-verify-safe" | "ast-patch-safe";
  readonly reason: string;
  readonly nextAction?: string;
  readonly exactRead?: string;
}

interface SemanticQueryCoverage {
  readonly value: string;
  readonly status: "hit" | "miss" | "partial";
  readonly match: "exact" | "fallback-contains" | "candidate" | "none";
  readonly matchCount: number;
  readonly nextAction?: string;
}

interface SemanticQueryProjection {
  readonly mode: "compact" | "names" | "outline" | "exact";
  readonly syntax:
    | "brace-block"
    | "token-compact"
    | "semantic-outline"
    | "save-token-typescript"
    | "exact-source"
    | "none";
  readonly sourceAuthority: "native-parser" | "parser-index" | "source-range";
  readonly compactSafety?: SemanticQueryCompactSafety;
  readonly sourceFingerprint?: string;
  readonly losslessStructure?: boolean;
  readonly exactRead?: string;
  readonly nodes?: readonly SemanticQueryProjectionNode[];
  readonly renderedNodeIds?: readonly string[];
  readonly renderedRows?: readonly SemanticQueryProjectionRenderedRow[];
  readonly nodeCount?: number;
  readonly nodeLimit?: number;
  readonly nodesTruncated?: boolean;
  readonly omitted?: readonly SemanticQueryProjectionOmission[];
  readonly expandActions?: readonly SemanticQueryExpandAction[];
}

interface SemanticQueryCompactSafety {
  readonly literalPolicy: "preserve" | "summarize" | "omit";
  readonly whitespacePolicy:
    | "syntax-trivia-only"
    | "semantic-outline"
    | "formatter-structural"
    | "exact-source";
  readonly normalization?: "none" | "formatter-assisted";
  readonly alignment?: "not-required" | "parser-roundtrip" | "formatter-roundtrip";
  readonly exactReadRequired: boolean;
}

interface SemanticQueryProjectionNode {
  readonly id: string;
  readonly parentId?: string;
  readonly nativeId?: string | undefined;
  readonly structuralFingerprint?: string | undefined;
  readonly kind: string;
  readonly role?:
    | "declaration"
    | "field"
    | "control-flow"
    | "call"
    | "terminal"
    | "delimiter"
    | "mutation"
    | "effect"
    | "unknown";
  readonly label: string;
  readonly depth?: number;
  readonly read: string;
  readonly flags?: readonly string[];
}

interface SemanticQueryProjectionRenderedRow {
  readonly nodeId: string;
  readonly rowKind:
    | "declaration"
    | "field"
    | "control-flow"
    | "call"
    | "terminal"
    | "delimiter"
    | "mutation"
    | "effect"
    | "unknown";
  readonly text: string;
  readonly semanticWeight?: number;
}

interface SemanticQueryProjectionOmission {
  readonly kind: string;
  readonly reason: string;
  readonly count?: number;
  readonly nodeId?: string;
  readonly read?: string;
}

interface SemanticQueryExpandAction {
  readonly kind: "exact-read" | "node-query" | "hot-block" | "owner-names";
  readonly target: string;
  readonly read?: string;
  readonly capabilityId?: string;
  readonly selector?: string;
  readonly languageId?: string;
  readonly workspacePolicy?: string;
  readonly reason?: string;
}

interface SemanticQueryMatch {
  readonly name: string;
  readonly kind: string;
  readonly visibility: "public" | "private" | "unknown";
  readonly location: {
    readonly path: string;
    readonly lineRange: string;
  };
  readonly read: string;
  readonly patchSafety: SemanticQueryPatchSafety;
  readonly code?: string;
  readonly projection?: SemanticQueryProjection;
  readonly truncated: boolean;
  readonly fields: {
    readonly exported: boolean;
    readonly typeOnly: boolean;
    readonly exportKind: string;
  };
}

interface SemanticQueryNote {
  readonly kind: string;
  readonly message: string;
}

export function renderOwnerItemQuery(
  projectRoot: string,
  ownerPath: string,
  itemQuery: string,
  options: { readonly namesOnly?: boolean } = {},
): string {
  const result = queryTypeScriptOwnerItems(projectRoot, ownerPath, itemQuery);
  const matchMode = ownerItemQueryMatchMode(result.matches, result.queryTerms, result.fallback);
  const namesOnly =
    options.namesOnly === true || ownerItemQueryShouldAutoNamesOnly(result, matchMode);
  const revisionField = ownerItemQueryRevisionField(result);
  const nextAction = ownerItemQueryNextAction(result, namesOnly);
  const lines = [
    `[query-item] q=${result.ownerPath} pkg=. own=1 item=${result.matches.length} itemQuery=${fieldValue(
      result.queryTerms.join("|"),
    )}${namesOnly ? " output=names" : ""}${
      result.fallback === undefined ? "" : " fallback=owner-top-items"
    }`,
    `|query itemQuery=${fieldValue(result.queryTerms.join("|"))} status=${
      result.fallback === undefined ? "hit" : "miss"
    } match=${matchMode} item=${result.matches.length} reason=parser-item-query${
      namesOnly ? " output=names" : ""
    }${revisionField} next=${nextAction}`,
    `|owner ${result.ownerPath} role=source source=parser-visible-module next=owner:${result.ownerPath}`,
  ];
  for (const item of result.matches) {
    const itemFields = [
      `owner=${result.ownerPath}`,
      `column=${item.column}`,
      item.exported ? "exported=true" : "",
      item.typeOnly ? "typeOnly=true" : "",
      `read=${result.ownerPath}:${item.lineStart}:${item.lineEnd}`,
    ].filter((field) => field.length > 0);
    lines.push(`|item ${item.kind} ${item.name} ${itemFields.join(" ")}`);
    if (namesOnly) continue;
  }
  return lines.join("\n");
}

function ownerItemQueryShouldAutoNamesOnly(
  result: {
    readonly queryTerms: readonly string[];
    readonly matches: readonly { readonly name: string }[];
    readonly fallback?: "owner-top-items";
  },
  matchMode: SemanticQueryPacket["matchMode"],
): boolean {
  if (result.fallback !== undefined) return true;
  if (result.matches.length > 3) return true;
  return result.queryTerms.length > 1 && matchMode !== "exact";
}

function ownerItemQueryNextAction(
  result: {
    readonly matches: readonly { readonly name: string }[];
    readonly fallback?: "owner-top-items";
  },
  namesOnly: boolean,
): "query-code" | "revise-query" | "select-item" {
  if (result.fallback !== undefined) return "revise-query";
  if (namesOnly && result.matches.length > 1) return "select-item";
  return "query-code";
}

function ownerItemQueryRevisionField(result: {
  readonly queryTerms: readonly string[];
  readonly matches: readonly { readonly name: string }[];
}): string {
  const revisions = result.queryTerms.flatMap((term) => {
    if (result.matches.some((item) => item.name === term)) return [];

    const normalizedTerm = normalizeItemQueryName(term);
    if (normalizedTerm.length === 0) return [];

    const candidate = result.matches.find((item) => {
      const normalizedName = normalizeItemQueryName(item.name);
      return normalizedName.includes(normalizedTerm) || normalizedTerm.includes(normalizedName);
    });

    return candidate === undefined ? [] : [`${term}->${candidate.name}`];
  });

  return revisions.length === 0 ? "" : ` revise=${fieldValue(revisions.join(","))}`;
}

function normalizeItemQueryName(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, "").toLowerCase();
}

function compactTypeScriptCodeProjection(code: string): string {
  return code
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

function semanticOutlineCode(item: TypeScriptItemQueryMatch): string {
  if (item.projectionNodes.length === 0) return compactTypeScriptCodeProjection(item.code);
  return compactProjectionRowTexts(item.projectionNodes).join("\n");
}

function compactProjectionRowTexts(
  nodes: readonly { readonly depth?: number; readonly label: string }[],
): readonly string[] {
  return compactRenderedProjectionEntries(nodes).map(({ text }) => text);
}

function compactRenderedProjectionEntries<
  T extends { readonly id?: string; readonly depth?: number; readonly label: string },
>(nodes: readonly T[]): readonly { readonly node: T; readonly text: string }[] {
  const entries: { node: T; text: string }[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const text = compactRenderedRowText(node);
    const trimmed = text.trim();
    const key = node.id ?? trimmed;
    if (trimmed.length === 0 || seen.has(key)) continue;
    seen.add(key);
    entries.push({ node, text });
  }
  return entries;
}

function compactRenderedRowText(node: { readonly depth?: number; readonly label: string }): string {
  return `${"  ".repeat(node.depth ?? 0)}${node.label}`.trimEnd();
}

function compactProjection(
  ownerPath: string,
  item: TypeScriptItemQueryMatch,
): SemanticQueryProjection {
  const exactRead = `${ownerPath}:${item.lineStart}:${item.lineEnd}`;
  const compactCode = semanticOutlineCode(item);
  const nodes = compactProjectionNodes(item, ownerPath, exactRead, compactCode);
  return {
    mode: "compact",
    syntax: "save-token-typescript",
    sourceAuthority: "native-parser",
    compactSafety: {
      literalPolicy: "summarize",
      whitespacePolicy: "formatter-structural",
      normalization: "none",
      alignment: "parser-roundtrip",
      exactReadRequired: true,
    },
    sourceFingerprint: sourceFingerprint(exactRead, item.code),
    losslessStructure: true,
    exactRead,
    nodes,
    renderedNodeIds: compactRenderedNodeIds(nodes),
    renderedRows: compactRenderedRows(nodes),
    nodeCount: nodes.length,
    nodeLimit: 32,
    nodesTruncated: false,
    omitted: compactProjectionOmissions(item, exactRead, compactCode, projectionNodeId(item.name)),
    expandActions: compactExpandActions(item.name, exactRead, nodes),
  };
}

function compactRenderedNodeIds(nodes: readonly SemanticQueryProjectionNode[]): readonly string[] {
  return compactRenderedProjectionEntries(nodes).map(({ node }) => node.id);
}

function compactRenderedRows(
  nodes: readonly SemanticQueryProjectionNode[],
): readonly SemanticQueryProjectionRenderedRow[] {
  return compactRenderedProjectionEntries(nodes).map(({ node, text }) => ({
    nodeId: node.id,
    rowKind: compactRenderedRowKind(node.role),
    text,
    semanticWeight: compactRenderedRowWeight(node.role),
  }));
}

function compactRenderedRowKind(
  role: SemanticQueryProjectionNode["role"],
): SemanticQueryProjectionRenderedRow["rowKind"] {
  switch (role) {
    case "declaration":
    case "field":
    case "control-flow":
    case "call":
    case "terminal":
    case "delimiter":
    case "mutation":
    case "effect":
      return role;
    default:
      return "unknown";
  }
}

function compactRenderedRowWeight(role: SemanticQueryProjectionNode["role"]): number {
  switch (role) {
    case "control-flow":
    case "call":
    case "terminal":
    case "mutation":
    case "effect":
      return 2;
    default:
      return 1;
  }
}

function compactProjectionNodes(
  item: TypeScriptItemQueryMatch,
  ownerPath: string,
  exactRead: string,
  compactCode: string,
): readonly SemanticQueryProjectionNode[] {
  if (item.projectionNodes.length > 0) {
    return item.projectionNodes.map((node) => ({
      id: node.id,
      ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
      nativeId: node.nativeId,
      structuralFingerprint: node.structuralFingerprint,
      kind: node.kind,
      role: node.role,
      label: node.label,
      depth: node.depth,
      read: `${ownerPath}:${node.lineStart}:${node.lineEnd}`,
      ...(node.flags.length === 0 ? {} : { flags: node.flags }),
    }));
  }
  const flags = compactProjectionFlags(compactCode);
  const nodes: SemanticQueryProjectionNode[] = [
    {
      id: projectionNodeId(item.name),
      kind: item.kind,
      role: "declaration",
      label: item.name,
      depth: 0,
      read: exactRead,
      ...(flags.length === 0 ? {} : { flags }),
    },
  ];
  if (/\b(if|switch|case|for|while|try|catch)\b/u.test(compactCode)) {
    nodes.push({
      id: `${projectionNodeId(item.name)}:flow`,
      parentId: projectionNodeId(item.name),
      kind: "control-flow",
      role: "control-flow",
      label: "control flow",
      depth: 1,
      read: exactRead,
      flags: compactControlFlowFlags(compactCode),
    });
  }
  if (/\breturn\b/u.test(compactCode)) {
    nodes.push({
      id: `${projectionNodeId(item.name)}:return`,
      parentId: projectionNodeId(item.name),
      kind: "return",
      role: "terminal",
      label: "return",
      depth: 1,
      read: exactRead,
      flags: ["return"],
    });
  }
  return nodes;
}

function compactProjectionOmissions(
  item: TypeScriptItemQueryMatch,
  exactRead: string,
  compactCode: string,
  nodeId: string,
): readonly SemanticQueryProjectionOmission[] {
  const lineCount = item.lineEnd - item.lineStart + 1;
  const omitted: SemanticQueryProjectionOmission[] = [];
  if (lineCount > 1) {
    omitted.push({
      kind: "source-formatting",
      reason: "compact projection removes original whitespace and comments",
      count: lineCount,
      read: exactRead,
    });
  }
  if (compactCode.length > 900) {
    omitted.push({
      kind: "nested-detail",
      reason: "large compact item should be expanded through exact read before editing",
      read: exactRead,
    });
  }
  return omitted.map((omission) => ({ nodeId, ...omission }));
}

function compactExpandActions(
  itemName: string,
  exactRead: string,
  nodes: readonly SemanticQueryProjectionNode[],
): readonly SemanticQueryExpandAction[] {
  const actions: SemanticQueryExpandAction[] = [
    {
      kind: "exact-read",
      target: projectionNodeId(itemName),
      read: exactRead,
      reason: "read exact source before editing",
    },
  ];
  const seenReads = new Set<string>([exactRead]);
  for (const node of nodes.filter(isHotProjectionNode)) {
    if (seenReads.has(node.read)) continue;
    seenReads.add(node.read);
    actions.push({
      kind: "exact-read",
      target: node.id,
      read: node.read,
      reason: `expand ${node.kind} node before editing`,
    });
    if (actions.length >= 8) break;
  }
  return actions;
}

function ownerItemSyntaxRefs(
  ownerPath: string,
  queryTerms: readonly string[],
  matches: readonly TypeScriptItemQueryMatch[],
): Pick<
  SemanticQueryPacket,
  "syntaxQueryRef" | "syntaxMatchRefs" | "syntaxCaptureRefs" | "syntaxAnchor"
> {
  if (matches.length === 0) return {};
  const syntaxQueryRef = `semantic-tree-sitter-query/typescript-owner-items:${stableRefSegment(
    ownerPath,
  )}:${stableRefSegment(queryTerms.join("|") || "all")}`;
  const syntaxMatchRefs = matches.map((_, index) => `match:${index + 1}`);
  const syntaxCaptureRefs = matches.map((_, index) => `capture:${index + 1}`);
  const first = matches[0]!;
  return {
    syntaxQueryRef,
    syntaxMatchRefs,
    syntaxCaptureRefs,
    syntaxAnchor: {
      nodeType: treeSitterNodeTypeForItem(first.kind),
      field: "name",
      capture: treeSitterCaptureForItem(first.kind),
      location: {
        path: ownerPath,
        lineRange: `${first.lineStart}:${first.lineEnd}`,
      },
    },
  };
}

function treeSitterNodeTypeForItem(kind: string): string {
  switch (kind) {
    case "function":
      return "function_declaration";
    case "class":
      return "class_declaration";
    case "interface":
      return "interface_declaration";
    case "type":
      return "type_alias_declaration";
    case "enum":
      return "enum_declaration";
    case "variable":
      return "variable_declarator";
    default:
      return "identifier";
  }
}

function treeSitterCaptureForItem(kind: string): string {
  switch (kind) {
    case "function":
      return "function.name";
    case "class":
      return "class.name";
    case "interface":
      return "interface.name";
    case "type":
      return "type.name";
    case "enum":
      return "enum.name";
    case "variable":
      return "variable.name";
    default:
      return "identifier.name";
  }
}

function stableRefSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]+/gu, "_");
}

function isHotProjectionNode(node: SemanticQueryProjectionNode): boolean {
  return (
    node.role === "control-flow" ||
    node.role === "terminal" ||
    node.role === "call" ||
    node.role === "mutation" ||
    node.role === "effect"
  );
}

function compactProjectionFlags(compactCode: string): readonly string[] {
  const flags = new Set<string>();
  if (/\b(if|switch|case)\b/u.test(compactCode)) flags.add("branch");
  if (/\b(for|while)\b/u.test(compactCode)) flags.add("loop");
  if (/\breturn\b/u.test(compactCode)) flags.add("return");
  if (/\bthrow\b/u.test(compactCode)) flags.add("throw");
  if (/\bawait\b/u.test(compactCode)) flags.add("await");
  if (/\b[A-Za-z_$][\w$]*\s*\(/u.test(compactCode)) flags.add("call");
  if (/\b(let|var)\b|(?:\+\+|--|[^=!<>]=[^=>])/u.test(compactCode)) flags.add("mutation");
  return [...flags];
}

function compactControlFlowFlags(compactCode: string): readonly string[] {
  return compactProjectionFlags(compactCode).filter((flag) =>
    ["branch", "loop", "return", "throw", "await"].includes(flag),
  );
}

function sourceFingerprint(exactRead: string, code: string): string {
  return `${exactRead}:${code.length}:${hashString(code)}`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function projectionNodeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]+/gu, "_");
}

const EXACT_SELECTOR_PROJECTION_PACKET_V1 = {
  schemaId: "agent.semantic-protocols.exact-selector-projection-packet",
  schemaVersion: "1",
  digestAlgorithm: "blake3-256",
} as const;

interface ProviderSourceSnapshotEnvelopeV1 {
  readonly providerId: string;
  readonly casRoot: string;
  readonly owners: readonly {
    readonly path: string;
    readonly blobDigest: string;
    readonly sourceContentDigest: string;
    readonly casPath: string;
  }[];
}

function exactProjectionSourceBlobDigest(packet: SemanticQueryPacket): string | undefined {
  if (
    packet.sourceSnapshotEnvelope === undefined ||
    !packet.structuralSelector.includes("#item/")
  ) {
    return undefined;
  }
  const envelope = JSON.parse(
    readFileSync(packet.sourceSnapshotEnvelope, "utf8"),
  ) as ProviderSourceSnapshotEnvelopeV1;
  if (envelope.providerId !== packet.providerId) {
    throw new Error("exact-selector source snapshot provider identity mismatch");
  }
  const owner = envelope.owners.find((candidate) => candidate.path === packet.ownerPath);
  if (owner === undefined) {
    throw new Error(`exact-selector owner is absent from source snapshot: ${packet.ownerPath}`);
  }
  const liveSource = readFileSync(resolve(packet.projectRoot, packet.ownerPath));
  const snapshotSource = readFileSync(resolve(envelope.casRoot, owner.casPath));
  if (!liveSource.equals(snapshotSource)) {
    throw new Error(`exact-selector owner differs from source snapshot: ${packet.ownerPath}`);
  }
  return owner.sourceContentDigest;
}

export function renderOwnerItemSemanticQueryPacketJson(packet: SemanticQueryPacket): string {
  const sourceBlobDigest = exactProjectionSourceBlobDigest(packet);
  if (sourceBlobDigest !== undefined) {
    return JSON.stringify({
      ...EXACT_SELECTOR_PROJECTION_PACKET_V1,
      languageId: packet.languageId,
      providerId: packet.providerId,
      parserIdentityDigest: packet.parserIdentityDigest,
      queryPackDigest: packet.queryPackDigest,
      ownerPath: packet.ownerPath,
      sourceBlobDigest,
      parserFactDigest: packet.parserFactDigest,
      structuralSelector: packet.structuralSelector,
      projectionMode: packet.projectionMode,
      projectionEncoding: packet.projectionEncoding,
      projectionPayloadBase64: packet.projectionPayloadBase64,
    });
  }
  return JSON.stringify(packet);
}

export function buildOwnerItemSemanticQueryPacket(
  projectRoot: string,
  ownerPath: string,
  itemQuery: string,
  outputMode: OwnerItemQueryOutputMode,
  selector?: string,
  metadata: {
    readonly parserIdentityDigest?: string | undefined;
    readonly queryPackDigest: string | undefined;
    readonly sourceSnapshotEnvelope?: string | undefined;
  } = { queryPackDigest: undefined },
): SemanticQueryPacket {
  const result = queryTypeScriptOwnerItems(projectRoot, ownerPath, itemQuery);
  const structuralSelector = selector?.startsWith("typescript://") ? selector : undefined;
  const matches =
    structuralSelector === undefined
      ? result.matches
      : result.matches.filter(
          (item) =>
            structuralSelector ===
            `typescript://${result.ownerPath}#item/${item.kind}/${item.name}`,
        );
  const fallback = structuralSelector === undefined ? result.fallback : undefined;
  const matchMode =
    structuralSelector !== undefined && matches.length === 0
      ? "unknown"
      : ownerItemQueryMatchMode(matches, result.queryTerms, fallback);
  const syntaxRefs = ownerItemSyntaxRefs(result.ownerPath, result.queryTerms, matches);
  const queryPackDigest = hashString(
    `${TYPE_SCRIPT_PROVIDER_ID}:${TYPE_SCRIPT_LANGUAGE_ID}:${result.ownerPath}:${result.queryTerms.join("|")}:${outputMode}:${matches.length}`,
  );
  const projectionPayload = matches
    .map((item) => (outputMode === "names" ? item.name : semanticOutlineCode(item)))
    .join("\n");
  return {
    schemaId: SEMANTIC_QUERY_PACKET_SCHEMA_ID,
    schemaVersion: "1",
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    digestAlgorithm: "typescript-source-fingerprint-v1",
    parserIdentityDigest:
      metadata.parserIdentityDigest ??
      hashString(
        `${TYPE_SCRIPT_PROVIDER_ID}:${TYPE_SCRIPT_LANGUAGE_ID}:${result.ownerPath}:${result.queryTerms.join("|")}`,
      ),
    ...(metadata.sourceSnapshotEnvelope === undefined
      ? {}
      : { sourceSnapshotEnvelope: metadata.sourceSnapshotEnvelope }),
    queryPackDigest: metadata.queryPackDigest ?? queryPackDigest,
    sourceBlobDigest: hashString(
      `${result.ownerPath}:${matches.map((item) => `${item.name}:${item.lineStart}:${item.lineEnd}`).join("|")}`,
    ),
    parserFactDigest: hashString(
      `${result.ownerPath}:${matches.map((item) => `${item.kind}:${item.name}:${item.column}`).join("|")}`,
    ),
    structuralSelector: selector ?? result.ownerPath,
    projectionMode: outputMode === "names" ? "names" : "code",
    projectionEncoding: "base64",
    projectionPayloadBase64: Buffer.from(projectionPayload, "utf8").toString("base64"),
    method: "query/owner-items",
    projectRoot,
    ownerPath: result.ownerPath,
    query: result.queryTerms.join("|"),
    queryTerms: result.queryTerms,
    matchMode,
    outputMode,
    patchSafety: {
      level: "read-safe",
      reason: "compact query packet is not a mutation authority",
      nextAction: "query --from-hook direct-source-read",
    },
    queryCoverage: result.queryTerms.map((term) => ownerItemQueryCoverage(term, matches, fallback)),
    ...syntaxRefs,
    matches: matches.map((item) => {
      const read = `${result.ownerPath}:${item.lineStart}:${item.lineEnd}`;
      return {
        name: item.name,
        kind: item.kind,
        visibility: item.exported ? "public" : "private",
        location: {
          path: result.ownerPath,
          lineRange: `${item.lineStart}:${item.lineEnd}`,
        },
        read,
        patchSafety: {
          level: "read-safe",
          reason: "read exact source locator before editing this compact match",
          exactRead: read,
        },
        ...(outputMode === "names"
          ? {}
          : {
              code: semanticOutlineCode(item),
              projection: compactProjection(result.ownerPath, item),
            }),
        truncated: false,
        fields: {
          exported: item.exported,
          typeOnly: item.typeOnly,
          exportKind: item.kind,
        },
      };
    }),
    truncated: false,
    ...(fallback === undefined
      ? {}
      : {
          notes: [
            {
              kind: "owner-top-items",
              message: "item query missed; returned bounded owner top-level items",
            },
          ],
        }),
  };
}

export function buildOwnerItemQueryPacket(
  projectRoot: string,
  ownerPath: string,
  itemQuery: string,
): SemanticSearchPacket {
  const result = queryTypeScriptOwnerItems(projectRoot, ownerPath, itemQuery);
  const fallbackFields = result.fallback === undefined ? {} : { fallback: result.fallback };
  const itemQueryValue = result.queryTerms.join("|");
  return {
    schemaId: SEMANTIC_SEARCH_PACKET_SCHEMA_ID,
    schemaVersion: "1",
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    method: "search/owner",
    projectRoot,
    view: "owner",
    renderMode: "both",
    query: result.ownerPath,
    querySet: result.queryTerms.map((term) => ({
      value: term,
      kind: "symbol" as const,
      selector: "exact" as const,
      fields: { scope: "owner-item" },
    })),
    queryCoverage: result.queryTerms.map((term) => ({
      value: term,
      kind: "symbol" as const,
      selector: "exact" as const,
      status: result.fallback === undefined ? ("hit" as const) : ("miss" as const),
      hitCount: result.fallback === undefined ? result.matches.length : 0,
      ownerPaths: [result.ownerPath],
      fields: fallbackFields,
    })),
    header: {
      kind: "search-owner",
      fields: {
        q: result.ownerPath,
        pkg: ".",
        own: 1,
        item: result.matches.length,
        itemQuery: itemQueryValue,
        ...fallbackFields,
      },
    },
    nodes: [],
    edges: [],
    owners: [
      {
        path: result.ownerPath,
        role: "source",
        public: result.matches.some((item) => item.exported),
        fields: {
          source: "parser-visible-module",
          ...fallbackFields,
        },
      },
    ],
    items: result.matches.map<SemanticSearchItem>((item) => ({
      name: item.name,
      kind: semanticSearchItemKind(item.kind),
      ownerPath: result.ownerPath,
      location: {
        path: result.ownerPath,
        lineRange: `${item.lineStart}:${item.lineEnd}`,
      },
      fields: {
        exported: item.exported,
        exportKind: item.kind,
        typeOnly: item.typeOnly,
        read: `${result.ownerPath}:${item.lineStart}:${item.lineEnd}`,
        code: item.code,
        ...fallbackFields,
      },
    })),
    hits: [],
    findings: [],
    nextActions: [],
    notes:
      result.fallback === undefined
        ? []
        : [
            {
              kind: "fact-scope",
              message: "item query missed; returned bounded owner top-level items",
              fields: fallbackFields,
            },
          ],
  };
}

function fieldValue(value: string): string {
  return /^[A-Za-z0-9_./:@|,>-]+$/u.test(value) ? value : JSON.stringify(value);
}

function ownerItemQueryCoverage(
  term: string,
  matches: readonly { readonly name: string }[],
  fallback: "owner-top-items" | undefined,
): SemanticQueryCoverage {
  if (fallback !== undefined) {
    return {
      value: term,
      status: "miss",
      match: "none",
      matchCount: 0,
      nextAction: "query:broader-owner-item",
    };
  }
  const exactCount = matches.filter((item) => item.name === term).length;
  if (exactCount > 0) {
    return { value: term, status: "hit", match: "exact", matchCount: exactCount };
  }
  const lowerTerm = term.toLowerCase();
  const containsCount = matches.filter((item) =>
    item.name.toLowerCase().includes(lowerTerm),
  ).length;
  return {
    value: term,
    status: containsCount > 0 ? "hit" : "miss",
    match: containsCount > 0 ? "fallback-contains" : "none",
    matchCount: containsCount,
  };
}

function ownerItemQueryMatchMode(
  matches: readonly { readonly name: string }[],
  terms: readonly string[],
  fallback: "owner-top-items" | undefined,
): SemanticQueryPacket["matchMode"] {
  if (fallback !== undefined || terms.length === 0) return "unknown";
  const coverage = terms.map((term) => ownerItemQueryCoverage(term, matches, fallback));
  const exact = coverage.filter((item) => item.match === "exact").length;
  const contains = coverage.filter((item) => item.match === "fallback-contains").length;
  if (exact === coverage.length) return "exact";
  if (contains === coverage.length) return "fallback-contains";
  return "mixed";
}

function semanticSearchItemKind(kind: string): SemanticSearchItem["kind"] {
  switch (kind) {
    case "class":
    case "enum":
    case "function":
    case "interface":
    case "namespace":
    case "type":
    case "variable":
      return kind;
    default:
      return "symbol";
  }
}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
