/**
 * Public rendering facade for ASP TypeScript output.
 *
 * This module re-exports compact text, agent snapshot, and verification
 * renderers used by the CLI and library consumers.
 */
export {
  renderAspTypeScriptAdvice,
  renderAspTypeScriptAgentCompactText,
} from "./render/agent_compact_text.js";
export type {
  TypeScriptAgentCompactTextFindingMode,
  TypeScriptAgentCompactTextOptions,
} from "./render/agent_compact_text.js";

export { renderAspTypeScript, renderAssertionMessage } from "./render/agent-snapshot.js";
export { renderAspTypeScriptJson } from "./render/json.js";
export {
  renderTypeScriptReasoningTree,
  renderAspTypeScriptAgentSnapshot,
} from "./render/agent-snapshot.js";
export type { TypeScriptRenderOptions } from "./render/agent-snapshot.js";
