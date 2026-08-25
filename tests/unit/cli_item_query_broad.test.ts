import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/main.js";

async function withTypeScriptProject<T>(callback: (root: string) => T | Promise<T>): Promise<T> {
  const root = mkdtempSync(path.join(tmpdir(), "asp-typescript-item-query-"));
  try {
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "ESNext",
          target: "ES2022",
          strict: true,
        },
        include: ["src/**/*.ts"],
      }),
    );
    writeFileSync(
      path.join(root, "src", "item-query.ts"),
      [
        "export function compactExpandActions(value: string): string {",
        "  return value.trim();",
        "}",
        "",
        "export function renderSemanticQueryJson(): string {",
        '  return "json";',
        "}",
        "",
        "export function projectionNodesFromCompactCode(value: string): string[] {",
        "  return [value];",
        "}",
      ].join("\n"),
    );

    return await callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

async function runSearch(root: string, itemQuery: string): Promise<string> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(
    ["search", "owner", "src/item-query.ts", "items", "--query", itemQuery, "--workspace", "."],
    {
      stdout: { write: (chunk: string) => (stdout += chunk) },
      stderr: { write: (chunk: string) => (stderr += chunk) },
    },
    root,
  );

  assert.equal(exitCode, 0, stderr);
  return stdout;
}

test("owner items broad mixed query returns names before code", async () => {
  await withTypeScriptProject(async (root) => {
    const output = await runSearch(
      root,
      "render_semantic_query_json|projection_from_code_line|projection_node|expandActions",
    );

    assert.match(output, /status=hit/u);
    assert.match(output, /match=mixed/u);
    assert.match(output, /output=names/u);
    assert.match(output, /revise=expandActions->compactExpandActions/u);
    assert.match(output, /next=query-code/u);
    assert.match(output, /\|item function compactExpandActions/u);
    assert.doesNotMatch(output, /\|code /u);
  });
});

test("owner items fallback miss returns revise-query before code", async () => {
  await withTypeScriptProject(async (root) => {
    const output = await runSearch(root, "render_semantic_query_json|projection_from_code_line");

    assert.match(output, /status=miss/u);
    assert.match(output, /fallback=owner-top-items/u);
    assert.match(output, /output=names/u);
    assert.match(output, /next=revise-query/u);
    assert.doesNotMatch(output, /\|code /u);
  });
});
