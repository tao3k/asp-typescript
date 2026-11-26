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

function nodeAttrs(node: ts.Node): readonly WireAstNodeAttr[] {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (!modifiers) return [];
  const attrs: WireAstNodeAttr[] = [];
  for (const mod of modifiers) {
    if (mod.kind === ts.SyntaxKind.ExportKeyword) {
      attrs.push({ key: "visibility", value: "export" });
    } else if (mod.kind === ts.SyntaxKind.AsyncKeyword) {
      attrs.push({ key: "async", value: "true" });
    }
  }
  return attrs;
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
): void {
  for (const stmt of statements) {
    const outerStart = utf8Offset(source, stmt.getFullStart());
    const innerStart = utf8Offset(source, stmt.getStart(sf));
    const end = utf8Offset(source, stmt.getEnd());
    const line = lineNumberAt(sf, stmt.getStart(sf));
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      out.push({
        locator: buildLocator(path, parent, "fn", name),
        kind: "function",
        languageKind: "function_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(stmt.body ? { bodySpan: blockInteriorSpan(source, stmt.body) } : {}),
        ...(parent ? { parent } : {}),
        attrs: nodeAttrs(stmt),
      });
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      const locator = buildLocator(path, parent, "class", name);
      out.push({
        locator,
        kind: "struct",
        languageKind: "class_declaration",
        name,
        line,
        outerSpan: { start: outerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs: nodeAttrs(stmt),
      });
      for (const member of stmt.members) {
        if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
          const mName = member.name.text;
          const mOuter = utf8Offset(source, member.getFullStart());
          const mInner = utf8Offset(source, member.getStart(sf));
          const mEnd = utf8Offset(source, member.getEnd());
          out.push({
            locator: `${locator}#fn:${mName}`,
            kind: "method",
            languageKind: "method_declaration",
            name: mName,
            line: lineNumberAt(sf, member.getStart(sf)),
            outerSpan: { start: mOuter, end: mEnd },
            innerSpan: { start: mInner, end: mEnd },
            ...(member.body ? { bodySpan: blockInteriorSpan(source, member.body) } : {}),
            parent: locator,
            attrs: nodeAttrs(member),
          });
        }
      }
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
      out.push({
        locator: buildLocator(path, parent, "import", label),
        kind: "import",
        languageKind: "import_declaration",
        name: label,
        line,
        outerSpan: { start: innerStart, end },
        innerSpan: { start: innerStart, end },
        ...(parent ? { parent } : {}),
        attrs: [],
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
  collectNodes(sf, path, source, undefined, sf.statements, nodes);
  return {
    accepted: diagnostics.length === 0,
    nodes,
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
