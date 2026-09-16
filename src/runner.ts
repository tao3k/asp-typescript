/**
 * Public runner facade for ASP TypeScript execution.
 *
 * This module re-exports project run, assertion, and verification entrypoints
 * while keeping parser and policy internals behind stable APIs.
 */
export {
  runAspTypeScript,
  runAspTypeScriptAgentSnapshot,
  buildAspTypeScriptAgentSnapshot,
} from "./runner/run-project.js";
export { runAspTypeScriptPaths, assertAspTypeScriptPathsClean } from "./runner/run-paths.js";
export {
  assertAspTypeScriptClean,
  assertAspTypeScriptAgentClean,
  assertAspTypeScriptEmbeddedClean,
} from "./runner/assert-clean.js";
export type { AspTypeScriptEmbeddedOptions } from "./runner/run-project.js";
