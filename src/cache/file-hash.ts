/**
 * File and directory hashing utilities for parser cache invalidation.
 *
 * This module owns stable file fingerprints used to decide which TypeScript
 * modules can be reused between ASP TypeScript runs.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Compute SHA256 hash of a single file's content. */
export function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** Build a map of file → hash for a directory of TypeScript files. */
export function hashDirectory(dirPath: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!fs.existsSync(dirPath)) return result;

  const entries = fs.readdirSync(dirPath, { recursive: true });
  for (const entry of entries) {
    const full = path.resolve(dirPath, entry as string);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    if (!entry.toString().endsWith(".ts") && !entry.toString().endsWith(".tsx")) continue;
    result.set(full, hashFile(full));
  }

  return result;
}

/** Compare old hash map vs new hash. Returns set of paths whose content changed. */
export function changedFiles(
  oldHashes: Map<string, string>,
  newHashes: Map<string, string>,
): Set<string> {
  const changed = new Set<string>();

  // Check all current files
  for (const [file, newHash] of newHashes) {
    const oldHash = oldHashes.get(file);
    if (oldHash === undefined || oldHash !== newHash) {
      changed.add(file);
    }
  }

  // Check removed files (in old but not in new)
  for (const file of oldHashes.keys()) {
    if (!newHashes.has(file)) {
      changed.add(file);
    }
  }

  return changed;
}

/** Save hash map to JSON file. */
export function saveHashes(hashMap: Map<string, string>, cachePath: string): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const obj: Record<string, string> = {};
  for (const [k, v] of hashMap) {
    obj[k] = v;
  }
  fs.writeFileSync(cachePath, JSON.stringify(obj, null, 2), "utf8");
}

/** Load hash map from JSON file. */
export function loadHashes(cachePath: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!fs.existsSync(cachePath)) return result;

  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) {
      result.set(k, v);
    }
  } catch {
    // Corrupted cache — treat as empty
  }

  return result;
}
