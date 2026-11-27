import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  immutableContractAtom,
  projectStructureAtoms,
  repairStateAtoms,
  branchTailAtom,
  scratchAtom,
  partitionAtoms,
  partitionFingerprint,
  type AspTypeScriptPrefixAtom,
  COMPACT_TEXT_CONTRACT,
} from "../../src/cache/prefix_atoms.js";
import {
  atomFingerprint,
  groupFingerprint,
  fingerprintChanged,
} from "../../src/cache/fingerprint.js";
import { buildCacheContext } from "../../src/cache/cache_context.js";
import {
  renderCacheBlocks,
  renderFullPrompt,
  promptTokenEstimate,
} from "../../src/cache/render_cache_context.js";
import { buildPiAgentContext, cacheReuseStats } from "../../src/cache/pi_agent_adapter.js";

describe("fingerprint", () => {
  it("atomFingerprint is deterministic", () => {
    const a = atomFingerprint("hello");
    const b = atomFingerprint("hello");
    assert.equal(a, b);
    assert.equal(a.length, 16);
  });

  it("atomFingerprint changes with content", () => {
    const a = atomFingerprint("hello");
    const b = atomFingerprint("world");
    assert.notEqual(a, b);
  });

  it("groupFingerprint combines multiple hashes", () => {
    const g = groupFingerprint(["abc", "def"]);
    assert.equal(g.length, 16);
  });

  it("fingerprintChanged detects change", () => {
    assert.equal(fingerprintChanged(undefined, "abc"), true);
    assert.equal(fingerprintChanged("abc", "def"), true);
    assert.equal(fingerprintChanged("abc", "abc"), false);
  });
});

describe("PrefixAtom", () => {
  it("immutable contract atom has correct cache class", () => {
    const atom = immutableContractAtom(COMPACT_TEXT_CONTRACT);
    assert.equal(atom.cacheClass, "immutable_prefix");
    assert.equal(atom.kind, "immutable_contract");
    assert.ok(atom.tokenEstimate > 0);
    assert.ok(atom.contentHash.length === 16);
  });

  it("project structure atoms are session_stable", () => {
    const atoms = projectStructureAtoms({
      modulesSummary: "src/a.ts src/b.ts",
      extensions: "react",
      buildTools: "tsdown",
      ownerBranches: "app → lib",
      ownerDependencies: "app depends on lib",
      sourceRefs: ["src/a.ts"],
    });
    assert.equal(atoms.length, 5);
    for (const a of atoms) {
      assert.equal(a.cacheClass, "session_stable");
    }
  });

  it("repair state atoms are path_append", () => {
    const atoms = repairStateAtoms({
      selectedFindings: "[R001] Error @ src/a.ts:1",
      verificationTasks: "[verify] src/a.ts",
      toolReceipts: "typecheck: completed",
      sourceRefs: ["src/a.ts"],
    });
    assert.equal(atoms.length, 3);
    for (const a of atoms) {
      assert.equal(a.cacheClass, "path_append");
    }
  });

  it("branch tail atom has correct class", () => {
    const atom = branchTailAtom("candidates", "fix A\nfix B");
    assert.equal(atom.cacheClass, "branch_tail");
  });

  it("scratch atom is scratch_only", () => {
    const atom = scratchAtom("project_config", "raw json");
    assert.equal(atom.cacheClass, "scratch_only");
  });

  it("partitionAtoms separates by cache class", () => {
    const atoms: AspTypeScriptPrefixAtom[] = [
      immutableContractAtom("contract"),
      branchTailAtom("tail", "content"),
      scratchAtom("project_config", "raw"),
    ];
    const part = partitionAtoms(atoms);
    assert.equal(part.immutablePrefix.length, 1);
    assert.equal(part.branchTail.length, 1);
    assert.equal(part.scratchOnly.length, 1);
    assert.equal(part.sessionStable.length, 0);
  });

  it("partitionFingerprint changes when atom content changes", () => {
    const atoms1 = [immutableContractAtom("v1")];
    const atoms2 = [immutableContractAtom("v2")];
    assert.notEqual(
      partitionFingerprint(partitionAtoms(atoms1)),
      partitionFingerprint(partitionAtoms(atoms2)),
    );
  });
});

