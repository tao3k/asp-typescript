import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

export interface TypeScriptItemQueryMatch {
  readonly name: string;
  readonly kind: string;
  readonly exported: boolean;
  readonly typeOnly: boolean;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly column: number;
  readonly sourceByteStart: number;
  readonly sourceByteEnd: number;
  readonly code: string;
  readonly sourceLines: readonly string[];
  readonly projectionNodes: readonly TypeScriptItemProjectionNode[];
}

export type TypeScriptProjectionIdentity = string;

export interface TypeScriptItemProjectionNode {
  readonly id: TypeScriptProjectionIdentity;
  readonly parentId?: TypeScriptProjectionIdentity;
  readonly nativeId?: TypeScriptProjectionIdentity;
  readonly structuralFingerprint?: TypeScriptProjectionIdentity;
  readonly kind: string;
  readonly role:
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
  readonly depth: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly flags: readonly string[];
}

export interface TypeScriptItemQueryResult {
  readonly ownerPath: string;
  readonly queryTerms: readonly string[];
  readonly matches: readonly TypeScriptItemQueryMatch[];
  readonly fallback?: "owner-top-items";
}

const projectionNodeLimit = 32;

export function queryTypeScriptOwnerItems(
  projectRoot: string,
  ownerPath: string,
  itemQuery: string,
): TypeScriptItemQueryResult {
  const queryTerms = itemQuery
    .split("|")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  const normalizedOwnerPath = ownerPath.replace(/\\/gu, "/");
  const absolutePath = path.isAbsolute(ownerPath)
    ? ownerPath
    : path.join(projectRoot, normalizedOwnerPath);
  const sourceText = fs.readFileSync(absolutePath, "utf8");
  const items = projectTypeScriptOwnerSource(normalizedOwnerPath, sourceText);
  const matches = itemMatches(items, queryTerms);
  return {
    ownerPath: normalizedOwnerPath,
    queryTerms,
    matches: matches.length > 0 || queryTerms.length === 0 ? matches : fallbackTopLevelItems(items),
    ...(matches.length > 0 || queryTerms.length === 0
      ? {}
      : { fallback: "owner-top-items" as const }),
  };
}

export function projectTypeScriptOwnerSource(
  ownerPath: string,
  sourceText: string,
): readonly TypeScriptItemQueryMatch[] {
  const sourceFile = ts.createSourceFile(
    ownerPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(ownerPath),
  );
  return collectTopLevelItems(sourceFile, sourceText);
}

function collectTopLevelItems(
  sourceFile: ts.SourceFile,
  sourceText: string,
): readonly TypeScriptItemQueryMatch[] {
  const items: TypeScriptItemQueryMatch[] = [];
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      const name = statement.name?.text;
      if (name !== undefined) {
        items.push(
          itemFromNode(sourceFile, sourceText, statement, name, declarationKind(statement)),
        );
        if (ts.isClassDeclaration(statement)) {
          items.push(...collectClassMemberItems(sourceFile, sourceText, statement, name));
        }
      }
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      const kind = variableDeclarationKind(statement);
      for (const declaration of statement.declarationList.declarations) {
        const name = bindingNameText(declaration.name);
        if (name !== undefined) {
          items.push(itemFromNode(sourceFile, sourceText, statement, name, kind));
        }
      }
    }
  }
  return items;
}

function collectClassMemberItems(
  sourceFile: ts.SourceFile,
  sourceText: string,
  declaration: ts.ClassDeclaration,
  className: string,
): readonly TypeScriptItemQueryMatch[] {
  const items: TypeScriptItemQueryMatch[] = [];
  for (const member of declaration.members) {
    const memberName = classMemberName(member);
    if (memberName === undefined) continue;
    items.push(
      itemFromNode(
        sourceFile,
        sourceText,
        member,
        `${className}.${memberName}`,
        classMemberKind(member),
      ),
    );
  }
  return items;
}

function classMemberName(member: ts.ClassElement): string | undefined {
  if (ts.isConstructorDeclaration(member)) return "constructor";
  const name = member.name;
  if (name === undefined) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return compactNodeText(name.getSourceFile(), name);
  return undefined;
}

