/**
 * Renders bounded direct-source-read responses for TypeScript owner item queries.
 *
 * This module owns code-window output, read-plan fallback rendering, and the
 * semantic read packet shape used by hook repair paths. Query packet selection
 * remains in item-query.ts.
 */
import fs from "node:fs";
import path from "node:path";

import { renderExactSourceWindowCode } from "../queries/exact-source-window.js";
import { sourceSelectorLineRange } from "../queries/source-selector.js";
import {
  queryTypeScriptOwnerItems,
  type TypeScriptItemQueryMatch,
} from "../parser/native_syntax/item-query.js";
import {
  SEMANTIC_LANGUAGE_PROTOCOL_ID,
  SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
  SEMANTIC_READ_PACKET_SCHEMA_ID,
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
} from "./semantic-language.js";

const MAX_EXACT_DIRECT_READ_LINES = 40;

export interface SemanticReadPacket {
  readonly schemaId: typeof SEMANTIC_READ_PACKET_SCHEMA_ID;
  readonly schemaVersion: "1";
  readonly protocolId: typeof SEMANTIC_LANGUAGE_PROTOCOL_ID;
  readonly protocolVersion: typeof SEMANTIC_LANGUAGE_PROTOCOL_VERSION;
  readonly languageId: typeof TYPE_SCRIPT_LANGUAGE_ID;
  readonly providerId: typeof TYPE_SCRIPT_PROVIDER_ID;
  readonly binary: typeof TYPE_SCRIPT_BINARY;
  readonly namespace: typeof TYPE_SCRIPT_PROVIDER_NAMESPACE;
  readonly method: "query/direct-source-read";
  readonly projectRoot: string;
  readonly ownerPath: string;
  readonly selector: string;
  readonly fromHook: "direct-source-read";
  readonly query?: string;
  readonly queryTerms?: readonly string[];
  readonly outputMode: "read-packet";
  readonly sourceWindows?: readonly SemanticReadWindow[];
  readonly readPlan?: SemanticReadPlan;
  readonly syntaxQueryRef?: string;
  readonly syntaxMatchRefs?: readonly string[];
  readonly syntaxCaptureRefs?: readonly string[];
  readonly syntaxAnchor?: SemanticReadSyntaxAnchor;
  readonly truncated: boolean;
  readonly notes?: readonly SemanticReadNote[];
}

interface SemanticReadSyntaxAnchor {
  readonly nodeType: string;
  readonly field?: string;
  readonly capture?: string;
  readonly location: {
    readonly path: string;
    readonly lineRange: string;
  };
}

interface SemanticReadPlan {
  readonly mode: "range-frontier" | "search-repair";
  readonly code: false;
  readonly reason:
    | "wide-selector"
    | "low-signal-window"
    | "broad-selector"
    | "missing-query-terms"
    | "low-confidence-selector";
  readonly ranges?: readonly SemanticReadPlanRange[];
  readonly windows?: readonly SemanticReadPlanWindow[];
  readonly symbols?: readonly SemanticReadPlanSymbol[];
  readonly frontier: readonly SemanticReadPlanFrontier[];
  readonly avoid: readonly string[];
  readonly omit: readonly string[];
  readonly maxWindowLines?: number;
  readonly algorithm?: "symbol-frontier" | "range-split";
}

interface SemanticReadPlanRange {
  readonly path: string;
  readonly requested: string;
  readonly selected: string;
  readonly matched: string;
  readonly coverage: "full" | "head-only" | "tail-only" | "middle";
  readonly density: "low" | "normal" | "mixed" | "unknown";
}

interface SemanticReadPlanSymbol {
  readonly itemName: string;
  readonly itemKind: string;
  readonly lineRange: string;
  readonly read: string;
}

interface SemanticReadPlanWindow {
  readonly path: string;
  readonly lineRange: string;
  readonly read: string;
  readonly lineCount: number;
  readonly reason: "split";
}

interface SemanticReadPlanFrontier {
  readonly id: string;
  readonly kind: "symbol" | "window";
  readonly target: string;
  readonly read: string;
  readonly action: "code";
  readonly rank: number;
  readonly reason: "parser-item" | "split";
}