describe("cache_context", () => {
  it("buildCacheContext produces all 5 cache classes", () => {
    const ctx = buildCacheContext({
      reasoningTreeText: "Modules:\n  src/a.ts",
      findingsText: "[R001] Info: @ src/a.ts:1",
      activeTarget: "src/a.ts",
      candidateStrategies: "fix A",
      verificationPlanText: "[verify] src/a.ts",
      toolReceiptText: "typecheck: completed",
      sourceRefs: ["src/a.ts"],
    });

    const p = ctx.partition;
    assert.ok(p.immutablePrefix.length >= 1, "has immutable contracts");
    assert.ok(p.sessionStable.length >= 1, "has project structure");
    assert.ok(p.pathAppend.length >= 1, "has repair state");
    assert.ok(p.branchTail.length >= 1, "has branch tail");
    assert.ok(ctx.fingerprint.length > 0);
    assert.ok(ctx.tokenEstimate > 0);
  });

  it("buildCacheContext without optional fields still works", () => {
    const ctx = buildCacheContext({
      reasoningTreeText: "Modules: src/a.ts",
      findingsText: "[ok] ts",
      sourceRefs: [],
    });
    assert.ok(ctx.partition.immutablePrefix.length >= 1);
    assert.equal(ctx.partition.branchTail.length, 0);
  });
});

describe("render_cache_context", () => {
  it("renderCacheBlocks produces 5 blocks", () => {
    const ctx = buildCacheContext({
      reasoningTreeText: "Modules:\n  src/a.ts",
      findingsText: "[R001] Info @ src/a.ts:1",
      activeTarget: "src/a.ts",
      sourceRefs: ["src/a.ts"],
    });

    const blocks = renderCacheBlocks(ctx.partition);
    assert.ok(blocks.systemBlock.length > 0);
    assert.ok(blocks.sessionBlock.length > 0);
    assert.ok(blocks.pathBlock.length > 0);
    assert.ok(blocks.branchBlock.length > 0);
    assert.ok(blocks.scratchSummary.length > 0);
  });

  it("renderFullPrompt concatenates blocks", () => {
    const ctx = buildCacheContext({
      reasoningTreeText: "Modules: src/a.ts",
      findingsText: "[ok] ts",
      sourceRefs: [],
    });
    const blocks = renderCacheBlocks(ctx.partition);
    const prompt = renderFullPrompt(blocks);
    assert.ok(prompt.includes("[immutable_contract]"));
    assert.ok(prompt.includes("[project_config]"));
  });

  it("promptTokenEstimate is consistent", () => {
    const ctx = buildCacheContext({
      reasoningTreeText: "x".repeat(300),
      findingsText: "y".repeat(300),
      sourceRefs: [],
    });
    const blocks = renderCacheBlocks(ctx.partition);
    const tokens = promptTokenEstimate(blocks);
    assert.ok(tokens > 100, `got ${tokens}`);
    assert.ok(tokens < 500, `got ${tokens}`);
  });
});

describe("pi_agent_adapter", () => {
  it("buildPiAgentContext returns full agent context", () => {
    const ctx = buildPiAgentContext({
      reasoningTreeText: "Modules:\n  src/a.ts",
      findingsText: "[ok] ts",
      activeTarget: "src/a.ts",
      sourceRefs: ["src/a.ts"],
    });

    assert.ok(ctx.prompt.length > 0);
    assert.ok(ctx.systemPrefix.length > 0);
    assert.ok(ctx.sessionPrefix.length > ctx.systemPrefix.length);
    assert.ok(ctx.fingerprint.length > 0);
    assert.ok(ctx.tokenEstimate > 0);
    assert.ok(ctx.scratchSummary.length > 0);
  });

  it("cacheReuseStats detects cold start", () => {
    const stats = cacheReuseStats(undefined, "abc123");
    assert.equal(stats.systemHit, false);
    assert.equal(stats.sessionHit, false);
    assert.equal(stats.pathChanged, true);
  });

  it("cacheReuseStats detects hit", () => {
    const stats = cacheReuseStats("abc123", "abc123");
    assert.equal(stats.systemHit, true);
    assert.equal(stats.sessionHit, true);
    assert.equal(stats.pathChanged, false);
  });

  it("cacheReuseStats detects miss", () => {
    const stats = cacheReuseStats("abc123", "def456");
    assert.equal(stats.systemHit, false);
    assert.equal(stats.sessionHit, false);
    assert.equal(stats.pathChanged, true);
  });
});