function classMemberKind(member: ts.ClassElement): string {
  if (ts.isConstructorDeclaration(member)) return "constructor";
  if (ts.isMethodDeclaration(member)) return "method";
  if (ts.isPropertyDeclaration(member)) return "property";
  if (ts.isGetAccessorDeclaration(member)) return "get";
  if (ts.isSetAccessorDeclaration(member)) return "set";
  return "member";
}

function itemFromNode(
  sourceFile: ts.SourceFile,
  sourceText: string,
  node: ts.Node,
  name: string,
  kind: string,
): TypeScriptItemQueryMatch {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  const lineStart = start.line + 1;
  const lineEnd = end.line + 1;
  const projectionNodes = projectionNodesForItem(sourceFile, node, name, kind);
  return {
    name,
    kind,
    exported: hasExportModifier(node),
    typeOnly: kind === "interface" || kind === "type",
    lineStart,
    lineEnd,
    column: start.character,
    sourceByteStart: Buffer.byteLength(sourceText.slice(0, node.getStart(sourceFile)), "utf8"),
    sourceByteEnd: Buffer.byteLength(sourceText.slice(0, node.getEnd()), "utf8"),
    code: sourceCompactCode(sourceText, lineStart, lineEnd),
    sourceLines: sourceText.split(/\r?\n/u),
    projectionNodes,
  };
}

function projectionNodesForItem(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  name: string,
  kind: string,
): readonly TypeScriptItemProjectionNode[] {
  const rootId = projectionNodeId(name);
  const rootRange = nodeRange(sourceFile, node);
  const rootLabel = declarationProjectionLabel(sourceFile, node, name, kind);
  const rootFlags = projectionFlagsForNode(node);
  const nodes: TypeScriptItemProjectionNode[] = [
    {
      id: rootId,
      nativeId: projectionNativeId(kind, rootRange, rootLabel),
      structuralFingerprint: projectionStructuralFingerprint(
        kind,
        "declaration",
        rootLabel,
        rootRange,
        rootFlags,
      ),
      kind,
      role: "declaration",
      label: rootLabel,
      depth: 0,
      lineStart: rootRange.lineStart,
      lineEnd: rootRange.lineEnd,
      flags: rootFlags,
    },
  ];
  collectProjectionChildNodes(sourceFile, node, {
    parentId: rootId,
    rootId,
    depth: 1,
    nodes,
  });
  if (nodes.length < projectionNodeLimit) {
    const delimiter = closingDelimiterProjectionNode({
      sourceFile,
      astNode: node,
      parentId: rootId,
      depth: 0,
      parentKind: kind,
      parentLabel: rootLabel,
    });
    if (delimiter !== undefined) nodes.push(delimiter);
  }
  return uniqueProjectionNodes(nodes).slice(0, projectionNodeLimit);
}

interface ProjectionNodeContext {
  readonly parentId: string;
  readonly parentKind?: string;
  readonly rootId: string;
  readonly depth: number;
  readonly nodes: TypeScriptItemProjectionNode[];
}

function collectProjectionChildNodes(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  context: ProjectionNodeContext,
): void {
  node.forEachChild((child) => {
    const projection = projectionNodeForAstNode(sourceFile, child, context);
    const nextContext =
      projection === undefined
        ? context
        : {
            parentId: projection.id,
            parentKind: projection.kind,
            rootId: context.rootId,
            depth: Math.min(context.depth + 1, 8),
            nodes: context.nodes,
          };
    if (projection !== undefined && context.nodes.length < projectionNodeLimit) {
      context.nodes.push(projection);
    }
    collectProjectionChildNodes(sourceFile, child, nextContext);
    if (projection !== undefined && context.nodes.length < projectionNodeLimit) {
      const delimiter = closingDelimiterProjectionNode({
        sourceFile,
        astNode: child,
        parentId: projection.id,
        depth: projection.depth,
        parentKind: projection.kind,
        parentLabel: projection.label,
      });
      if (delimiter !== undefined) context.nodes.push(delimiter);
    }
  });
}

