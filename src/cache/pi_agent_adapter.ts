/**
 * PI agent cache adapter for ASP TypeScript reports.
 *
 * This module projects parser-owned reports into cache-aware context blocks
 * consumed by agent prompt assembly.
 */
import { buildCacheContext } from "./cache_context.js";
import { renderCacheBlocks, renderFullPrompt } from "./render_cache_context.js";

// ── Agent-facing interface ─────────────────────────────────

export interface PiAgentContext {
  /** Full rendered prompt — system + session + path + branch. */
  readonly prompt: string;
  /** System-only block (for cache warming). */
  readonly systemPrefix: string;
  /** Session-stable block (for cache warmth check). */
  readonly sessionPrefix: string;
  /** Combined fingerprint of all non-scratch atoms. */
  readonly fingerprint: string;
  /** Estimated token count of the full prompt. */
  readonly tokenEstimate: number;
  /** Scratch summary (for agent debugging). */
  readonly scratchSummary: string;
}

export interface PiAgentInput {
  readonly reasoningTreeText: string;
  readonly findingsText: string;
  readonly activeTarget?: string;
  readonly candidateStrategies?: string;
  readonly verificationPlanText?: string;
  readonly toolReceiptText?: string;
  readonly sourceRefs: readonly string[];
}

/**
 * Build a cache-friendly agent context from ASP TypeScript output.
 *
 * The agent should:
 * 1. Check if `systemPrefix` fingerprint matches cached prefix → reuse
 * 2. Check if `sessionPrefix` fingerprint matches → reuse
 * 3. Only send `pathBlock` + `branchBlock` as new tokens
 */
export function buildPiAgentContext(input: PiAgentInput): PiAgentContext {
  const assembled = buildCacheContext({
    reasoningTreeText: input.reasoningTreeText,
    findingsText: input.findingsText,
    sourceRefs: input.sourceRefs,
    ...(input.activeTarget !== undefined ? { activeTarget: input.activeTarget } : {}),
    ...(input.candidateStrategies !== undefined
      ? { candidateStrategies: input.candidateStrategies }
      : {}),
    ...(input.verificationPlanText !== undefined
      ? { verificationPlanText: input.verificationPlanText }
      : {}),
    ...(input.toolReceiptText !== undefined ? { toolReceiptText: input.toolReceiptText } : {}),
  });

  const blocks = renderCacheBlocks(assembled.partition);

  const systemPrefix = blocks.systemBlock;
  const sessionPrefix = blocks.systemBlock + "\n---\n" + blocks.sessionBlock;

  return {
    prompt: renderFullPrompt(blocks),
    systemPrefix,
    sessionPrefix,
    fingerprint: assembled.fingerprint,
    tokenEstimate: assembled.tokenEstimate,
    scratchSummary: blocks.scratchSummary,
  };
}

/** Compute cache reuse stats for agent logging. */
export function cacheReuseStats(
  prevFingerprint: string | undefined,
  currentFingerprint: string,
): { systemHit: boolean; sessionHit: boolean; pathChanged: boolean } {
  if (prevFingerprint === undefined) {
    return { systemHit: false, sessionHit: false, pathChanged: true };
  }

  // Simplified: if fingerprint changed at all, assume session changed.
  // A production version would compare per-class fingerprints.
  const hit = prevFingerprint === currentFingerprint;
  return { systemHit: hit, sessionHit: hit, pathChanged: !hit };
}
