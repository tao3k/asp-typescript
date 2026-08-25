/**
 * Native TypeScript projection for ASP-compiled tree-sitter-compatible queries.
 *
 * ASP owns query compilation and predicate ABI validation; this module projects
 * TypeScript Compiler API facts into the shared semantic-tree-sitter-query
 * packet shape without linking a tree-sitter runtime or grammar package.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

import {
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
} from "../../cli/semantic-language.js";

import { discoverTypeScriptFiles } from "../files.js";
const SEMANTIC_TREE_SITTER_QUERY_SCHEMA_ID =
  "agent.semantic-protocols.semantic-tree-sitter-query" as const;
export const TYPE_SCRIPT_TREE_SITTER_GRAMMAR_ID = "tree-sitter-typescript" as const;
export const TYPE_SCRIPT_TREE_SITTER_GRAMMAR_PROFILE_VERSION = "2026-06-05.v1" as const;
export const TYPE_SCRIPT_TREE_SITTER_GRAMMAR_PROFILE_PATH =
  "tree-sitter/tree-sitter-typescript/grammar-profile.json" as const;

export interface TypeScriptTreeSitterQueryOptions {
  readonly catalogId?: string | undefined;
  readonly treeSitterQuery?: string | undefined;
  readonly terms: readonly string[];
  readonly selector?: string | undefined;
  readonly aspSyntaxQueryPlan?: SyntaxQueryPlan | undefined;
  readonly json: boolean;
}

export interface SyntaxQueryPlan {
  readonly captures: readonly string[];
  readonly nodeTypes: readonly string[];
  readonly fields: readonly string[];
  readonly predicates: readonly SyntaxQueryPredicate[];
}

export type SyntaxQueryPredicateOp =
  | "eq"
  | "any-eq"
  | "any-of"
  | "match"
  | "any-match"
  | "not-eq"
  | "not-match";

export interface SyntaxQueryPredicateValue {
  readonly kind: "string" | "capture";
  readonly value: string;
}

export interface SyntaxQueryPredicate {
  readonly op: SyntaxQueryPredicateOp;
  readonly capture: string;
  readonly values: readonly SyntaxQueryPredicateValue[];
}

interface Catalog {
  readonly id: string;
  readonly path: string;
  readonly source: string;
  readonly captures: readonly string[];
  readonly nodeTypes: readonly string[];
  readonly fields: readonly string[];
}

interface SyntaxRow {
  readonly capture: string;
  readonly captureNode: string;
  readonly captureField: string;
  readonly node: string;
  readonly name: string;
  readonly path: string;
  readonly absolutePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly itemStartLine: number;
  readonly itemEndLine: number;
  readonly itemCode: string;
  readonly nativeFactRef: string;
}

interface QueryPlanShape {
  readonly captures: readonly string[];
  readonly nodeTypes: readonly string[];
  readonly fields: readonly string[];
  readonly predicates?: readonly SyntaxQueryPredicate[];
}

interface ResolvedQuery {
  readonly inputForm: "catalog-id" | "s-expression";
  readonly input: string;
  readonly source: string;
  readonly captures: readonly string[];
  readonly nodeTypes: readonly string[];
  readonly fields: readonly string[];
  readonly predicates: readonly SyntaxQueryPredicate[];
  readonly supportedNodes: readonly string[];
  readonly unsupportedNodes: readonly string[];
  readonly catalog?: Catalog;
}

interface PreparedSyntaxQueryPredicate {
  readonly predicate: SyntaxQueryPredicate;
  readonly regexes: readonly RegExp[];
}

interface ParsedSelector {
  readonly path: string;
  readonly start?: number;
  readonly end?: number;
}

interface ResolvedSelector extends ParsedSelector {
  readonly resolvedPath?: string;
  readonly resolvedKind?: "file" | "directory";
}

const catalogs: readonly Catalog[] = [
  {
    id: "declarations",
    path: "tree-sitter/tree-sitter-typescript/queries/declarations.scm",
    captures: [
      "function.definition",
      "function.name",
      "class.definition",
      "class.name",
      "interface.definition",
      "interface.name",
      "type.definition",
      "type.name",
      "enum.definition",
      "enum.name",
      "variable.definition",
      "variable.name",
      "import.declaration",
      "import.source",
      "export.declaration",
    ],
    nodeTypes: [
      "function_declaration",
      "class_declaration",
      "interface_declaration",
      "type_alias_declaration",
      "enum_declaration",
      "lexical_declaration",
      "variable_declarator",
      "import_statement",
      "export_statement",
    ],
    fields: ["name", "source"],
    source: [
      "(function_declaration name: (identifier) @function.name) @function.definition",
      "(class_declaration name: (type_identifier) @class.name) @class.definition",
      "(interface_declaration name: (type_identifier) @interface.name) @interface.definition",
      "(type_alias_declaration name: (type_identifier) @type.name) @type.definition",
      "(enum_declaration name: (identifier) @enum.name) @enum.definition",
      "(lexical_declaration (variable_declarator name: (identifier) @variable.name)) @variable.definition",
      "(import_statement source: (string) @import.source) @import.declaration",
      "(export_statement) @export.declaration",
    ].join("\n"),
  },
  {
    id: "imports",
    path: "tree-sitter/tree-sitter-typescript/queries/imports.scm",
    captures: ["import.declaration", "import.source", "export.declaration", "export.source"],
    nodeTypes: ["import_statement", "export_statement"],
    fields: ["source"],
    source: [
      "(import_statement source: (string) @import.source) @import.declaration",
      "(export_statement source: (string) @export.source) @export.declaration",
    ].join("\n"),
  },
  {
    id: "calls",
    path: "tree-sitter/tree-sitter-typescript/queries/calls.scm",
    captures: ["call.expression", "call.target"],
    nodeTypes: ["call_expression"],
    fields: ["function"],
    source: "(call_expression function: (_) @call.target) @call.expression",
  },
];

const supportedNodes = new Set([
  "function_declaration",
  "class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "lexical_declaration",
  "variable_declarator",
  "import_statement",
  "export_statement",
  "call_expression",
]);

export function renderTypeScriptTreeSitterQuery(
  projectRoot: string,
  options: TypeScriptTreeSitterQueryOptions,
): string {
  const query = resolveQuery(options);
  const rows = collectSyntaxRows(projectRoot, query, options);
  if (options.json) return `${JSON.stringify(packet(projectRoot, query, rows, options))}\n`;
  if (rows.length === 0) {
    return [
      `|syntax-query inputForm=${query.inputForm} input=${shellToken(query.input)} grammar=${TYPE_SCRIPT_TREE_SITTER_GRAMMAR_ID} grammarProfile=${TYPE_SCRIPT_TREE_SITTER_GRAMMAR_PROFILE_VERSION} dialect=tree-sitter-query mode=native-parser-projection matchStatus=miss rows=0 captures=${query.captures.join(",") || "-"}`,
      `|syntax-query-unsupported nodes=${query.unsupportedNodes.join(",") || "-"} supported=${query.supportedNodes.join(",") || "-"}`,
    ].join("\n");
  }
  return rows.map(renderSyntaxRow).join("\n\n");
}

function resolveQuery(options: TypeScriptTreeSitterQueryOptions): ResolvedQuery {
  if (options.catalogId !== undefined) {
    const catalog = catalogs.find((candidate) => candidate.id === options.catalogId);
    if (catalog === undefined)
      throw new Error(`unknown TypeScript tree-sitter query catalog: ${options.catalogId}`);
    return queryShape(
      "catalog-id",
      catalog.id,
      catalog.source,
      options.aspSyntaxQueryPlan ?? catalog,
      catalog,
    );
  }
  if (options.treeSitterQuery === undefined) {
    throw new Error("query requires --catalog <id> or --treesitter-query <s-expression>");
  }
  if (options.aspSyntaxQueryPlan === undefined) {
    throw new Error(
      "tree-sitter query projection requires ASP-compiled query plan; use `asp typescript query --treesitter-query ...` so ASP owns query ABI compilation",
    );
  }
  return queryShape(
    "s-expression",
    options.treeSitterQuery,
    options.treeSitterQuery,
    options.aspSyntaxQueryPlan,
  );
}

function queryShape(
  inputForm: "catalog-id" | "s-expression",
  input: string,
  source: string,
  plan: QueryPlanShape,
  catalog?: Catalog,
): ResolvedQuery {
  const supported = plan.nodeTypes.filter((node) => supportedNodes.has(node));
  return {
    inputForm,
    input,
    source,
    captures: unique(plan.captures),
    nodeTypes: unique(plan.nodeTypes),
    fields: unique(plan.fields),
    predicates: plan.predicates ?? [],
    supportedNodes: unique(supported),
    unsupportedNodes:
      supported.length === 0
        ? unique(plan.nodeTypes.filter((node) => !supportedNodes.has(node)))
        : [],
    ...(catalog === undefined ? {} : { catalog }),
  };
}

function collectSyntaxRows(
  projectRoot: string,
  query: ResolvedQuery,
  options: TypeScriptTreeSitterQueryOptions,
): readonly SyntaxRow[] {
  const queryNodes = query.supportedNodes;
  const captures = new Set(query.captures);
  const selector = resolveSelector(projectRoot, parseSelector(options.selector));
  const predicates = query.predicates.map(prepareSyntaxPredicate);
  const rows: SyntaxRow[] = [];
  for (const filePath of syntaxQuerySourceFiles(projectRoot, selector)) {
    const absolutePath = realPath(filePath);
    const normalizedPath = path.relative(projectRoot, filePath).replace(/\\/gu, "/");
    if (selector !== undefined && !selectorMatchesFile(selector, normalizedPath, absolutePath)) {
      continue;
    }
    const sourceText = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      normalizedPath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKindForPath(normalizedPath),
    );
    rows.push(
      ...rowsForSourceFile(
        sourceFile,
        sourceText,
        normalizedPath,
        absolutePath,
        queryNodes,
        captures,
      ),
    );
  }
  return rows
    .filter((row) => selector === undefined || selectorOverlapsRow(selector, row))
    .filter((row) => termMatches(row, options.terms))
    .filter((row) => syntaxPredicatesMatch(row, predicates))
    .sort((left, right) => left.path.localeCompare(right.path) || left.startLine - right.startLine);
}

function rowsForSourceFile(
  sourceFile: ts.SourceFile,
  sourceText: string,
  relativePath: string,
  absolutePath: string,
  queryNodes: readonly string[],
  captures: ReadonlySet<string>,
): readonly SyntaxRow[] {
  const rows: SyntaxRow[] = [];
  const wants = (node: string) => queryNodes.length === 0 || queryNodes.includes(node);
  for (const statement of sourceFile.statements) {
    const nodeType = nodeTypeForStatement(statement);
    if (nodeType !== undefined && wants(nodeType)) {
      rows.push(
        ...declarationRows(
          sourceFile,
          sourceText,
          relativePath,
          absolutePath,
          statement,
          nodeType,
          captures,
        ),
      );
    }
  }
  if (wants("call_expression")) {
    collectCallRows(sourceFile, sourceFile, sourceText, relativePath, absolutePath, captures, rows);
  }
  return rows;
}

function declarationRows(
  sourceFile: ts.SourceFile,
  sourceText: string,
  relativePath: string,
  absolutePath: string,
  node: ts.Statement,
  nodeType: string,
  captures: ReadonlySet<string>,
): readonly SyntaxRow[] {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap((declaration) => {
      const name = bindingNameText(declaration.name);
      return name === undefined
        ? []
        : rowForNode(
            sourceFile,
            sourceText,
            relativePath,
            absolutePath,
            node,
            "variable_declarator",
            name,
            captures,
          );
    });
  }
  const name = declarationName(node);
  if (name === undefined) return [];
  return rowForNode(
    sourceFile,
    sourceText,
    relativePath,
    absolutePath,
    node,
    nodeType,
    name,
    captures,
  );
}

function collectCallRows(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  sourceText: string,
  relativePath: string,
  absolutePath: string,
  captures: ReadonlySet<string>,
  rows: SyntaxRow[],
): void {
  if (ts.isCallExpression(node)) {
    rows.push(
      ...rowForNode(
        sourceFile,
        sourceText,
        relativePath,
        absolutePath,
        node,
        "call_expression",
        callName(node),
        captures,
      ),
    );
  }
  node.forEachChild((child) =>
    collectCallRows(sourceFile, child, sourceText, relativePath, absolutePath, captures, rows),
  );
}

function rowForNode(
  sourceFile: ts.SourceFile,
  sourceText: string,
  relativePath: string,
  absolutePath: string,
  node: ts.Node,
  nodeType: string,
  name: string,
  captures: ReadonlySet<string>,
): readonly SyntaxRow[] {
  const capture = captureForNode(nodeType, captures);
  if (capture === undefined) return [];
  const itemStart = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const itemEnd = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  const itemStartLine = itemStart.line + 1;
  const itemEndLine = itemEnd.line + 1;
  const captureNode = captureNodeForQuery(node, capture);
  const captureStart = sourceFile.getLineAndCharacterOfPosition(captureNode.getStart(sourceFile));
  const captureEnd = sourceFile.getLineAndCharacterOfPosition(captureNode.getEnd());
  const captureField = captureFieldForQuery(capture);
  const captureNodeType = captureNodeTypeForQuery(captureNode, capture, name);
  const startLine = captureStart.line + 1;
  const endLine = captureEnd.line + 1;
  const itemCode = sourceCompactCode(sourceText, itemStartLine, itemEndLine);
  return [
    {
      capture,
      captureNode: captureNodeType,
      captureField,
      node: nodeType,
      name,
      path: relativePath,
      absolutePath,
      startLine,
      endLine,
      itemStartLine,
      itemEndLine,
      itemCode,
      nativeFactRef: `typescript:item:${relativePath}:${itemStartLine}:${itemEndLine}:${name}`,
    },
  ];
}

function packet(
  projectRoot: string,
  query: ResolvedQuery,
  rows: readonly SyntaxRow[],
  options: TypeScriptTreeSitterQueryOptions,
): Record<string, unknown> {
  const nativeFactRefs = unique(rows.map((row) => row.nativeFactRef));
  return {
    schemaId: SEMANTIC_TREE_SITTER_QUERY_SCHEMA_ID,
    schemaVersion: "1",
    protocolId: "agent.semantic-protocols.semantic-tree-sitter-query",
    protocolVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    projectRoot,
    grammarId: TYPE_SCRIPT_TREE_SITTER_GRAMMAR_ID,
    grammarProfileVersion: TYPE_SCRIPT_TREE_SITTER_GRAMMAR_PROFILE_VERSION,
    sourceAuthority: "native-parser-adapter",
    adapterMode: "native-projection",
    compatibilityLevel: "native-only",
    method: "query",
    query: {
      input: query.input,
      inputForm: query.inputForm,
      dialect: "tree-sitter-query",
      compiledSource: query.source,
      patternCount: Math.max(1, (query.source.match(/\(/gu) ?? []).length),
      ...(query.catalog === undefined
        ? {}
        : {
            catalogId: query.catalog.id,
            catalogPath: query.catalog.path,
            grammarProfilePath: TYPE_SCRIPT_TREE_SITTER_GRAMMAR_PROFILE_PATH,
          }),
      fields: {
        captures: query.captures,
        nodeTypes: query.nodeTypes,
        fields: query.fields,
        predicates: query.predicates,
        unsupportedPredicates: [],
        unsupportedNodes: query.unsupportedNodes,
        terms: [...options.terms],
        ...(options.selector === undefined ? {} : { selector: options.selector }),
      },
    },
    matches: rows.map((row, index) => ({
      id: `match:${index + 1}`,
      patternIndex: 0,
      range: itemRangeForRow(row),
      captures: [captureForRow(row, index)],
      nativeFactRefs: [row.nativeFactRef],
      fields: {
        name: row.name,
        read: `${row.path}:${row.startLine}:${row.endLine}`,
        itemRead: `${row.path}:${row.itemStartLine}:${row.itemEndLine}`,
        node: row.node,
      },
    })),
    nativeFactRefs,
    truncated: false,
    cache: {
      cacheStatus: "miss",
      requestFingerprint: digest(
        [query.source, ...options.terms, options.selector ?? ""].join("\n"),
      ),
      generationId: digest([projectRoot, query.source, String(rows.length)].join("\n")),
      artifactId: `semantic-tree-sitter-query/${query.inputForm}-${digest(query.input).slice(0, 16)}.json`,
      artifactKind: "semantic-tree-sitter-query",
      catalogFingerprint: digest(catalogs.map((catalog) => catalog.source).join("\n---\n")),
      grammarProfileFingerprint: TYPE_SCRIPT_TREE_SITTER_GRAMMAR_PROFILE_VERSION,
      rawSourceStored: false,
    },
  };
}

function captureForRow(row: SyntaxRow, index: number): Record<string, unknown> {
  return {
    id: `capture:${index + 1}`,
    name: row.capture,
    nodeType: row.captureNode,
    field: row.captureField,
    named: true,
    range: rangeForRow(row),
    nativeFactRefs: [row.nativeFactRef],
    fields: {
      name: row.name,
      locator: `${row.path}:${row.startLine}:${row.endLine}`,
      read: `${row.path}:${row.startLine}:${row.endLine}`,
      itemRead: `${row.path}:${row.itemStartLine}:${row.itemEndLine}`,
      frontier: "code",
      nativeNodeType: row.node,
    },
  };
}

function rangeForRow(row: SyntaxRow): Record<string, unknown> {
  return {
    path: row.path,
    lineRange: { start: row.startLine, end: row.endLine },
  };
}

function itemRangeForRow(row: SyntaxRow): Record<string, unknown> {
  return {
    path: row.path,
    lineRange: { start: row.itemStartLine, end: row.itemEndLine },
  };
}

function renderSyntaxRow(row: SyntaxRow): string {
  return `${syntaxLineLocator(row.path, row.startLine, row.endLine)}\n${captureTextForRow(row)}`;
}

function captureForNode(nodeType: string, captures: ReadonlySet<string>): string | undefined {
  const candidates =
    nodeType === "function_declaration"
      ? ["function.name", "function.definition"]
      : nodeType === "class_declaration"
        ? ["class.name", "class.definition"]
        : nodeType === "interface_declaration"
          ? ["interface.name", "interface.definition"]
          : nodeType === "type_alias_declaration"
            ? ["type.name", "type.definition"]
            : nodeType === "enum_declaration"
              ? ["enum.name", "enum.definition"]
              : nodeType === "variable_declarator" || nodeType === "lexical_declaration"
                ? ["variable.name", "variable.definition"]
                : nodeType === "import_statement"
                  ? ["import.source", "import.declaration"]
                  : nodeType === "export_statement"
                    ? ["export.source", "export.declaration"]
                    : nodeType === "call_expression"
                      ? ["call.target", "call.expression"]
                      : [];
  return candidates.find((capture) => captures.size === 0 || captures.has(capture));
}

function nodeTypeForStatement(node: ts.Statement): string | undefined {
  if (ts.isFunctionDeclaration(node)) return "function_declaration";
  if (ts.isClassDeclaration(node)) return "class_declaration";
  if (ts.isInterfaceDeclaration(node)) return "interface_declaration";
  if (ts.isTypeAliasDeclaration(node)) return "type_alias_declaration";
  if (ts.isEnumDeclaration(node)) return "enum_declaration";
  if (ts.isVariableStatement(node)) return "lexical_declaration";
  if (ts.isImportDeclaration(node)) return "import_statement";
  if (ts.isExportDeclaration(node)) return "export_statement";
  return undefined;
}

function declarationName(node: ts.Statement): string | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    return node.name?.text;
  }
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text;
  }
  if (ts.isExportDeclaration(node)) {
    return node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)
      ? node.moduleSpecifier.text
      : "export";
  }
  return undefined;
}

function callName(node: ts.CallExpression): string {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return expression.getText();
}

function bindingNameText(name: ts.BindingName): string | undefined {
  if (ts.isIdentifier(name)) return name.text;
  const text = name.getText();
  return text.length > 0 ? text : undefined;
}

function parseSelector(selector: string | undefined): ParsedSelector | undefined {
  if (selector === undefined) return undefined;
  const match = /^(.*?)(?::(\d+)(?::(\d+))?)?$/u.exec(selector);
  if (match === null) return { path: selector };
  return {
    path: match[1]!.replace(/\\/gu, "/"),
    ...(match[2] === undefined ? {} : { start: Number(match[2]) }),
    ...(match[3] === undefined ? {} : { end: Number(match[3]) }),
  };
}

function syntaxQuerySourceFiles(
  projectRoot: string,
  selector: ResolvedSelector | undefined,
): readonly string[] {
  if (selector?.resolvedPath !== undefined) {
    if (selector.resolvedKind === "file") {
      return discoverTypeScriptFiles([selector.resolvedPath]);
    }
    if (selector.resolvedKind === "directory") {
      const files = discoverTypeScriptFiles([selector.resolvedPath]);
      if (files.length > 0) return files;
    }
  }
  return discoverTypeScriptFiles([projectRoot]);
}

function resolveSelector(
  projectRoot: string,
  selector: ParsedSelector | undefined,
): ResolvedSelector | undefined {
  if (selector === undefined || selectorContainsGlob(selector.path)) return selector;
  const candidate = path.isAbsolute(selector.path)
    ? selector.path
    : path.join(projectRoot, selector.path);
  if (!fs.existsSync(candidate)) return selector;
  const stat = fs.statSync(candidate);
  if (stat.isFile()) {
    return { ...selector, resolvedPath: realPath(candidate), resolvedKind: "file" };
  }
  if (stat.isDirectory()) {
    return { ...selector, resolvedPath: realPath(candidate), resolvedKind: "directory" };
  }
  return selector;
}

function selectorContainsGlob(selectorPath: string): boolean {
  return /[*?[\]{}]/u.test(selectorPath);
}

function selectorMatchesFile(
  selector: ResolvedSelector,
  rowPath: string,
  absolutePath: string,
): boolean {
  if (selector.resolvedPath !== undefined) {
    if (selector.resolvedKind === "file") return absolutePath === selector.resolvedPath;
    return isPathWithinDirectory(absolutePath, selector.resolvedPath);
  }
  return rowPath === selector.path.replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function isPathWithinDirectory(filePath: string, directoryPath: string): boolean {
  const relative = path.relative(directoryPath, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function selectorOverlapsRow(selector: ResolvedSelector, row: SyntaxRow): boolean {
  if (!selectorMatchesFile(selector, row.path, row.absolutePath)) return false;
  if (selector.start === undefined) return true;
  const selectorEnd = selector.end ?? selector.start;
  return (
    (row.startLine <= selectorEnd && row.endLine >= selector.start) ||
    (row.itemStartLine <= selectorEnd && row.itemEndLine >= selector.start)
  );
}

function realPath(filePath: string): string {
  return fs.realpathSync(filePath).replace(/\\/gu, "/");
}

function captureNodeForQuery(node: ts.Node, capture: string): ts.Node {
  if (capture.endsWith(".name") || capture.endsWith(".target")) {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name !== undefined
    ) {
      return node.name;
    }
    if (ts.isVariableStatement(node)) {
      return node.declarationList.declarations[0]?.name ?? node;
    }
    if (ts.isCallExpression(node)) {
      return node.expression;
    }
  }
  if ((capture.endsWith(".source") || capture.endsWith(".declaration")) && isModuleEdge(node)) {
    return node.moduleSpecifier ?? node;
  }
  return node;
}

function captureFieldForQuery(capture: string): string {
  if (capture.startsWith("call.")) return "function";
  if (capture.endsWith(".name")) return "name";
  if (capture.endsWith(".target")) return "target";
  if (capture.endsWith(".source")) return "source";
  return "item";
}

function captureNodeTypeForQuery(node: ts.Node, capture: string, name: string): string {
  if (capture.endsWith(".name") || capture.endsWith(".target")) {
    if (isTypeNamedCapture(capture) && ts.isIdentifier(node)) return "type_identifier";
    if (ts.isIdentifier(node)) return "identifier";
    if (ts.isPropertyAccessExpression(node)) return "member_expression";
    if (name.includes(".")) return "member_expression";
  }
  if (capture.endsWith(".source") && ts.isStringLiteralLike(node)) return "string";
  return treeSitterNodeTypeForTsNode(node);
}

function isTypeNamedCapture(capture: string): boolean {
  return (
    capture.startsWith("class.") || capture.startsWith("interface.") || capture.startsWith("type.")
  );
}

function isModuleEdge(node: ts.Node): node is ts.ImportDeclaration | ts.ExportDeclaration {
  return ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
}

function treeSitterNodeTypeForTsNode(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return "function_declaration";
  if (ts.isClassDeclaration(node)) return "class_declaration";
  if (ts.isInterfaceDeclaration(node)) return "interface_declaration";
  if (ts.isTypeAliasDeclaration(node)) return "type_alias_declaration";
  if (ts.isEnumDeclaration(node)) return "enum_declaration";
  if (ts.isVariableStatement(node)) return "lexical_declaration";
  if (ts.isVariableDeclaration(node)) return "variable_declarator";
  if (ts.isImportDeclaration(node)) return "import_statement";
  if (ts.isExportDeclaration(node)) return "export_statement";
  if (ts.isCallExpression(node)) return "call_expression";
  if (ts.isIdentifier(node)) return "identifier";
  if (ts.isStringLiteralLike(node)) return "string";
  return "node";
}

function termMatches(row: SyntaxRow, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = `${row.name}\n${row.node}\n${row.capture}\n${row.itemCode}`.toLowerCase();
  return terms.every((term) => haystack.includes(term.toLowerCase()));
}

function prepareSyntaxPredicate(predicate: SyntaxQueryPredicate): PreparedSyntaxQueryPredicate {
  if (predicate.op !== "match" && predicate.op !== "any-match" && predicate.op !== "not-match") {
    return { predicate, regexes: [] };
  }
  return {
    predicate,
    regexes: predicate.values.map((value) => {
      if (value.kind !== "string") {
        throw new Error(`tree-sitter ${predicate.op} predicate requires string operands`);
      }
      return new RegExp(value.value, "u");
    }),
  };
}

function syntaxPredicatesMatch(
  row: SyntaxRow,
  predicates: readonly PreparedSyntaxQueryPredicate[],
): boolean {
  return predicates.every((predicate) => syntaxPredicateMatches(row, predicate));
}

function syntaxPredicateMatches(row: SyntaxRow, prepared: PreparedSyntaxQueryPredicate): boolean {
  const captureText = predicateCaptureText(row, prepared.predicate.capture);
  const values = prepared.predicate.values.map((value) => predicateValueText(row, value));
  switch (prepared.predicate.op) {
    case "eq":
    case "any-eq":
    case "any-of":
      return values.some((value) => captureText === value);
    case "match":
    case "any-match":
      return prepared.regexes.some((regex) => regex.test(captureText));
    case "not-eq":
      return values.every((value) => captureText !== value);
    case "not-match":
      return prepared.regexes.every((regex) => !regex.test(captureText));
  }
}

function predicateValueText(row: SyntaxRow, value: SyntaxQueryPredicateValue): string {
  return value.kind === "string" ? value.value : predicateCaptureText(row, value.value);
}

function predicateCaptureText(row: SyntaxRow, capture: string): string {
  if (capture === row.capture) return captureTextForRow(row);
  if (
    capture.endsWith(".name") ||
    capture.endsWith(".target") ||
    capture.endsWith(".method") ||
    capture.endsWith(".source")
  ) {
    return row.name;
  }
  if (capture.endsWith(".definition") || capture.endsWith(".expression")) {
    return row.itemCode;
  }
  return captureTextForRow(row);
}

function sourceCompactCode(sourceText: string, lineStart: number, lineEnd: number): string {
  return sourceText
    .split(/\r?\n/u)
    .slice(lineStart - 1, lineEnd)
    .join("\n")
    .trimEnd();
}

function syntaxLineLocator(filePath: string, startLine: number, endLine: number): string {
  return startLine === endLine ? `${filePath}:${startLine}` : `${filePath}:${startLine}:${endLine}`;
}

function captureTextForRow(row: SyntaxRow): string {
  if (
    row.capture.endsWith(".name") ||
    row.capture.endsWith(".target") ||
    row.capture.endsWith(".method") ||
    row.capture.endsWith(".source")
  ) {
    return row.name;
  }
  if (row.capture.endsWith(".definition")) {
    return row.itemCode;
  }
  return (
    row.itemCode
      .split(/\r?\n/u)
      .find((line) => line.trim() !== "")
      ?.trim() ?? row.name
  );
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function digest(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function shellToken(input: string): string {
  return input.replace(/\s+/gu, "_");
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