function projectionNodeForAstNode(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  context: ProjectionNodeContext,
): TypeScriptItemProjectionNode | undefined {
  const kind = projectionKindForNode(node);
  if (kind === undefined) return undefined;
  if (shouldOmitNestedProjectionKind(kind, context)) return undefined;
  const range = nodeRange(sourceFile, node);
  const label = projectionLabelForNode(node, kind);
  const role = projectionRoleForKind(kind);
  const flags = projectionFlagsForKind(kind);
  return {
    id: projectionNodeIdForAstNode(context.rootId, kind, range, label),
    parentId: context.parentId,
    nativeId: projectionNativeId(ts.SyntaxKind[node.kind] ?? kind, range, label),
    structuralFingerprint: projectionStructuralFingerprint(kind, role, label, range, flags),
    kind,
    role,
    label,
    depth: context.depth,
    lineStart: range.lineStart,
    lineEnd: range.lineEnd,
    flags,
  };
}

interface ClosingDelimiterContext {
  readonly sourceFile: ts.SourceFile;
  readonly astNode: ts.Node;
  readonly parentId: TypeScriptProjectionIdentity;
  readonly depth: number;
  readonly parentKind: string;
  readonly parentLabel: string;
}

function closingDelimiterProjectionNode(
  context: ClosingDelimiterContext,
): TypeScriptItemProjectionNode | undefined {
  if (!projectionLabelOpensBlock(context.parentLabel)) return undefined;
  const parentRange = nodeRange(context.sourceFile, context.astNode);
  const range = { lineStart: parentRange.lineEnd, lineEnd: parentRange.lineEnd };
  const label = "}";
  const kind = "delimiter";
  const flags = ["delimiter"];
  return {
    id: `${context.parentId}:end`,
    parentId: context.parentId,
    nativeId: projectionNativeId(kind, range, `${context.parentKind}:${context.parentId}:${label}`),
    structuralFingerprint: projectionStructuralFingerprint(kind, "delimiter", label, range, flags),
    kind,
    role: "delimiter",
    label,
    depth: context.depth,
    lineStart: range.lineStart,
    lineEnd: range.lineEnd,
    flags,
  };
}

function projectionLabelOpensBlock(label: string): boolean {
  return label.trimEnd().endsWith("{");
}

function uniqueProjectionNodes(
  nodes: readonly TypeScriptItemProjectionNode[],
): readonly TypeScriptItemProjectionNode[] {
  const emittedIds = new Set<string>();
  const unique: TypeScriptItemProjectionNode[] = [];
  for (const node of nodes) {
    if (emittedIds.has(node.id)) continue;
    if (node.parentId !== undefined && !emittedIds.has(node.parentId)) {
      continue;
    }
    emittedIds.add(node.id);
    unique.push(node);
  }
  return unique;
}

function projectionNodeIdForAstNode(
  rootId: string,
  kind: string,
  range: ReturnType<typeof nodeRange>,
  label: string,
): string {
  return [
    rootId,
    safeProjectionIdPart(kind),
    String(range.lineStart),
    String(range.lineEnd),
    stableProjectionHash(label),
  ].join(":");
}

function projectionNativeId(
  kind: string,
  range: ReturnType<typeof nodeRange>,
  label: string,
): string {
  return [
    "typescript",
    safeProjectionIdPart(kind),
    String(range.lineStart),
    String(range.lineEnd),
    stableProjectionHash(label),
  ].join(":");
}

function projectionStructuralFingerprint(
  kind: string,
  role: TypeScriptItemProjectionNode["role"],
  label: string,
  range: ReturnType<typeof nodeRange>,
  flags: readonly string[],
): string {
  return [
    safeProjectionIdPart(kind),
    role,
    String(range.lineStart),
    String(range.lineEnd),
    stableProjectionHash(`${label}:${flags.join(",")}`),
  ].join(":");
}

function safeProjectionIdPart(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.-]+/gu, "-");
  return normalized.length === 0 ? "node" : normalized;
}

function stableProjectionHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function shouldOmitNestedProjectionKind(kind: string, context: ProjectionNodeContext): boolean {
  if (kind !== "call") return false;
  return expressionCarrierProjectionKinds.has(context.parentKind ?? "");
}

const expressionCarrierProjectionKinds = new Set([
  "assign",
  "case",
  "const",
  "if",
  "let",
  "return",
  "switch",
  "throw",
  "var",
]);

