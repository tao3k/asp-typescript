import { Buffer } from "node:buffer";
import ts from "typescript";

interface WireByteSpan {
  readonly start: number;
  readonly end: number;
}

interface WireAstNodeAttr {
  readonly key: string;
  readonly value: string;
}

interface WireAstNodeSpanRecord {
  readonly locator: string;
  readonly kind: string;
  readonly languageKind: string;
  readonly name: string;
  readonly line: number;
  readonly outerSpan: WireByteSpan;
  readonly innerSpan: WireByteSpan;
  readonly bodySpan?: WireByteSpan;
  readonly parent?: string;
  readonly attrs: readonly WireAstNodeAttr[];
}

interface WireAstSyntaxDiagnostic {
  readonly byteStart: number;
  readonly byteEnd: number;
  readonly message: string;
  readonly expectedTokens: readonly string[];
}

function utf8Offset(source: string, utf16Pos: number): number {
  const clamped = Math.max(0, Math.min(utf16Pos, source.length));
  return Buffer.byteLength(source.slice(0, clamped), "utf8");
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parseSourceFile(filePath: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath),
  );
}

function extractParseDiagnostics(
  sf: ts.SourceFile,
  source: string,
): readonly WireAstSyntaxDiagnostic[] {
  const raw = (sf as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] })
    .parseDiagnostics;
  if (!raw || raw.length === 0) return [];
  return raw.map((diag) => {
    const start = diag.start ?? 0;
    const end = start + (diag.length ?? 0);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
    const expectedTokens: string[] = [];
    for (const tok of [";", "}", ")", "]", ","]) {
      if (message.includes(`'${tok}'`) || message.includes(`\`${tok}\``)) {
        expectedTokens.push(tok);
      }
    }
    return {
      byteStart: utf8Offset(source, start),
      byteEnd: utf8Offset(source, end),
      message,
      expectedTokens,
    };
  });
}

