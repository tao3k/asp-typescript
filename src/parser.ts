/**
 * Public parser facade for TypeScript project analysis.
 *
 * This module re-exports parser entrypoints and discovery helpers for callers
 * that should not depend on internal parser module layout.
 */
export {
  DEFAULT_IGNORED_DIR_NAMES,
  discoverTypeScriptFiles,
  isTypeScriptSourcePath,
  parseTypeScriptProjectFiles,
  parseTypeScriptSourceFile,
  pathFromInput,
  projectFileNames,
  readProjectResolution,
} from "./parser/index.js";