function projectionKindForNode(node: ts.Node): string | undefined {
  if (ts.isDecorator(node)) return "decorator";
  if (ts.isVariableStatement(node)) return variableDeclarationKind(node);
  if (ts.isParameter(node) && isParameterProperty(node)) return "field";
  if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) return "field";
  if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) return "method";
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isEnumMember(node)) return "member";
  if (ts.isIfStatement(node)) return "if";
  if (ts.isSwitchStatement(node)) return "switch";
  if (ts.isCaseClause(node)) return "case";
  if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node))
    return "for";
  if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return "while";
  if (ts.isTryStatement(node)) return "try";
  if (ts.isReturnStatement(node)) return "return";
  if (ts.isThrowStatement(node)) return "throw";
  if (ts.isBreakStatement(node)) return "break";
  if (ts.isContinueStatement(node)) return "continue";
  if (ts.isAwaitExpression(node)) return "await";
  if (ts.isCallExpression(node)) return "call";
  if (ts.isBinaryExpression(node) && assignmentOperatorText(node.operatorToken.kind) !== undefined)
    return "assign";
  return undefined;
}

function projectionRoleForKind(
  kind: string,
):
  | "declaration"
  | "field"
  | "control-flow"
  | "call"
  | "terminal"
  | "mutation"
  | "effect"
  | "unknown" {
  if (kind === "field") return "field";
  if (["decorator", "method", "constructor", "member"].includes(kind)) return "declaration";
  if (["if", "switch", "case", "for", "while", "try"].includes(kind)) return "control-flow";
  if (kind === "call") return "call";
  if (["return", "throw", "break", "continue"].includes(kind)) return "terminal";
  if (["assign", "const", "let", "var"].includes(kind)) return "mutation";
  if (kind === "await") return "effect";
  return "unknown";
}

function projectionFlagsForKind(kind: string): readonly string[] {
  if (kind === "field") return ["field"];
  if (kind === "decorator") return ["decorator"];
  if (["if", "switch", "case"].includes(kind)) return ["branch"];
  if (["for", "while"].includes(kind)) return ["loop"];
  if (kind === "call") return ["call"];
  if (kind === "return") return ["return"];
  if (kind === "throw") return ["throw"];
  if (kind === "break") return ["break"];
  if (kind === "continue") return ["continue"];
  if (kind === "await") return ["await"];
  if (kind === "assign" || kind === "const" || kind === "let" || kind === "var")
    return ["mutation"];
  return [];
}

function projectionFlagsForNode(node: ts.Node): readonly string[] {
  const flags = new Set<string>();
  const visit = (current: ts.Node): void => {
    for (const decorator of decoratorsForNode(current)) {
      if (decorator !== undefined) flags.add("decorator");
    }
    for (const flag of projectionFlagsForKind(projectionKindForNode(current) ?? "")) {
      flags.add(flag);
    }
    current.forEachChild(visit);
  };
  visit(node);
  return [...flags];
}

function projectionLabelForNode(node: ts.Node, kind: string): string {
  if (ts.isDecorator(node)) return `@${compactNodeText(node.getSourceFile(), node.expression)}`;
  if (ts.isCallExpression(node)) return callExpressionLabel(node);
  if (ts.isVariableStatement(node)) return variableStatementLabel(node);
  if (ts.isIfStatement(node))
    return `if (${compactNodeText(node.getSourceFile(), node.expression)}) {`;
  if (ts.isForOfStatement(node))
    return `for (${forInitializerLabel(node.getSourceFile(), node.initializer)} of ${compactNodeText(node.getSourceFile(), node.expression)}) {`;
  if (ts.isForInStatement(node))
    return `for (${forInitializerLabel(node.getSourceFile(), node.initializer)} in ${compactNodeText(node.getSourceFile(), node.expression)}) {`;
  if (ts.isForStatement(node)) return forStatementLabel(node);
  if (ts.isWhileStatement(node))
    return `while (${compactNodeText(node.getSourceFile(), node.expression)}) {`;
  if (ts.isParameter(node) && kind === "field") return parameterPropertyLabel(node);
  if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node))
    return propertyLikeLabel(node);
  if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) return methodLikeLabel(node);
  if (ts.isConstructorDeclaration(node)) return constructorLabel(node);
  if (ts.isEnumMember(node)) return `${compactNodeText(node.getSourceFile(), node.name)},`;
  if (ts.isReturnStatement(node))
    return node.expression ? `return ${expressionProjectionLabel(node.expression)};` : "return;";
  if (ts.isThrowStatement(node))
    return node.expression ? `throw ${expressionProjectionLabel(node.expression)};` : "throw;";
  if (ts.isBinaryExpression(node) && kind === "assign") return assignmentLabel(node);
  return kind;
}