function lineNumberAt(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function blockInteriorSpan(source: string, block: ts.Block): WireByteSpan {
  const start = utf8Offset(source, block.getStart());
  const end = utf8Offset(source, block.getEnd());
  if (end >= start + 2) {
    return { start: start + 1, end: end - 1 };
  }
  return { start, end };
}

interface WireAstSemanticEdge {
  readonly src: string;
  readonly dst: string;
  readonly relation: string;
  readonly line: number;
}

function nodeAttrs(node: ts.Node): WireAstNodeAttr[] {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const attrs: WireAstNodeAttr[] = [];
  let hasVisibility = false;
  if (modifiers) {
    for (const mod of modifiers) {
      if (mod.kind === ts.SyntaxKind.ExportKeyword) {
        attrs.push({ key: "visibility", value: "export" });
        attrs.push({ key: "exported", value: "true" });
        hasVisibility = true;
      } else if (mod.kind === ts.SyntaxKind.PrivateKeyword) {
        attrs.push({ key: "visibility", value: "private" });
        hasVisibility = true;
      } else if (mod.kind === ts.SyntaxKind.ProtectedKeyword) {
        attrs.push({ key: "visibility", value: "protected" });
        hasVisibility = true;
      } else if (mod.kind === ts.SyntaxKind.PublicKeyword) {
        attrs.push({ key: "visibility", value: "public" });
        hasVisibility = true;
      } else if (mod.kind === ts.SyntaxKind.AsyncKeyword) {
        attrs.push({ key: "async", value: "true" });
      } else if (mod.kind === ts.SyntaxKind.AbstractKeyword) {
        attrs.push({ key: "abstract", value: "true" });
      } else if (mod.kind === ts.SyntaxKind.StaticKeyword) {
        attrs.push({ key: "static", value: "true" });
      } else if (mod.kind === ts.SyntaxKind.ReadonlyKeyword) {
        attrs.push({ key: "readonly", value: "true" });
      }
    }
  }
  if (!hasVisibility) {
    attrs.push({ key: "visibility", value: "private" });
  }
  return attrs;
}

function collectBodyCallsAndErrors(
  sf: ts.SourceFile,
  callerLocator: string,
  body: ts.Block,
  edges: WireAstSemanticEdge[],
  attrs: WireAstNodeAttr[],
): void {
  const seenCalls = new Set<string>();
  const seenErrors = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      let callee: string | undefined;
      if (ts.isIdentifier(node.expression)) {
        callee = node.expression.text;
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        callee = node.expression.name.text;
      }
      if (callee) {
        const line = lineNumberAt(sf, node.getStart(sf));
        const key = `${callee}@${line}`;
        if (!seenCalls.has(key)) {
          seenCalls.add(key);
          edges.push({ src: callerLocator, dst: callee, relation: "calls", line });
        }
      }
    } else if (ts.isThrowStatement(node) && node.expression) {
      let arg: ts.Expression | undefined;
      if (ts.isNewExpression(node.expression) && node.expression.arguments?.length) {
        arg = node.expression.arguments[0];
      } else if (ts.isCallExpression(node.expression) && node.expression.arguments.length) {
        arg = node.expression.arguments[0];
      }
      if (arg && ts.isStringLiteral(arg)) {
        const msg = arg.text;
        if (msg.length >= 3 && msg.length <= 120 && seenErrors.size < 8 && !seenErrors.has(msg)) {
          seenErrors.add(msg);
          attrs.push({ key: "error_literal", value: msg });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
}

function buildLocator(path: string, parent: string | undefined, tag: string, name: string): string {
  return parent ? `${parent}#${tag}:${name}` : `${path}#${tag}:${name}`;
}

function collectNodes(
  sf: ts.SourceFile,
  path: string,
  source: string,
  parent: string | undefined,
  statements: readonly ts.Statement[],
  out: WireAstNodeSpanRecord[],
  edges: WireAstSemanticEdge[],
): void {
  for (const stmt of statements) {
    const outerStart = utf8Offset(source, stmt.getFullStart());
    const innerStart = utf8Offset(source, stmt.getStart(sf));
    const end = utf8Offset(source, stmt.getEnd());
    const line = lineNumberAt(sf, stmt.getStart(sf));
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      const locator = buildLocator(path, parent, "fn", name);
      const attrs = nodeAttrs(stmt);
      if (stmt.body) {
        collectBodyCallsAndErrors(sf, locator, stmt.body, edges, attrs);
      }
      out.push({
        locator,
        kind: "function",
        languageKind: "function_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(stmt.body ? { bodySpan: blockInteriorSpan(source, stmt.body) } : {}),
        ...(parent ? { parent } : {}),
        attrs,
      });
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      const locator = buildLocator(path, parent, "class", name);
      const attrs = nodeAttrs(stmt);
      if (stmt.heritageClauses) {
        for (const hc of stmt.heritageClauses) {
          for (const hType of hc.types) {
            const target = hType.expression.getText(sf).trim();
            if (target) {
              attrs.push({ key: "implements", value: target });
              edges.push({ src: locator, dst: target, relation: "implements", line });
            }
          }
        }
      }
      out.push({
        locator,
        kind: "struct",
        languageKind: "class_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs,
      });
      for (const member of stmt.members) {
        if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
          const mName = member.name.text;
          const mOuter = utf8Offset(source, member.getFullStart());
          const mInner = utf8Offset(source, member.getStart(sf));
          const mEnd = utf8Offset(source, member.getEnd());
          const mLocator = `${locator}#fn:${mName}`;
          const mAttrs = nodeAttrs(member);
          if (member.body) {
            collectBodyCallsAndErrors(sf, mLocator, member.body, edges, mAttrs);
          }
          out.push({
            locator: mLocator,
            kind: "method",
            languageKind: "method_declaration",
            name: mName,
            line: lineNumberAt(sf, member.getStart(sf)),
            outerSpan: { start: mOuter, end: mEnd },
            innerSpan: { start: mInner, end: mEnd },
            ...(member.body ? { bodySpan: blockInteriorSpan(source, member.body) } : {}),
            parent: locator,
            attrs: mAttrs,
          });
        }
      }
    } else if (ts.isEnumDeclaration(stmt)) {
      const name = stmt.name.text;
      out.push({
        locator: buildLocator(path, parent, "enum", name),
        kind: "enum",
        languageKind: "enum_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs: nodeAttrs(stmt),
      });
    } else if (ts.isInterfaceDeclaration(stmt)) {
      const name = stmt.name.text;
      out.push({
        locator: buildLocator(path, parent, "interface", name),
        kind: "trait",
        languageKind: "interface_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs: nodeAttrs(stmt),
      });
    } else if (ts.isTypeAliasDeclaration(stmt)) {
      const name = stmt.name.text;
      out.push({
        locator: buildLocator(path, parent, "type", name),
        kind: "type",
        languageKind: "type_alias_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs: nodeAttrs(stmt),
      });
    } else if (ts.isImportDeclaration(stmt)) {
      const label = `import_line_${line}`;
      const importAttrs: WireAstNodeAttr[] = [];
      if (ts.isStringLiteral(stmt.moduleSpecifier)) {
        const target = stmt.moduleSpecifier.text;
        importAttrs.push({ key: "import_target", value: target });
        edges.push({ src: path, dst: target, relation: "imports", line });
      }
      out.push({
        locator: buildLocator(path, parent, "import", label),
        kind: "import",
        languageKind: "import_declaration",
        name: label,
        line,
        outerSpan: { start: innerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs: importAttrs,
      });
    }
  }
}

const TYPESCRIPT_SYNTAX_SURFACE = {
  lineComment: "//",
  blockComment: ["/*", "*/"],
  delimiterPairs: [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ],
  statementTerminator: ";",
  stringDelimiters: ['"', "'", "`"],
} as const;

export function handleAstInspect(payload: unknown): Record<string, unknown> {
  const req = payload as { path?: string; sourceUtf8?: string };
  const path = typeof req.path === "string" ? req.path : "source.ts";
  const source = typeof req.sourceUtf8 === "string" ? req.sourceUtf8 : "";
  const sf = parseSourceFile(path, source);
  const diagnostics = extractParseDiagnostics(sf, source);
  const nodes: WireAstNodeSpanRecord[] = [];
  const edges: WireAstSemanticEdge[] = [];
  collectNodes(sf, path, source, undefined, sf.statements, nodes, edges);
  return {
    accepted: diagnostics.length === 0,
    nodes,
    edges,
    diagnostics,
    syntaxSurface: TYPESCRIPT_SYNTAX_SURFACE,
  };
}

export function handleAstVerify(payload: unknown): Record<string, unknown> {
  const req = payload as {
    path?: string;
    candidates?: readonly { candidateId?: string; sourceUtf8?: string }[];
  };
  const path = typeof req.path === "string" ? req.path : "source.ts";
  const candidates = Array.isArray(req.candidates) ? req.candidates : [];
  const results = candidates.map((cand) => {
    const candidateId = typeof cand.candidateId === "string" ? cand.candidateId : "";
    const source = typeof cand.sourceUtf8 === "string" ? cand.sourceUtf8 : "";
    const sf = parseSourceFile(path, source);
    const diagnostics = extractParseDiagnostics(sf, source);
    return {
      candidateId,
      accepted: diagnostics.length === 0,
      diagnostics,
    };
  });
  return { results };
}
