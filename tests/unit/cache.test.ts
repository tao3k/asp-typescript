import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashFile,
  hashDirectory,
  changedFiles,
  saveHashes,
  loadHashes,
} from "../../src/cache/file-hash.js";
import { loadModuleCache, saveModuleCache } from "../../src/cache/module-cache.js";
import { parseOrReuse } from "../../src/cache/invalidation.js";
import { parseModule } from "../../src/syntax/parse-module.js";

// ── Helpers ────────────────────────────────────────────────

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-cache-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const full = path.join(dir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return full;
}

// ── Tests ──────────────────────────────────────────────────

describe("file-hash", () => {
  it("hashFile produces deterministic SHA256", () => {
    const dir = tmpDir();
    const f = writeFile(dir, "a.ts", "export const x = 1;\n");
    const h1 = hashFile(f);
    const h2 = hashFile(f);
    assert.equal(h1, h2, "same file = same hash");
    assert.equal(h1.length, 64, "SHA256 hex = 64 chars");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("hashFile changes when content changes", () => {
    const dir = tmpDir();
    const f = writeFile(dir, "b.ts", "export const x = 1;\n");
    const h1 = hashFile(f);
    writeFile(dir, "b.ts", "export const x = 2;\n");
    const h2 = hashFile(f);
    assert.notEqual(h1, h2, "content change = hash change");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("hashDirectory finds all .ts/.tsx files", () => {
    const dir = tmpDir();
    writeFile(dir, "a.ts", "// a");
    writeFile(dir, "b.tsx", "// b");
    writeFile(dir, "c.txt", "// c");
    const map = hashDirectory(dir);
    assert.ok(map.size >= 2, `found ${map.size} files`);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("changedFiles detects add/change/remove", () => {
    const old = new Map<string, string>([
      ["/a.ts", "hash-a"],
      ["/b.ts", "hash-b"],
      ["/c.ts", "hash-c"],
    ]);
    const neu = new Map<string, string>([
      ["/a.ts", "hash-a"], // unchanged
      ["/b.ts", "hash-b2"], // changed
      ["/d.ts", "hash-d"], // added
    ]);
    const changed = changedFiles(old, neu);
    assert.ok(changed.has("/b.ts"), "b changed");
    assert.ok(changed.has("/c.ts"), "c removed");
    assert.ok(changed.has("/d.ts"), "d added");
    assert.equal(changed.has("/a.ts"), false, "a unchanged");
  });

  it("saveHashes + loadHashes round-trip", () => {
    const dir = tmpDir();
    const cacheFile = path.join(dir, "hashes.json");
    const map = new Map([
      ["/x.ts", "abc123"],
      ["/y.tsx", "def456"],
    ]);
    saveHashes(map, cacheFile);
    const loaded = loadHashes(cacheFile);
    assert.equal(loaded.size, 2);
    assert.equal(loaded.get("/x.ts"), "abc123");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("module-cache", () => {
  it("saves and loads valid modules", () => {
    const dir = tmpDir();
    const cacheFile = path.join(dir, "modules.json");

    const m1 = parseModule(writeFile(dir, "m1.ts", "export const a = 1;\n"));
    const m2 = parseModule(writeFile(dir, "m2.ts", "export const b = 2;\n"));

    saveModuleCache([m1, m2], cacheFile);

    const validHashes = new Set([m1.path, m2.path]);
    const loaded = loadModuleCache(cacheFile, validHashes);

    assert.equal(loaded.size, 2, "both modules loaded");
    assert.ok(loaded.get(m1.path)!.isValid);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("skips modules whose hash changed", () => {
    const dir = tmpDir();
    const cacheFile = path.join(dir, "modules.json");

    const f = writeFile(dir, "m1.ts", "export const a = 1;\n");
    const m = parseModule(f);
    saveModuleCache([m], cacheFile);

    // Load with empty validHashes → nothing reused
    const loaded = loadModuleCache(cacheFile, new Set());
    assert.equal(loaded.size, 0, "no valid hashes = skip all");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("cache invalidation", () => {
  it("first run parses all files (cache miss)", () => {
    const dir = tmpDir();
    const cacheDir = path.join(dir, ".cache", "asp-typescript");
    const f1 = writeFile(dir, "src/a.ts", "export const a = 1;\n");
    const f2 = writeFile(dir, "src/b.ts", "export const b = 2;\n");

    const result = parseOrReuse([f1, f2], dir, { cacheDir });

    assert.equal(result.parsedCount, 2, "first run parses both");
    assert.equal(result.reusedCount, 0, "first run reuses none");
    assert.equal(result.modules.length, 2);
    assert.equal(result.cacheHit, false);
    assert.ok(fs.existsSync(path.join(cacheDir, "file-hashes.json")));
    assert.ok(fs.existsSync(path.join(cacheDir, "parsed-modules.json")));

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("second run reuses all (cache hit)", () => {
    const dir = tmpDir();
    const cacheDir = path.join(dir, ".cache", "asp-typescript");
    const f1 = writeFile(dir, "src/a.ts", "export const a = 1;\n");
    const f2 = writeFile(dir, "src/b.ts", "export const b = 2;\n");

    // First run
    parseOrReuse([f1, f2], dir, { cacheDir });

    // Second run — same files
    const result = parseOrReuse([f1, f2], dir, { cacheDir });

    assert.equal(result.parsedCount, 0, "second run parses none");
    assert.equal(result.reusedCount, 2, "second run reuses both");
    assert.equal(result.cacheHit, true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("changed file triggers re-parse only for that file", () => {
    const dir = tmpDir();
    const cacheDir = path.join(dir, ".cache", "asp-typescript");
    const f1 = writeFile(dir, "src/a.ts", "export const a = 1;\n");
    const f2 = writeFile(dir, "src/b.ts", "export const b = 2;\n");

    // First run
    parseOrReuse([f1, f2], dir, { cacheDir });

    // Change one file
    writeFile(dir, "src/b.ts", "export const b = 42;\n");

    // Second run
    const result = parseOrReuse([f1, f2], dir, { cacheDir });

    assert.equal(result.parsedCount, 1, "only b re-parsed");
    assert.equal(result.reusedCount, 1, "a reused");
    assert.equal(result.cacheHit, true);
    assert.equal(
      result.modules.find((m) => m.path === f2)!.exports[0]!.name,
      "b",
      "re-parsed module has correct export",
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("added file is parsed, existing reused", () => {
    const dir = tmpDir();
    const cacheDir = path.join(dir, ".cache", "asp-typescript");
    const f1 = writeFile(dir, "src/a.ts", "export const a = 1;\n");

    parseOrReuse([f1], dir, { cacheDir });

    // Add new file
    const f2 = writeFile(dir, "src/c.ts", "export const c = 3;\n");

    const result = parseOrReuse([f1, f2], dir, { cacheDir });
    assert.equal(result.parsedCount, 1, "new file parsed");
    assert.equal(result.reusedCount, 1, "old file reused");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("file with syntax error is not cached", () => {
    const dir = tmpDir();
    const cacheDir = path.join(dir, ".cache", "asp-typescript");
    const bad = writeFile(dir, "src/broken.ts", "export function broken( { }\n");

    const result = parseOrReuse([bad], dir, { cacheDir });

    assert.equal(result.parsedCount, 1);
    // Invalid modules are not saved to cache, so second run re-parses
    const result2 = parseOrReuse([bad], dir, { cacheDir });
    assert.equal(result2.parsedCount, 1, "broken file always re-parsed");

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