function callExpressionLabel(node: ts.CallExpression): string {
  const sourceFile = node.getSourceFile();
  const callee = compactNodeText(sourceFile, node.expression);
  const args = node.arguments.map((argument) => expressionProjectionLabel(argument));
  return `${callee}(${args.join(", ")});`;
}

function expressionProjectionLabel(node: ts.Expression): string {
  if (ts.isCallExpression(node)) return compactNodeText(node.getSourceFile(), node);
  if (ts.isFunctionExpression(node)) return node.name ? `function ${node.name.text}` : "function";
  if (ts.isArrowFunction(node)) return "arrow";
  if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) return "template";
  if (ts.isStringLiteralLike(node)) return "string";
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isObjectLiteralExpression(node)) return objectLiteralSummary(node);
  if (ts.isArrayLiteralExpression(node)) return arrayLiteralSummary(node);
  if (ts.isNewExpression(node))
    return `new ${compactNodeText(node.getSourceFile(), node.expression)}`;
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
    return "boolean";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return compactNodeText(node.getSourceFile(), node);
}

function arrayLiteralSummary(node: ts.ArrayLiteralExpression): string {
  const labels = node.elements
    .slice(0, 3)
    .map((element) => collectionItemSummary(element))
    .filter((label) => label.length > 0);
  if (labels.length === 0) return `array[${node.elements.length}]`;
  return `array[${node.elements.length}] items=${labels.join(",")}`;
}

function collectionItemSummary(node: ts.Expression): string {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return node.text;
  if (ts.isObjectLiteralExpression(node)) return limitSummary(objectLiteralSummary(node), 72);
  if (ts.isArrayLiteralExpression(node)) return limitSummary(arrayLiteralSummary(node), 72);
  return expressionProjectionLabel(node);
}

function objectLiteralSummary(node: ts.ObjectLiteralExpression): string {
  const entries = node.properties
    .slice(0, 4)
    .map((property) => objectPropertySummary(property))
    .filter((entry) => entry.length > 0);
  const keys = node.properties
    .slice(entries.length)
    .map((property) => objectPropertyName(property));
  if (keys.length > 0) {
    entries.push(
      `keys=${keys
        .filter((key) => key.length > 0)
        .slice(0, 6)
        .join(",")}`,
    );
  }
  if (entries.length === 0) return `object[${node.properties.length}]`;
  return `object[${node.properties.length}] ${entries.join(" ")}`;
}

function objectPropertySummary(property: ts.ObjectLiteralElementLike): string {
  if (ts.isPropertyAssignment(property)) {
    const name = objectPropertyName(property);
    if (name.length === 0) return "";
    return `${name}=${objectPropertyValueSummary(property.initializer)}`;
  }
  if (ts.isSpreadAssignment(property))
    return `...${expressionProjectionLabel(property.expression)}`;
  if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
  if (ts.isMethodDeclaration(property)) return `${objectPropertyName(property)}()`;
  return objectPropertyName(property);
}

function objectPropertyName(property: ts.ObjectLiteralElementLike): string {
  const name = property.name;
  if (name === undefined) return "";
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return limitSummary(compactNodeText(name.getSourceFile(), name), 32);
}

function objectPropertyValueSummary(node: ts.Expression): string {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return node.text;
  if (ts.isObjectLiteralExpression(node)) return `object[${node.properties.length}]`;
  if (ts.isArrayLiteralExpression(node)) return arrayLiteralSummary(node);
  return expressionProjectionLabel(node);
}

function limitSummary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function nodeRange(
  sourceFile: ts.SourceFile,
  node: ts.Node,
): { readonly lineStart: number; readonly lineEnd: number } {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return { lineStart: start.line + 1, lineEnd: end.line + 1 };
}

function projectionNodeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]+/gu, "_");
}