interface SemanticReadWindow {
  readonly ownerPath: string;
  readonly itemName?: string;
  readonly itemKind?: string;
  readonly location: {
    readonly path: string;
    readonly lineRange: string;
  };
  readonly read: string;
  readonly lineCount: number;
  readonly reason: "direct-selector";
  readonly text: string;
  readonly lines?: readonly { readonly number: number; readonly text: string }[];
  readonly truncated: boolean;
  readonly fields?: {
    readonly exported: boolean;
    readonly typeOnly: boolean;
    readonly exportKind: string;
  };
}

interface SemanticReadNote {
  readonly kind: string;
  readonly message: string;
}

export function renderOwnerItemSemanticReadPacketJson(packet: SemanticReadPacket): string {
  return JSON.stringify(packet);
}

export function renderOwnerItemSemanticReadPacket(packet: SemanticReadPacket): string {
  if (packet.readPlan !== undefined) {
    return renderSemanticReadPlan(packet.ownerPath, packet.selector, packet.readPlan);
  }
  const sourceWindows = packet.sourceWindows ?? [];
  const lines = [
    `[read-owner] q=${packet.ownerPath} selector=${fieldValue(packet.selector)} window=${sourceWindows.length}`,
  ];
  for (const window of sourceWindows) {
    const itemFields =
      window.itemName === undefined || window.itemKind === undefined
        ? ""
        : ` item=${fieldValue(window.itemName)} kind=${fieldValue(window.itemKind)}`;
    lines.push(
      `|read path=${window.ownerPath}${itemFields} lineRange=${window.location.lineRange} read=${window.read} next=direct-source-read reason=${window.reason} truncated=${window.truncated}`,
    );
  }
  return lines.join("\n");
}

export function renderOwnerItemQueryCode(
  projectRoot: string,
  ownerPath: string,
  itemQuery: string,
  selector?: string,
): string {
  const result = queryTypeScriptOwnerItems(projectRoot, ownerPath, itemQuery);
  const range =
    selector === undefined ? undefined : sourceSelectorLineRange(selector, result.ownerPath);
  const matches =
    range === undefined
      ? result.matches
      : result.matches.filter(
          (item) => item.lineEnd >= range.lineStart && item.lineStart <= range.lineEnd,
        );
  if (range !== undefined && sourceRangeLineCount(range) > MAX_EXACT_DIRECT_READ_LINES) {
    return renderSemanticReadPlanLines(
      result.ownerPath,
      selector ?? result.ownerPath,
      "wide-selector",
      range,
      matches,
      "unknown",
    );
  }
  if (range !== undefined && matches.length > 0) {
    const selectedText = matches
      .map((item) =>
        sourceWindowText(
          item,
          Math.max(item.lineStart, range.lineStart),
          Math.min(item.lineEnd, range.lineEnd),
        ),
      )
      .join("\n");
    if (selectedText.length > 0 && isLowSignalSourceText(selectedText)) {
      return renderSemanticReadPlanLines(
        result.ownerPath,
        selector ?? result.ownerPath,
        "low-signal-window",
        range,
        matches,
        "low",
      );
    }
  }
  return matches.map((item) => itemProjectionCode(item, range)).join("\n");
}

export function renderOwnerExactSourceWindowCode(
  projectRoot: string,
  ownerPath: string,
  selector: string,
): string {
  return (
    renderExactSourceWindowCode(projectRoot, ownerPath, selector) ??
    renderOwnerItemQueryCode(projectRoot, ownerPath, "", selector)
  );
}

