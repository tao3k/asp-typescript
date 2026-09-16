/**
 * Prefix cache atom model for agent prompt reuse.
 *
 * This module defines cache classes, atom metadata, and partition helpers used
 * to keep immutable facts separate from run-local repair context.
 */
import { atomFingerprint, groupFingerprint } from "./fingerprint.js";

// ── Cache classification ──────────────────────────────────

/** Stability class for DeepSeek cache-friendly prompt partitioning. */
export type AspTypeScriptCacheClass =
  | "immutable_prefix" // Protocol rules, format contracts — system prompt
  | "session_stable" // Project structure — changes only on git change
  | "path_append" // Current repair path — append-only
  | "branch_tail" // Exploration candidates — changes every round
  | "scratch_only"; // Raw data — never sent to LLM

/** What kind of reasoning surface this atom covers. */
export type PrefixAtomKind =
  | "project_config"
  | "extension"
  | "build_tool"
  | "owner_branch"
  | "owner_dependency"
  | "finding_group"
  | "verification_task"
  | "tool_receipt"
  | "immutable_contract";

// ── The atom ───────────────────────────────────────────────

export interface AspTypeScriptPrefixAtom {
  readonly atomId: string;
  readonly cacheClass: AspTypeScriptCacheClass;
  readonly kind: PrefixAtomKind;

  /** Stable text payload — what goes into the prompt. */
  readonly stableText: string;
  /** SHA256 of stableText (first 16 hex chars). */
  readonly contentHash: string;
  /** Approximate token count (simple heuristic). */
  readonly tokenEstimate: number;
  /** Source files this atom references. */
  readonly sourceRefs: readonly string[];
}

// ── Builders ───────────────────────────────────────────────

let nextId = 0;

function newAtom(
  cacheClass: AspTypeScriptCacheClass,
  kind: PrefixAtomKind,
  stableText: string,
  sourceRefs: readonly string[] = [],
): AspTypeScriptPrefixAtom {
  const contentHash = atomFingerprint(stableText);
  return {
    atomId: `atom-${String(++nextId).padStart(4, "0")}`,
    cacheClass,
    kind,
    stableText,
    contentHash,
    tokenEstimate: Math.ceil(stableText.length / 3), // ~3 chars per token
    sourceRefs,
  };
}

// ── Immutable contracts (system prompt) ────────────────────

export function immutableContractAtom(contractText: string): AspTypeScriptPrefixAtom {
  return newAtom("immutable_prefix", "immutable_contract", contractText);
}

export const COMPACT_TEXT_CONTRACT = `Compact text must clone ASP Rust format:
[RULE-ID] Severity: Title
@ path:line:column
fix: short repair command
line: N | source line
Help: concrete parser fact
Contract: stable rule requirement

Clean output: [ok] ts`;

export const TOOL_USAGE_CONTRACT = `When repairing: 1) Read the target file first. 2) Apply SEARCH/REPLACE. 3) Run relevant tests. 4) Rerun ASP TypeScript to verify repair.`;

export const AUTHORITY_ORDER_CONTRACT = `Authority order: parser facts > receipts > complete waivers > config hints > LLM prose`;

// ── Session-stable: project structure ─────────────────────

export interface ProjectStructureInput {
  readonly modulesSummary: string;
  readonly extensions: string;
  readonly buildTools: string;
  readonly ownerBranches: string;
  readonly ownerDependencies: string;
  readonly sourceRefs: readonly string[];
}

export function projectStructureAtoms(input: ProjectStructureInput): AspTypeScriptPrefixAtom[] {
  return [
    newAtom("session_stable", "project_config", input.modulesSummary, input.sourceRefs),
    newAtom("session_stable", "extension", input.extensions, input.sourceRefs),
    newAtom("session_stable", "build_tool", input.buildTools, input.sourceRefs),
    newAtom("session_stable", "owner_branch", input.ownerBranches, input.sourceRefs),
    newAtom("session_stable", "owner_dependency", input.ownerDependencies, input.sourceRefs),
  ];
}

// ── Path-append: repair state ──────────────────────────────

export interface RepairStateInput {
  readonly selectedFindings: string;
  readonly verificationTasks: string;
  readonly toolReceipts: string;
  readonly sourceRefs: readonly string[];
}

export function repairStateAtoms(input: RepairStateInput): AspTypeScriptPrefixAtom[] {
  return [
    newAtom("path_append", "finding_group", input.selectedFindings, input.sourceRefs),
    newAtom("path_append", "verification_task", input.verificationTasks, input.sourceRefs),
    newAtom("path_append", "tool_receipt", input.toolReceipts, input.sourceRefs),
  ];
}

// ── Branch-tail: exploration ───────────────────────────────

export function branchTailAtom(
  label: string,
  content: string,
  sourceRefs: readonly string[] = [],
): AspTypeScriptPrefixAtom {
  return newAtom("branch_tail", "finding_group", `[${label}]\n${content}`, sourceRefs);
}

// ── Scratch-only: raw data ─────────────────────────────────

export function scratchAtom(
  kind: PrefixAtomKind,
  content: string,
  sourceRefs: readonly string[] = [],
): AspTypeScriptPrefixAtom {
  return newAtom("scratch_only", kind, content, sourceRefs);
}

// ── Grouping ───────────────────────────────────────────────

export interface PartitionedAtoms {
  readonly immutablePrefix: readonly AspTypeScriptPrefixAtom[];
  readonly sessionStable: readonly AspTypeScriptPrefixAtom[];
  readonly pathAppend: readonly AspTypeScriptPrefixAtom[];
  readonly branchTail: readonly AspTypeScriptPrefixAtom[];
  readonly scratchOnly: readonly AspTypeScriptPrefixAtom[];
}

export function partitionAtoms(atoms: readonly AspTypeScriptPrefixAtom[]): PartitionedAtoms {
  return {
    immutablePrefix: atoms.filter((a) => a.cacheClass === "immutable_prefix"),
    sessionStable: atoms.filter((a) => a.cacheClass === "session_stable"),
    pathAppend: atoms.filter((a) => a.cacheClass === "path_append"),
    branchTail: atoms.filter((a) => a.cacheClass === "branch_tail"),
    scratchOnly: atoms.filter((a) => a.cacheClass === "scratch_only"),
  };
}

/** Compute a combined fingerprint for a group of atoms. */
export function partitionFingerprint(partition: PartitionedAtoms): string {
  const allHashes = [
    ...partition.immutablePrefix,
    ...partition.sessionStable,
    ...partition.pathAppend,
    ...partition.branchTail,
  ].map((a) => a.contentHash);
  return groupFingerprint(allHashes);
}

/** Total token estimate across all non-scratch atoms. */
export function partitionTokenEstimate(partition: PartitionedAtoms): number {
  return [
    ...partition.immutablePrefix,
    ...partition.sessionStable,
    ...partition.pathAppend,
    ...partition.branchTail,
  ].reduce((sum, a) => sum + a.tokenEstimate, 0);
}
