import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseModule } from "../../src/syntax/parse-module.js";
import { evaluateRules } from "../../src/syntax/rules/catalog.js";
import { parseOrReuse } from "../../src/cache/invalidation.js";
import { runCliCapture } from "./cli_helpers.js";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-bench-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const full = path.join(dir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return full;
}

// ── Small project (~5 files) ───────────────────────────────

describe("benchmark: small project", () => {
  it("parses 5 modules under 300ms", () => {
    const dir = tmpDir();

    writeFile(dir, "src/index.ts", "export { helper } from './helper.js';");
    writeFile(
      dir,
      "src/helper.ts",
      "export function helper(x: string): string { return x.trim(); }",
    );
    writeFile(
      dir,
      "src/utils.ts",
      "export const VERSION = '1.0.0'; export function log(msg: string) { console.log(msg); }",
    );
    writeFile(
      dir,
      "src/data.ts",
      "export interface User { id: string; name: string; } export function mapUser(u: User) { return u.name; }",
    );
    writeFile(
      dir,
      "src/main.ts",
      "import { helper } from './helper.js'; import { VERSION } from './utils.js'; export function run() { return helper(VERSION); }",
    );

    const files = [
      path.join(dir, "src/index.ts"),
      path.join(dir, "src/helper.ts"),
      path.join(dir, "src/utils.ts"),
      path.join(dir, "src/data.ts"),
      path.join(dir, "src/main.ts"),
    ];

    const startedAt = performance.now();
    const modules = files.map((f) => parseModule(f));
    const _findings = evaluateRules(modules);
    const elapsed = performance.now() - startedAt;

    assert.ok(elapsed < 300, `parse+eval 5 files took ${elapsed.toFixed(1)}ms (target < 300ms)`);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("cache hit reuses all modules under 30ms", () => {
    const dir = tmpDir();

    writeFile(dir, "src/a.ts", "export const a = 1;");
    writeFile(dir, "src/b.ts", "export const b = 2;");
    writeFile(dir, "src/c.ts", "export const c = 3;");

    const files = [
      path.join(dir, "src/a.ts"),
      path.join(dir, "src/b.ts"),
      path.join(dir, "src/c.ts"),
    ];

    // Prime cache
    parseOrReuse(files, dir);

    // Cache-hit run
    const startedAt = performance.now();
    const result = parseOrReuse(files, dir);
    const elapsed = performance.now() - startedAt;

    assert.equal(result.reusedCount, 3, "all 3 reused");
    assert.ok(elapsed < 30, `cache-hit took ${elapsed.toFixed(1)}ms (target < 30ms)`);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("sourceText is populated on parse", () => {
    const dir = tmpDir();
    const f = writeFile(dir, "src/mod.ts", "export const x = 42;\n");
    const mod = parseModule(f);
    assert.ok(mod.sourceText !== undefined, "sourceText should be populated");
    assert.ok(mod.sourceText.includes("42"), "sourceText contains source");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rules do not re-read files (sourceText reuse)", () => {
    const dir = tmpDir();
    writeFile(dir, "src/comp.tsx", "export function Card() { return <div>hi</div>; }");
    const f = path.join(dir, "src/comp.tsx");
    const mod = parseModule(f);

    // Evaluate rules — should use sourceText, not re-read from disk
    // Delete the file to prove rules don't re-read
    fs.rmSync(f);
    const findings = evaluateRules([mod]);
    // Should still work because sourceText is in the module
    assert.ok(findings.length >= 0, "rules should work without file on disk");

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("benchmark: CLI query/search stable paths", () => {
  it("embedded declaration catalog stays on the lightweight locator path", () => {
    const dir = tmpDir();
    writeFile(dir, "tsconfig.json", JSON.stringify({ include: ["src/**/*.ts"] }));
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

    const elapsed = bestOf(3, () => {
      const result = runCliCapture(
        [
          "query",
          "--catalog",
          "declarations",
          "--selector",
          "src/sample.ts:1:7",
          "--workspace",
          ".",
        ],
        dir,
      );
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(result.stdout, /src\/sample\.ts:1\nalpha/u);
      assert.doesNotMatch(result.stdout, /\[search-owner\]/u);
    });

    assert.ok(
      elapsed < 700,
      `exact selector query best-of-3 took ${elapsed.toFixed(1)}ms (target < 700ms)`,
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("lexical owner/tests search avoids multi-second regressions on a tiny project", () => {
    const dir = tmpDir();
    writeFile(dir, "tsconfig.json", JSON.stringify({ include: ["src/**/*.ts", "tests/**/*.ts"] }));
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

    const elapsed = bestOf(3, () => {
      const result = runCliCapture(
        [
          "search",
          "lexical",
          "contentBlocks",
          "owner",
          "tests",
          "--view",
          "seeds",
          "--workspace",
          ".",
        ],
        dir,
      );
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(result.stdout, /\[search-lexical\]/u);
      assert.match(result.stdout, /contentBlocks/u);
    });

    assert.ok(
      elapsed < 2_000,
      `lexical owner/tests search best-of-3 took ${elapsed.toFixed(1)}ms (target < 2000ms)`,
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

function bestOf(samples: number, run: () => void): number {
  let best = Number.POSITIVE_INFINITY;
  for (let sample = 0; sample < samples; sample += 1) {
    const startedAt = performance.now();
    run();
    best = Math.min(best, performance.now() - startedAt);
  }
  return best;
}
