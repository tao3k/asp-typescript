/**
 * Native diagnostic conversion for TypeScript compiler output.
 *
 * This module maps TypeScript diagnostics into ASP TypeScript locations and severities
 * without losing related diagnostic information.
 */
import ts from "typescript";

import type {
  SourceLocation,
  TypeScriptNativeDiagnostic,
  TypeScriptNativeDiagnosticRelatedInformation,
} from "../model.js";

export function nativeDiagnosticFromTsDiagnostic(
  diagnostic: ts.Diagnostic,
  fallbackPath: string,
  sourceText?: string,
): TypeScriptNativeDiagnostic {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const diagnosticFile = diagnostic.file;
  const diagnosticSourceText = diagnosticFile?.text ?? sourceText;
  let location: SourceLocation = { path: fallbackPath, line: 1, column: 0 };
  if (diagnosticFile !== undefined && diagnostic.start !== undefined) {
    const lineAndCharacter = diagnosticFile.getLineAndCharacterOfPosition(diagnostic.start);
    location = {
      path: diagnosticFile.fileName,
      line: lineAndCharacter.line + 1,
      column: lineAndCharacter.character,
    };
  }
  const nativeDiagnostic: TypeScriptNativeDiagnostic = {
    code: diagnostic.code,
    message,
    category: diagnosticCategory(diagnostic.category),
    location,
    relatedInformation: (diagnostic.relatedInformation ?? []).map((relatedDiagnostic) =>
      nativeRelatedInformationFromTsDiagnostic(relatedDiagnostic, fallbackPath, sourceText),
    ),
  };
  const withSource =
    diagnostic.source === undefined
      ? nativeDiagnostic
      : { ...nativeDiagnostic, source: diagnostic.source };
  const sourceLine =
    diagnosticSourceText === undefined
      ? undefined
      : sourceLineAt(diagnosticSourceText, location.line);
  if (sourceLine !== undefined) {
    return { ...withSource, sourceLine };
  }
  return withSource;
}

export function nativeRelatedInformationFromTsDiagnostic(
  diagnostic: ts.DiagnosticRelatedInformation,
  fallbackPath: string,
  sourceText?: string,
): TypeScriptNativeDiagnosticRelatedInformation {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const diagnosticFile = diagnostic.file;
  const diagnosticSourceText = diagnosticFile?.text ?? sourceText;
  let location: SourceLocation = { path: fallbackPath, line: 1, column: 0 };
  if (diagnosticFile !== undefined && diagnostic.start !== undefined) {
    const lineAndCharacter = diagnosticFile.getLineAndCharacterOfPosition(diagnostic.start);
    location = {
      path: diagnosticFile.fileName,
      line: lineAndCharacter.line + 1,
      column: lineAndCharacter.character,
    };
  }
  const nativeDiagnostic: TypeScriptNativeDiagnosticRelatedInformation = {
    code: diagnostic.code,
    message,
    category: diagnosticCategory(diagnostic.category),
    location,
  };
  const sourceLine =
    diagnosticSourceText === undefined
      ? undefined
      : sourceLineAt(diagnosticSourceText, location.line);
  if (sourceLine !== undefined) {
    return { ...nativeDiagnostic, sourceLine };
  }
  return nativeDiagnostic;
}

export function diagnosticCategory(
  category: ts.DiagnosticCategory,
): TypeScriptNativeDiagnostic["category"] {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return "error";
    case ts.DiagnosticCategory.Warning:
      return "warning";
    case ts.DiagnosticCategory.Message:
      return "info";
    case ts.DiagnosticCategory.Suggestion:
      return "info";
  }
}

export function locationForNode(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    path: sourceFile.fileName,
    line: location.line + 1,
    column: location.character,
  };
}

export function parseDiagnosticsForSourceFile(sourceFile: ts.SourceFile): readonly ts.Diagnostic[] {
  return (
    (
      sourceFile as ts.SourceFile & {
        readonly parseDiagnostics?: readonly ts.Diagnostic[];
      }
    ).parseDiagnostics ?? []
  );
}

export function sourceLineAt(sourceText: string, line: number): string | undefined {
  return sourceText.split(/\r\n|\r|\n/u)[line - 1];
}