export function buildOwnerItemSemanticReadPacket(
  projectRoot: string,
  ownerPath: string,
  itemQuery: string,
  selector: string = ownerPath,
): SemanticReadPacket {
  const result = queryTypeScriptOwnerItems(projectRoot, ownerPath, itemQuery);
  const range = sourceSelectorLineRange(selector, result.ownerPath);
  const query = result.queryTerms.join("|");
  const basePacket = {
    schemaId: SEMANTIC_READ_PACKET_SCHEMA_ID,
    schemaVersion: "1",
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    method: "query/direct-source-read",
    projectRoot,
    ownerPath: result.ownerPath,
    selector,
    fromHook: "direct-source-read",
    ...(query.length === 0 ? {} : { query, queryTerms: result.queryTerms }),
    outputMode: "read-packet",
    truncated: false,
    ...(result.fallback === undefined
      ? {}
      : {
          notes: [
            {
              kind: "owner-top-items",
              message: "item query missed; returned bounded owner top-level items",
            },
          ],
        }),
  } satisfies Omit<SemanticReadPacket, "sourceWindows" | "readPlan">;
  const matches =
    range === undefined
      ? result.matches
      : result.matches.filter(
          (item) => item.lineEnd >= range.lineStart && item.lineStart <= range.lineEnd,
        );
  if (matches.length === 0) {
    if (range === undefined) {
      throw new Error(
        `direct-source-read selector resolved to no parser-owned items: ${result.ownerPath}`,
      );
    }
    return {
      ...basePacket,
      sourceWindows: [semanticReadWindowForRange(projectRoot, result.ownerPath, range)],
    };
  }
  return {
    ...basePacket,
    ...ownerItemSyntaxRefs(result.ownerPath, result.queryTerms, matches),
    sourceWindows: matches.map((item) => semanticReadWindowForItem(result.ownerPath, item, range)),
  };
}
function itemProjectionCode(
  item: TypeScriptItemQueryMatch,
  range: { readonly lineStart: number; readonly lineEnd: number } | undefined,
): string {
  if (range === undefined) return semanticOutlineCode(item);
  const labels: string[] = [];
  const header = item.projectionNodes[0];
  if (header !== undefined) pushUniqueProjectionLabel(labels, header.label);
  for (const node of item.projectionNodes.slice(1)) {
    if (node.lineEnd < range.lineStart || node.lineStart > range.lineEnd) continue;
    pushUniqueProjectionLabel(labels, node.label);
  }
  return labels.join("\n");
}

function semanticOutlineCode(item: TypeScriptItemQueryMatch): string {
  if (item.projectionNodes.length === 0) return compactTypeScriptCodeProjection(item.code);
  const labels: string[] = [];
  for (const node of item.projectionNodes) {
    pushUniqueOutlineLabel(labels, `${"  ".repeat(node.depth)}${node.label}`);
  }
  return labels.join("\n");
}

function pushUniqueProjectionLabel(labels: string[], label: string): void {
  const trimmed = label.trim();
  if (trimmed.length === 0 || labels.includes(trimmed)) return;
  labels.push(trimmed);
}

function pushUniqueOutlineLabel(labels: string[], label: string): void {
  const trimmed = label.trim();
  if (trimmed.length === 0 || labels.some((line) => line.trim() === trimmed)) return;
  labels.push(label.trimEnd());
}