function itemMatches(
  items: readonly TypeScriptItemQueryMatch[],
  terms: readonly string[],
): readonly TypeScriptItemQueryMatch[] {
  if (terms.length === 0) return items;
  const exact = items.filter((item) => terms.includes(item.name));
  if (exact.length > 0) return exact;
  const lowerTerms = terms.map((term) => term.toLowerCase());
  return items.filter((item) => lowerTerms.some((term) => item.name.toLowerCase().includes(term)));
}

function fallbackTopLevelItems(
  items: readonly TypeScriptItemQueryMatch[],
): readonly TypeScriptItemQueryMatch[] {
  return [...items]
    .sort((left, right) => itemFallbackRank(left) - itemFallbackRank(right))
    .slice(0, 4);
}

function itemFallbackRank(item: TypeScriptItemQueryMatch): number {
  let rank = item.lineStart;
  if (!item.exported) rank += 10_000;
  if (item.kind === "interface") rank -= 50;
  if (item.kind === "const" || item.kind === "let" || item.kind === "var") rank += 250;
  return rank;
}

function sourceCompactCode(sourceText: string, lineStart: number, lineEnd: number): string {
  return sourceText
    .split(/\r\n|\r|\n/u)
    .slice(lineStart - 1, lineEnd)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isStandalonePunctuationLine(line))
    .join("\n");
}

function isStandalonePunctuationLine(line: string): boolean {
  return /^[{}()[\].,;:]+$/u.test(line);
}

function declarationProjectionLabel(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  name: string,
  kind: string,
): string {
  if (ts.isFunctionDeclaration(node)) {
    const asyncPrefix = node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
    )
      ? "async "
      : "";
    const parameters = node.parameters.map((parameter) => parameterLabel(sourceFile, parameter));
    const returnType = node.type ? `: ${compactNodeText(sourceFile, node.type)}` : "";
    return `${decoratorPrefix(node)}${asyncPrefix}function ${name}(${parameters.join(", ")})${returnType} {`;
  }
  if (ts.isClassDeclaration(node)) return `${decoratorPrefix(node)}class ${name} {`;
  if (ts.isInterfaceDeclaration(node)) return `interface ${name} {`;
  if (ts.isTypeAliasDeclaration(node)) {
    return `type ${name} = ${compactNodeText(sourceFile, node.type)}`;
  }
  if (ts.isEnumDeclaration(node)) return `enum ${name} {`;
  return `${kind} ${name}`;
}

function variableStatementLabel(node: ts.VariableStatement): string {
  const declarations = node.declarationList.declarations
    .map(
      (declaration) =>
        bindingNameText(declaration.name) ??
        compactNodeText(node.getSourceFile(), declaration.name),
    )
    .join(", ");
  return `${declarationListKind(node.declarationList)} ${declarations};`;
}

function declarationListKind(declarationList: ts.VariableDeclarationList): string {
  if ((declarationList.flags & ts.NodeFlags.Const) !== 0) return "const";
  if ((declarationList.flags & ts.NodeFlags.Let) !== 0) return "let";
  return "var";
}

function forInitializerLabel(sourceFile: ts.SourceFile, initializer: ts.ForInitializer): string {
  if (ts.isVariableDeclarationList(initializer)) {
    return initializer.declarations
      .map(
        (declaration) =>
          bindingNameText(declaration.name) ?? compactNodeText(sourceFile, declaration.name),
      )
      .join(", ");
  }
  return compactNodeText(sourceFile, initializer);
}

function forStatementLabel(node: ts.ForStatement): string {
  const sourceFile = node.getSourceFile();
  const initializer =
    node.initializer === undefined ? "" : compactNodeText(sourceFile, node.initializer);
  const condition = node.condition === undefined ? "" : compactNodeText(sourceFile, node.condition);
  const incrementor =
    node.incrementor === undefined ? "" : compactNodeText(sourceFile, node.incrementor);
  return `for (${initializer}; ${condition}; ${incrementor}) {`;
}

function assignmentLabel(node: ts.BinaryExpression): string {
  const sourceFile = node.getSourceFile();
  const operator = assignmentOperatorText(node.operatorToken.kind) ?? "=";
  return `${compactNodeText(sourceFile, node.left)} ${operator} ${compactNodeText(sourceFile, node.right)};`;
}

