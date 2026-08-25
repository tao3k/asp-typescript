/**
 * Cache invalidation helpers for parsed TypeScript modules.
 *
 * This module compares stored file fingerprints with current filesystem state
 * and records which parser facts must be refreshed.
 */
import path from "node:path";
import type { TsParsedModule } from "../syntax/model.js";
import { changedFiles, hashFile, loadHashes, saveHashes } from "./file-hash.js";
import { loadModuleCache, saveModuleCache } from "./module-cache.js";
import { parseModule } from "../syntax/parse-module.js";

export interface CachePaths {
  /** Directory for all cache files: default .cache/asp-typescript/ */
  readonly cacheDir: string;
}

const DEFAULT_CACHE_DIR = ".cache/asp-typescript";

export function defaultCachePaths(root: string): CachePaths {
  return { cacheDir: path.resolve(root, DEFAULT_CACHE_DIR) };
}

export interface CacheResult {
  readonly modules: readonly TsParsedModule[];
  readonly cacheHit: boolean;
  readonly parsedCount: number;
  readonly reusedCount: number;
}

/**
 * Parse or reuse modules from cache based on file hashing.
 *
 * Strategy:
 * 1. Hash all source files in the directory
 * 2. Compare against cached hashes
 * 3. For unchanged files: reuse cached module
 * 4. For changed/new files: re-parse
 * 5. Save updated cache
 */
export function parseOrReuse(
  filePaths: string[],
  sourceRoot: string,
  cachePaths?: CachePaths,
): CacheResult {
  const cacheDir = cachePaths?.cacheDir ?? path.resolve(sourceRoot, DEFAULT_CACHE_DIR);
  const hashPath = path.join(cacheDir, "file-hashes.json");
  const modulesPath = path.join(cacheDir, "parsed-modules.json");

  // 1. Hash current state
  const currentHashes = new Map<string, string>();
  for (const fp of filePaths) {
    currentHashes.set(fp, hashFile(fp));
  }

  // 2. Load old hashes
  const oldHashes = loadHashes(hashPath);

  // 3. Find changed files
  const changed = changedFiles(oldHashes, currentHashes);

  // 4. Load cached modules for unchanged files
  const unchangedHashes = new Set<string>();
  for (const [fp] of currentHashes) {
    if (!changed.has(fp)) unchangedHashes.add(fp);
  }

  const cached = loadModuleCache(modulesPath, unchangedHashes);
  const reusedCount = cached.size;

  // 5. Parse changed/new files
  let parsedCount = 0;
  for (const fp of filePaths) {
    if (cached.has(fp)) continue;
    const mod = parseModule(fp);
    cached.set(mod.path, mod);
    parsedCount++;
  }

  // 6. Save cache
  const modules = [...cached.values()];
  saveHashes(currentHashes, hashPath);
  saveModuleCache(modules, modulesPath);

  return {
    modules,
    cacheHit: parsedCount < filePaths.length,
    parsedCount,
    reusedCount,
  };
}
