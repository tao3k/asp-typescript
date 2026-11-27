/**
 * Prompt cache context assembly for ASP TypeScript runs.
 *
 * This module groups parser and repair facts into reusable prompt cache
 * classes without changing the underlying parser-owned facts.
 */
import {
  type AspTypeScriptPrefixAtom,
  type PartitionedAtoms,
  partitionAtoms,
  partitionFingerprint,
  partitionTokenEstimate,
  immutableContractAtom,
  projectStructureAtoms,
  repairStateAtoms,
  branchTailAtom,
  COMPACT_TEXT_CONTRACT,
  TOOL_USAGE_CONTRACT,
  AUTHORITY_ORDER_CONTRACT,
} from "./prefix_atoms.js";

// ── Context builder input ──────────────────────────────────

export interface CacheContextInput {
  /** Rendered reasoning tree text (modules, extensions, builds, branches, deps). */
  readonly reasoningTreeText: string;
  /** Compact findings text. */
  readonly findingsText: string;
  /** Active target file the agent is repairing. */
  readonly activeTarget?: string;
  /** Candidate strategies for this round. */
  readonly candidateStrategies?: string;
  /** Verification plan text. */
  readonly verificationPlanText?: string;
  /** Tool receipt text. */
  readonly toolReceiptText?: string;
  /** Source files referenced. */
  readonly sourceRefs: readonly string[];
}

// ── Assembled context ──────────────────────────────────────

export interface AssembledCacheContext {
  readonly partition: PartitionedAtoms;
  readonly fingerprint: string;
  readonly tokenEstimate: number;
  readonly allAtoms: readonly AspTypeScriptPrefixAtom[];
}

/**
 * Build the full cache context from reasoning tree + findings.
 *
 * Partitioning:
 * - immutable_prefix: contracts (compact text, tool usage, authority order)
 * - session_stable: reasoning tree (modules, extensions, builds, branches, deps)
 * - path_append: findings + verification plan + tool receipts
 * - branch_tail: active target + candidate strategies
 * - scratch_only: raw debug data (omitted in default)
 */
export function buildCacheContext(input: CacheContextInput): AssembledCacheContext {
  const atoms: AspTypeScriptPrefixAtom[] = [];

  // ── immutable_prefix ──
  atoms.push(immutableContractAtom(COMPACT_TEXT_CONTRACT));
  atoms.push(immutableContractAtom(TOOL_USAGE_CONTRACT));
  atoms.push(immutableContractAtom(AUTHORITY_ORDER_CONTRACT));

  // ── session_stable ──
  atoms.push(
    ...projectStructureAtoms({
      modulesSummary: input.reasoningTreeText,
      extensions: "",
      buildTools: "",
      ownerBranches: "",
      ownerDependencies: "",
      sourceRefs: input.sourceRefs,
    }),
  );

  // ── path_append ──
  atoms.push(
    ...repairStateAtoms({
      selectedFindings: input.findingsText,
      verificationTasks: input.verificationPlanText ?? "",
      toolReceipts: input.toolReceiptText ?? "",
      sourceRefs: input.sourceRefs,
    }),
  );

  // ── branch_tail ──
  if (input.activeTarget !== undefined) {
    atoms.push(branchTailAtom("active-target", input.activeTarget, [input.activeTarget]));
  }
  if (input.candidateStrategies !== undefined) {
    atoms.push(branchTailAtom("candidates", input.candidateStrategies, input.sourceRefs));
  }

  // ── scratch_only ──
  // Raw data is not assembled here — it stays in the report.

  const partition = partitionAtoms(atoms);
  return {
    partition,
    fingerprint: partitionFingerprint(partition),
    tokenEstimate: partitionTokenEstimate(partition),
    allAtoms: atoms,
  };
}
