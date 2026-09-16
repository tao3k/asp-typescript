/**
 * Shared rendering utilities for the CLI layer.
 *
 * Provides topology computation, doc quality estimation, namespace extraction,
 * role checking, and output formatting primitives used by all renderers.
 *
 * Single source of truth for signal thresholds (fan-in >= 3, doc quality thresholds)
 * and noise patterns (doc-site paths, generic export names).
 */

import fs from "node:fs";
import type { AspTypeScriptReport, TypeScriptReasoningTree } from "../model.js";
import { relativeProjectPath } from "../reasoning/path_utils.js";

// ── Path utilities ────────────────────────────────────────

/** Path relative to project root. */
export function relativeTo(tree: TypeScriptReasoningTree, filePath: string): string {
  return relativeProjectPath(tree.projectRoot, filePath);
}

// ── Topology computation ──────────────────────────────────

export interface TopologySignals {
  /** Map from file path to fan-in count (how many modules import this file). */
  readonly fanIn: ReadonlyMap<string, number>;
  /** Map from file path to fan-out count (how many modules this file imports). */
  readonly fanOut: ReadonlyMap<string, number>;
}

/** Compute fan-in and fan-out from owner dependency edges. */
export function computeTopology(report: AspTypeScriptReport): TopologySignals {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const d of report.reasoningTree.ownerDependencies) {
    if (d.isTestContext) continue;
    fanOut.set(d.fromPath, (fanOut.get(d.fromPath) ?? 0) + 1);
    if (d.toPath !== undefined) {
      fanIn.set(d.toPath, (fanIn.get(d.toPath) ?? 0) + 1);
    }
  }
  return { fanIn, fanOut };
}

// ── Doc quality ───────────────────────────────────────────

const DOC_NOISE_PATTERNS = [/@since\s.*/g, /@category\s.*/g, /@experimental/g, /@internal/g];

/** Meaningful word count in the first JSDoc block of a file. */
export function docQuality(filePath: string): number {
  try {
    const src = fs.readFileSync(filePath, "utf8");
    const match = src.match(/\/\*\*[\s\S]*?\*\//);
    if (!match) return 0;
    let doc = match[0];
    for (const pattern of DOC_NOISE_PATTERNS) {
      doc = doc.replace(pattern, "");
    }
    return doc
      .replace(/[\*\s\/]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2).length;
  } catch {
    return 0;
  }
}

/** Doc signal label: ★ for high quality, · for present, empty for none. */
export function docLabel(filePath: string): string {
  const q = docQuality(filePath);
  if (q > 20) return " ★doc";
  if (q > 5) return " ·doc";
  return "";
}

// ── Namespace extraction ──────────────────────────────────

const SKIP_TOP_DIRS = new Set(["src", "lib", "packages", "app", "dist"]);

/** Extract a meaningful namespace from a file path for grouping. */
export function extractNamespace(filePath: string): string {
  if (filePath.startsWith("@")) {
    return filePath.split("/").slice(0, 2).join("/");
  }
  if (!filePath.includes("/")) return filePath;
  const dirs = filePath.split("/").filter((d) => d !== ".");
  if (dirs.length === 0) return ".";
  if (dirs.length === 1) return dirs[0]!;
  let i = 0;
  if (SKIP_TOP_DIRS.has(dirs[0]!)) i = 1;
  if (i >= dirs.length) return dirs[dirs.length - 1]!;
  const remaining = dirs.slice(i);
  return remaining.length <= 2 ? remaining.join("/") : remaining.slice(0, 2).join("/");
}

// ── Doc-site detection ────────────────────────────────────

const DOC_SITE_PATTERNS = ["/apps/", "/www/", "/docs/", "/examples/", "/public/"];

/** Check if a file path belongs to a documentation site pattern. */
export function isDocSiteFile(filePath: string): boolean {
  return DOC_SITE_PATTERNS.some((p) => filePath.includes(p));
}

// ── Generic export name filter ────────────────────────────

const GENERIC_EXPORT_NAMES = new Set([
  "typeid",
  "make",
  "layer",
  "empty",
  "map",
  "head",
  "flatten",
  "match",
  "filter",
  "get",
  "fail",
  "succeed",
  "zip",
  "of",
  "do",
  "*",
  "default",
]);

/** Check if an export name is too generic to be a useful signal. */
export function isGenericExportName(name: string): boolean {
  return GENERIC_EXPORT_NAMES.has(name.toLowerCase());
}

// ── Role helpers ──────────────────────────────────────────

export const ROLE_FACADE = "facade" as const;
export const ROLE_ENTRYPOINT = "entrypoint" as const;
export const ROLE_SOURCE = "source" as const;
export const ROLE_CONFIG = "config" as const;
export const ROLE_ROOT = "root" as const;

export function hasRole(roles: readonly string[], target: string): boolean {
  return roles.includes(target);
}

export function isRootBranch(roles: readonly string[]): boolean {
  return hasRole(roles, ROLE_FACADE) || hasRole(roles, ROLE_ENTRYPOINT);
}

export function isSignificantFanIn(n: number): boolean {
  return n >= 3;
}

// ── Output formatting ─────────────────────────────────────

export function formatSection(label: string, count: number, unit: string): string {
  return `${label} (${count} ${unit}):`;
}

export function formatCount(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

export function truncateList(
  items: readonly string[],
  max: number,
): { shown: string[]; hidden: number } {
  if (items.length <= max) return { shown: [...items], hidden: 0 };
  return { shown: items.slice(0, max), hidden: items.length - max };
}

export function fanInLabel(n: number): string {
  return isSignificantFanIn(n) ? ` ←${n}` : "";
}
