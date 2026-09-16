/**
 * Rendering helpers for cache context blocks.
 *
 * This module serializes cache atoms into compact prompt sections while
 * preserving the cache class boundaries used by the adapter.
 */
import type { AspTypeScriptPrefixAtom, PartitionedAtoms } from "./prefix_atoms.js";

// ── Render output ──────────────────────────────────────────

export interface RenderedCacheBlocks {
  /** System prompt block — never changes between sessions. */
  readonly systemBlock: string;
  /** Session-stable block — changes only on project structure change. */
  readonly sessionBlock: string;
  /** Path-append block — append-only across repair rounds. */
  readonly pathBlock: string;
  /** Branch-tail block — changes every round. */
  readonly branchBlock: string;
  /** SCRATCH: summary stats (not sent to LLM). */
  readonly scratchSummary: string;
}

const SEPARATOR = "\n---\n";

/** Render partitioned atoms into LLM-ready prompt blocks. */
export function renderCacheBlocks(partition: PartitionedAtoms): RenderedCacheBlocks {
  return {
    systemBlock: renderAtomGroup(partition.immutablePrefix),
    sessionBlock: renderAtomGroup(partition.sessionStable),
    pathBlock: renderAtomGroup(partition.pathAppend),
    branchBlock: renderAtomGroup(partition.branchTail),
    scratchSummary: scratchSummary(partition),
  };
}

/** Render a full prompt by concatenating blocks in the correct order. */
export function renderFullPrompt(blocks: RenderedCacheBlocks): string {
  const parts: string[] = [];

  if (blocks.systemBlock.length > 0) parts.push(blocks.systemBlock);
  if (blocks.sessionBlock.length > 0) parts.push(blocks.sessionBlock);
  if (blocks.pathBlock.length > 0) parts.push(blocks.pathBlock);
  if (blocks.branchBlock.length > 0) parts.push(blocks.branchBlock);

  return parts.join(SEPARATOR);
}

/** Render a single cache-class group as compact text. */
function renderAtomGroup(atoms: readonly AspTypeScriptPrefixAtom[]): string {
  if (atoms.length === 0) return "";

  const lines: string[] = [];
  for (const atom of atoms) {
    const header = `[${atom.kind}] ${atom.atomId} (${atom.tokenEstimate} tokens)`;
    lines.push(header);
    lines.push(atom.stableText);
  }
  return lines.join("\n");
}

/** Produce a scratch-only summary for debugging. */
function scratchSummary(partition: PartitionedAtoms): string {
  const scratchAtoms = partition.scratchOnly;
  if (scratchAtoms.length === 0) return "[scratch] empty";

  const kinds = scratchAtoms.map((a) => a.kind);
  const totalTokens = scratchAtoms.reduce((sum, a) => sum + a.tokenEstimate, 0);
  const totalFiles = new Set(scratchAtoms.flatMap((a) => a.sourceRefs)).size;

  return `[scratch] ${scratchAtoms.length} atoms, ${totalTokens} tokens, ${totalFiles} files: ${kinds.join(", ")}`;
}

/** Estimate total prompt tokens from blocks. */
export function promptTokenEstimate(blocks: RenderedCacheBlocks): number {
  return (
    (blocks.systemBlock.length +
      blocks.sessionBlock.length +
      blocks.pathBlock.length +
      blocks.branchBlock.length) /
    3
  ); // ~3 chars per token
}
