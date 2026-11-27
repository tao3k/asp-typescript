/**
 * Finding model facade for ASP TypeScript diagnostics.
 *
 * This module re-exports diagnostic, rule, and finding types that form the
 * public advice payload boundary.
 */
export type {
  SourceLocation,
  TypeScriptDiagnosticSeverity,
  AspTypeScriptFinding,
} from "../model.js";
export {
  blockingFindings,
  advisoryFindings,
  isAspTypeScriptClean,
  fileCount,
  parsedCount,
} from "../model.js";