function compactTypeScriptCodeProjection(code: string): string {
  return code
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

function semanticReadWindowForItem(
  ownerPath: string,
  item: TypeScriptItemQueryMatch,
  range: { readonly lineStart: number; readonly lineEnd: number } | undefined,
): SemanticReadWindow {
  const lineStart =
    range === undefined ? item.lineStart : Math.max(item.lineStart, range.lineStart);
  const lineEnd = range === undefined ? item.lineEnd : Math.min(item.lineEnd, range.lineEnd);
  const lines = item.sourceLines.slice(lineStart - 1, lineEnd).map((text, index) => ({
    number: lineStart + index,
    text,
  }));
  return {
    ownerPath,
    itemName: item.name,
    itemKind: item.kind,
    location: {
      path: ownerPath,
      lineRange: `${lineStart}:${lineEnd}`,
    },
    read: `${ownerPath}:${lineStart}:${lineEnd}`,
    lineCount: Math.max(1, lineEnd - lineStart + 1),
    reason: "direct-selector",
    text: sourceWindowText(item, lineStart, lineEnd),
    lines,
    truncated: false,
    fields: {
      exported: item.exported,
      typeOnly: item.typeOnly,
      exportKind: item.kind,
    },
  };
}

function semanticReadWindowForRange(
  projectRoot: string,
  ownerPath: string,
  range: { readonly lineStart: number; readonly lineEnd: number },
): SemanticReadWindow {
  const sourceText = fs.readFileSync(path.resolve(projectRoot, ownerPath), "utf8");
  const sourceLines = sourceText.split(/\r?\n/u);
  if (range.lineStart > sourceLines.length) {
    throw new Error(
      `direct-source-read selector starts after end of file: ${ownerPath}:${range.lineStart}`,
    );
  }
  const lineEnd = Math.min(range.lineEnd, sourceLines.length);
  const selectedLines = sourceLines.slice(range.lineStart - 1, lineEnd);
  const lineRange = `${range.lineStart}:${lineEnd}`;
  return {
    ownerPath,
    location: {
      path: ownerPath,
      lineRange,
    },
    read: `${ownerPath}:${lineRange}`,
    lineCount: Math.max(1, lineEnd - range.lineStart + 1),
    reason: "direct-selector",
    text: selectedLines.join("\n").trimEnd(),
    lines: selectedLines.map((text, index) => ({ number: range.lineStart + index, text })),
    truncated: false,
  };
}

function sourceWindowText(
  item: TypeScriptItemQueryMatch,
  lineStart: number,
  lineEnd: number,
): string {
  return item.sourceLines
    .slice(lineStart - 1, lineEnd)
    .join("\n")
    .trimEnd();
}

function ownerItemSyntaxRefs(
  ownerPath: string,
  queryTerms: readonly string[],
  matches: readonly TypeScriptItemQueryMatch[],
): Pick<
  SemanticReadPacket,
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
function sourceRangeLineCount(range: {
  readonly lineStart: number;
  readonly lineEnd: number;
}): number {
  return Math.max(1, range.lineEnd - range.lineStart + 1);
}

function isLowSignalSourceText(text: string): boolean {
  return !/[A-Za-z0-9_]/u.test(text);
}

function renderSemanticReadPlanLines(
  ownerPath: string,
  selector: string,
  reason: SemanticReadPlan["reason"],
  range: { readonly lineStart: number; readonly lineEnd: number },
  matches: readonly TypeScriptItemQueryMatch[],
  density: SemanticReadPlanRange["density"],
): string {
  return renderSemanticReadPlan(
    ownerPath,
    selector,
    semanticReadPlanForRange(ownerPath, reason, range, matches, density),
  );
}

function renderSemanticReadPlan(
  ownerPath: string,
  selector: string,
  plan: SemanticReadPlan,
): string {
  const lines = [
    `[read-plan] q=${fieldValue(ownerPath)} selector=${fieldValue(selector)} mode=${plan.mode} code=false reason=${plan.reason} maxWindow=${plan.maxWindowLines ?? MAX_EXACT_DIRECT_READ_LINES} alg=${plan.algorithm ?? "range-split"} frontier=${plan.frontier.map((item) => `${item.id}.code`).join(",")} avoid=${plan.avoid.join(",")}`,
  ];
  for (const rangeItem of plan.ranges ?? []) {
    lines.push(
      `|range path=${fieldValue(rangeItem.path)} requested=${rangeItem.requested} selected=${rangeItem.selected} matched=${rangeItem.matched} coverage=${rangeItem.coverage} density=${rangeItem.density}`,
    );
  }
  for (const symbol of plan.symbols ?? []) {
    lines.push(
      `|symbol item=${fieldValue(symbol.itemName)} kind=${fieldValue(symbol.itemKind)} lineRange=${symbol.lineRange} read=${fieldValue(symbol.read)} reason=parser-item`,
    );
  }
  for (const window of plan.windows ?? []) {
    lines.push(
      `|window path=${fieldValue(window.path)} lineRange=${window.lineRange} read=${fieldValue(window.read)} lineCount=${window.lineCount} reason=${window.reason}`,
    );
  }
  return lines.join("\n");
}

function semanticReadPlanForRange(
  ownerPath: string,
  reason: SemanticReadPlan["reason"],
  range: { readonly lineStart: number; readonly lineEnd: number },
  matches: readonly TypeScriptItemQueryMatch[],
  density: SemanticReadPlanRange["density"],
): SemanticReadPlan {
  if (matches.length === 0) {
    const windows = splitReadPlanWindows(ownerPath, range);
    return {
      mode: "range-frontier",
      code: false,
      reason,
      ranges: [rangePlan(ownerPath, range, range.lineStart, range.lineEnd, density)],
      windows,
      frontier: windows.map((window, index) =>
        readPlanFrontier(
          index === 0 ? "W" : `W${index + 1}`,
          "window",
          window.path,
          window.lineRange,
          window.read,
          index + 1,
          "split",
        ),
      ),
      avoid: ["repeat-wide-read", "manual-window-scan", "raw-read"],
      omit: ["code"],
      maxWindowLines: MAX_EXACT_DIRECT_READ_LINES,
      algorithm: "range-split",
    };
  }
  const boundedMatches = matches.filter(
    (item) => item.lineEnd - item.lineStart + 1 <= MAX_EXACT_DIRECT_READ_LINES,
  );
  if (boundedMatches.length === 0) {
    const windows = splitReadPlanWindows(ownerPath, range);
    return {
      mode: "range-frontier",
      code: false,
      reason,
      ranges: [rangePlan(ownerPath, range, range.lineStart, range.lineEnd, density)],
      windows,
      frontier: windows.map((window, index) =>
        readPlanFrontier(
          index === 0 ? "W" : `W${index + 1}`,
          "window",
          window.path,
          window.lineRange,
          window.read,
          index + 1,
          "split",
        ),
      ),
      avoid: ["repeat-wide-read", "manual-window-scan", "raw-read"],
      omit: ["code"],
      maxWindowLines: MAX_EXACT_DIRECT_READ_LINES,
      algorithm: "range-split",
    };
  }
  const symbols = boundedMatches.map((item) => ({
    itemName: item.name,
    itemKind: item.kind,
    lineRange: `${item.lineStart}:${item.lineEnd}`,
    read: `${ownerPath}:${item.lineStart}:${item.lineEnd}`,
  }));
  return {
    mode: "range-frontier",
    code: false,
    reason,
    ranges: boundedMatches.map((item) =>
      rangePlan(
        ownerPath,
        range,
        Math.max(item.lineStart, range.lineStart),
        Math.min(item.lineEnd, range.lineEnd),
        density,
        item.lineStart,
        item.lineEnd,
      ),
    ),
    symbols,
    frontier: symbols.map((symbol, index) =>
      readPlanFrontier(
        index === 0 ? "S" : `S${index + 1}`,
        "symbol",
        ownerPath,
        symbol.lineRange,
        symbol.read,
        index + 1,
        "parser-item",
      ),
    ),
    avoid: ["repeat-wide-read", "manual-window-scan", "raw-read"],
    omit: ["code"],
    maxWindowLines: MAX_EXACT_DIRECT_READ_LINES,
    algorithm: "symbol-frontier",
  };
}

function rangePlan(
  ownerPath: string,
  range: { readonly lineStart: number; readonly lineEnd: number },
  selectedStart: number,
  selectedEnd: number,
  density: SemanticReadPlanRange["density"],
  matchedStart: number = selectedStart,
  matchedEnd: number = selectedEnd,
): SemanticReadPlanRange {
  return {
    path: ownerPath,
    requested: `${range.lineStart}:${range.lineEnd}`,
    selected: `${selectedStart}:${selectedEnd}`,
    matched: `${matchedStart}:${matchedEnd}`,
    coverage: rangeCoverage(matchedStart, matchedEnd, selectedStart, selectedEnd),
    density,
  };
}

function splitReadPlanWindows(
  ownerPath: string,
  range: { readonly lineStart: number; readonly lineEnd: number },
): readonly SemanticReadPlanWindow[] {
  const windows: SemanticReadPlanWindow[] = [];
  for (
    let lineStart = range.lineStart;
    lineStart <= range.lineEnd;
    lineStart += MAX_EXACT_DIRECT_READ_LINES
  ) {
    const lineEnd = Math.min(lineStart + MAX_EXACT_DIRECT_READ_LINES - 1, range.lineEnd);
    windows.push({
      path: ownerPath,
      lineRange: `${lineStart}:${lineEnd}`,
      read: `${ownerPath}:${lineStart}:${lineEnd}`,
      lineCount: lineEnd - lineStart + 1,
      reason: "split",
    });
  }
  return windows;
}

function readPlanFrontier(
  id: string,
  kind: "symbol" | "window",
  ownerPath: string,
  lineRange: string,
  read: string,
  rank: number,
  reason: "parser-item" | "split",
): SemanticReadPlanFrontier {
  return {
    id,
    kind,
    target: `${ownerPath}@${lineRange}`,
    read,
    action: "code",
    rank,
    reason,
  };
}

function rangeCoverage(
  itemStart: number,
  itemEnd: number,
  selectedStart: number,
  selectedEnd: number,
): SemanticReadPlanRange["coverage"] {
  if (selectedStart <= itemStart && selectedEnd >= itemEnd) return "full";
  if (selectedStart > itemStart && selectedEnd >= itemEnd) return "tail-only";
  if (selectedStart <= itemStart && selectedEnd < itemEnd) return "head-only";
  return "middle";
}

function fieldValue(value: string): string {
  return /^[A-Za-z0-9_./:@|,>-]+$/u.test(value) ? value : JSON.stringify(value);
}
