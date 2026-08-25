import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSemanticSearchPacket,
  renderSemanticSearchPacket,
} from "../../src/cli/semantic-search.js";
import { renderExactSourceWindowCode } from "../../src/queries/exact-source-window.js";
import { runTypeScriptProjectHarness } from "../../src/runner/run-project.js";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-perf-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const full = path.join(dir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return full;
}

test("microbench: query/search provider internals", async (t) => {
  const budgets = loadMicrobenchBudgets();

  await t.test("query exact source window follows git-owned p95 budget", () => {
    const budget = requiredMicrobenchBudget(budgets, "typescript.query.exact-source-window");
    const dir = tmpDir();
    try {
      writeFile(
        dir,
        "src/sample.ts",
        [
          "export function alpha(): string {",
          "  const contentBlocks = [];",
          "  contentBlocks.push('ok');",
          "  return contentBlocks.join(',');",
          "}",
          "export function beta(): number { return 1; }",
          "",
        ].join("\n"),
      );

      const stats = measureMicrobench(budget, () => {
        const output = renderExactSourceWindowCode(dir, "src/sample.ts", "src/sample.ts:2-5");
        assert.match(output ?? "", /contentBlocks\.push/u);
      });

      assertMicrobenchWithinBudget("typescript.query.exact-source-window", stats, budget);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("search lexical packet build/render follows git-owned p95 budget", () => {
    const budget = requiredMicrobenchBudget(budgets, "typescript.search.lexical-packet-render");
    const dir = tmpDir();
    try {
      writeFile(
        dir,
        "tsconfig.json",
        JSON.stringify({ include: ["src/**/*.ts", "tests/**/*.ts"] }),
      );
      writeFile(
        dir,
        "src/sample.ts",
        ["export function contentBlocks(): readonly string[] {", "  return ['ok'];", "}", ""].join(
          "\n",
        ),
      );
      writeFile(
        dir,
        "tests/sample.test.ts",
        "import { contentBlocks } from '../src/sample.js';\ncontentBlocks();\n",
      );
      const report = runTypeScriptProjectHarness(dir, undefined, {
        collectSemanticDiagnostics: false,
        collectNativeSyntaxFacts: false,
        evaluateRules: false,
      });

      const stats = measureMicrobench(budget, () => {
        const packet = buildSemanticSearchPacket(report, {
          view: "lexical",
          query: "contentBlocks",
          pipes: ["owner", "tests"],
          renderMode: "seeds",
        });
        const output = renderSemanticSearchPacket(packet);
        assert.match(output, /\[search-lexical\]/u);
        assert.match(output, /contentBlocks/u);
      });

      assertMicrobenchWithinBudget("typescript.search.lexical-packet-render", stats, budget);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

interface MicrobenchBudgetFile {
  readonly cases: Record<string, MicrobenchBudget>;
}

interface MicrobenchBudget {
  readonly warmupIterations: number;
  readonly measureIterations: number;
  readonly p95MaxMs: number;
}

interface MicrobenchStats {
  readonly minMs: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly stddevMs: number;
}

function loadMicrobenchBudgets(): MicrobenchBudgetFile {
  const budgetPath = [
    new URL("./query-search.microbench.json", import.meta.url),
    new URL("../../../tests/perf/query-search.microbench.json", import.meta.url),
  ]
    .map((candidate) => fileURLToPath(candidate))
    .find((candidate) => fs.existsSync(candidate));
  if (budgetPath === undefined) {
    throw new Error("missing git-tracked TypeScript microbench budget fixture");
  }
  return JSON.parse(fs.readFileSync(budgetPath, "utf8")) as MicrobenchBudgetFile;
}

function requiredMicrobenchBudget(budgets: MicrobenchBudgetFile, caseId: string): MicrobenchBudget {
  const budget = budgets.cases[caseId];
  if (budget === undefined) {
    throw new Error(`missing microbench budget case ${caseId}`);
  }
  return budget;
}

function measureMicrobench(budget: MicrobenchBudget, run: () => void): MicrobenchStats {
  for (let index = 0; index < budget.warmupIterations; index += 1) run();
  const samples: number[] = [];
  for (let index = 0; index < budget.measureIterations; index += 1) {
    const startedAt = performance.now();
    run();
    samples.push(performance.now() - startedAt);
  }
  samples.sort((left, right) => left - right);
  const meanMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance =
    samples.reduce((sum, sample) => sum + (sample - meanMs) ** 2, 0) / samples.length;
  return {
    minMs: samples[0]!,
    meanMs,
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: samples[samples.length - 1]!,
    stddevMs: Math.sqrt(variance),
  };
}

function assertMicrobenchWithinBudget(
  caseId: string,
  stats: MicrobenchStats,
  budget: MicrobenchBudget,
): void {
  assert.ok(
    stats.p95Ms <= budget.p95MaxMs,
    `${caseId} p95 ${stats.p95Ms.toFixed(3)}ms exceeded budget ${budget.p95MaxMs}ms; ` +
      `min=${stats.minMs.toFixed(3)} mean=${stats.meanMs.toFixed(3)} ` +
      `median=${stats.medianMs.toFixed(3)} max=${stats.maxMs.toFixed(3)} ` +
      `stddev=${stats.stddevMs.toFixed(3)}`,
  );
}

function percentile(sortedSamples: readonly number[], quantile: number): number {
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil(sortedSamples.length * quantile) - 1),
  );
  return sortedSamples[index]!;
}
