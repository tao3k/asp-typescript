/**
 * Project file discovery for ASP TypeScript runs.
 *
 * This module selects parser-visible TypeScript and JavaScript files while
 * respecting ignored directories and generated artifact boundaries.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_IGNORED_DIR_NAMES = [
  ".cache",
  ".devenv",
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
] as const;

const TYPE_SCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

export function isTypeScriptSourcePath(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return TYPE_SCRIPT_EXTENSIONS.some((extension) => lowerPath.endsWith(extension));
}

function isGeneratedParserCompactExpectedOutputPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return (
    (normalized.includes("/tests/fixtures/parser-compact/expected-output/") ||
      normalized.includes("/tests/fixtures/parser-compact/real-output/")) &&
    normalized.includes("/typescript/")
  );
}

export function discoverTypeScriptFiles(
  roots: readonly string[],
  ignoredDirNames: readonly string[] = DEFAULT_IGNORED_DIR_NAMES,
  includeHiddenDirNames: readonly string[] = [],
): string[] {
  const ignored = new Set(ignoredDirNames);
  const includedHidden = new Set(includeHiddenDirNames);
  const discovered: string[] = [];
  for (const root of roots) {
    collectTypeScriptFiles(path.resolve(root), ignored, includedHidden, discovered);
  }
  return [...new Set(discovered)].sort();
}

export function pathFromInput(input: string | URL): string {
  return input instanceof URL ? path.resolve(fileURLToPath(input)) : path.resolve(input);
}

export function packageProjectRoot(inputPath: string): string {
  const resolvedInput = path.resolve(inputPath);
  const startPath =
    fs.existsSync(resolvedInput) && fs.statSync(resolvedInput).isFile()
      ? path.dirname(resolvedInput)
      : resolvedInput;
  return nearestPackageRoot(startPath) ?? resolvedInput;
}

export function existingChildPaths(projectRoot: string, names: readonly string[]): string[] {
  return names
    .map((name) => path.join(projectRoot, name))
    .filter((candidate) => fs.existsSync(candidate))
    .sort();
}

function collectTypeScriptFiles(
  currentPath: string,
  ignoredDirNames: ReadonlySet<string>,
  includeHiddenDirNames: ReadonlySet<string>,
  discovered: string[],
): void {
  if (!fs.existsSync(currentPath)) {
    return;
  }
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    if (
      isTypeScriptSourcePath(currentPath) &&
      !isGeneratedParserCompactExpectedOutputPath(currentPath)
    ) {
      discovered.push(currentPath);
    }
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  if (shouldIgnoreDirectory(path.basename(currentPath), ignoredDirNames, includeHiddenDirNames)) {
    return;
  }
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    collectTypeScriptFiles(
      path.join(currentPath, entry.name),
      ignoredDirNames,
      includeHiddenDirNames,
      discovered,
    );
  }
}

function shouldIgnoreDirectory(
  name: string,
  ignoredDirNames: ReadonlySet<string>,
  includeHiddenDirNames: ReadonlySet<string>,
): boolean {
  return (
    ignoredDirNames.has(name) ||
    (name.startsWith(".") && name !== "." && name !== ".." && !includeHiddenDirNames.has(name))
  );
}

function nearestPackageRoot(startPath: string): string | undefined {
  let currentPath = startPath;
  while (true) {
    if (fs.existsSync(path.join(currentPath, "package.json"))) {
      return currentPath;
    }
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return undefined;
    }
    currentPath = parentPath;
  }
}