function assignmentOperatorText(kind: ts.SyntaxKind): string | undefined {
  const operators: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.EqualsToken]: "=",
    [ts.SyntaxKind.PlusEqualsToken]: "+=",
    [ts.SyntaxKind.MinusEqualsToken]: "-=",
    [ts.SyntaxKind.AsteriskEqualsToken]: "*=",
    [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: "**=",
    [ts.SyntaxKind.SlashEqualsToken]: "/=",
    [ts.SyntaxKind.PercentEqualsToken]: "%=",
    [ts.SyntaxKind.LessThanLessThanEqualsToken]: "<<=",
    [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ">>=",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: ">>>=",
    [ts.SyntaxKind.AmpersandEqualsToken]: "&=",
    [ts.SyntaxKind.BarEqualsToken]: "|=",
    [ts.SyntaxKind.CaretEqualsToken]: "^=",
  };
  return operators[kind];
}

function propertyLikeLabel(node: ts.PropertySignature | ts.PropertyDeclaration): string {
  const sourceFile = node.getSourceFile();
  const name = compactNodeText(sourceFile, node.name);
  const readonly = hasReadonlyModifier(node) ? "readonly " : "";
  const optional = "questionToken" in node && node.questionToken ? "?" : "";
  const type = node.type ? `: ${compactNodeText(sourceFile, node.type)}` : "";
  return `${readonly}${name}${optional}${type};`;
}

function parameterPropertyLabel(node: ts.ParameterDeclaration): string {
  const sourceFile = node.getSourceFile();
  const name = bindingNameText(node.name) ?? compactNodeText(sourceFile, node.name);
  const readonly = hasReadonlyModifier(node) ? "readonly " : "";
  const type = node.type ? `: ${compactNodeText(sourceFile, node.type)}` : "";
  return `${readonly}${name}${type};`;
}

function constructorLabel(node: ts.ConstructorDeclaration): string {
  const sourceFile = node.getSourceFile();
  const parameters = node.parameters.map((parameter) => parameterLabel(sourceFile, parameter));
  return `constructor(${parameters.join(", ")}) {`;
}

function isParameterProperty(node: ts.ParameterDeclaration): boolean {
  const modifiers = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  return modifiers.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.PublicKeyword ||
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
      modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
  );
}

function methodLikeLabel(node: ts.MethodSignature | ts.MethodDeclaration): string {
  const sourceFile = node.getSourceFile();
  const name = compactNodeText(sourceFile, node.name);
  const asyncPrefix = node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
  )
    ? "async "
    : "";
  const parameters = node.parameters.map((parameter) => parameterLabel(sourceFile, parameter));
  const returnType = node.type ? `: ${compactNodeText(sourceFile, node.type)}` : "";
  const delimiter = ts.isMethodSignature(node) ? ";" : " {";
  return `${decoratorPrefix(node)}${asyncPrefix}${name}(${parameters.join(", ")})${returnType}${delimiter}`;
}

function decoratorPrefix(node: ts.Node): string {
  const decorators = decoratorsForNode(node);
  if (decorators.length === 0) return "";
  return `${decorators
    .map((decorator) => `@${compactNodeText(node.getSourceFile(), decorator.expression)}`)
    .join(" ")} `;
}

function decoratorsForNode(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function parameterLabel(sourceFile: ts.SourceFile, parameter: ts.ParameterDeclaration): string {
  const name = compactNodeText(sourceFile, parameter.name);
  const optional = parameter.questionToken ? "?" : "";
  const type = parameter.type ? `: ${compactNodeText(sourceFile, parameter.type)}` : "";
  return `${name}${optional}${type}`;
}

function compactNodeText(sourceFile: ts.SourceFile, node: ts.Node): string {
  return node.getText(sourceFile).replace(/\s+/gu, " ").trim();
}

function declarationKind(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  return "item";
}

function variableDeclarationKind(statement: ts.VariableStatement): string {
  const flags = statement.declarationList.flags;
  if ((flags & ts.NodeFlags.Const) !== 0) return "const";
  if ((flags & ts.NodeFlags.Let) !== 0) return "let";
  return "var";
}

function bindingNameText(name: ts.BindingName): string | undefined {
  if (ts.isIdentifier(name)) return name.text;
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function hasReadonlyModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
    )
  );
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
