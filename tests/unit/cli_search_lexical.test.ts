import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

test("search lexical matches path-only TypeScript candidates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-lexical-"));
  const workspaceRenderer = path.resolve(
    process.cwd(),
    "..",
    "..",
    ".bin",
    "semantic-agent-protocol",
  );
  const previousRenderer = process.env.SEMANTIC_AGENT_PROTOCOL_BIN;
  if (fs.existsSync(workspaceRenderer)) {
    process.env.SEMANTIC_AGENT_PROTOCOL_BIN = workspaceRenderer;
  }
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          target: "ES2022",
        },
        include: ["src/**/*.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "hook_runtime.ts"),
      "export function execute(): void {}\n",
    );

    const result = runCliCapture(
      ["search", "lexical", "hookruntime", "owner", "tests", "--view", "seeds", "--workspace", "."],
      root,
    );

    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /^\[search-lexical\] q=hookruntime/u);
    assert.match(result.stdout, /O=owner:path\(src\/hook_runtime\.ts\)!owner/u);
    assert.match(result.stdout, /rank=(?:Q,)?O frontier=(?:Q\.lexical,)?O\.owner/u);
    assert.match(result.stdout, /owner-tests\(O=>covering-tests\+test-entrypoints\+fixtures\)/u);
    assert.doesNotMatch(result.stdout, /\|seed /u);

    const retiredAliasField = ["compatible", "Handles"].join("");
    const retiredResult = runCliCapture(
      [
        "search",
        "owner",
        "src/hook_runtime.ts",
        "items",
        "--query",
        retiredAliasField,
        "--view",
        "seeds",
        "--workspace",
        ".",
      ],
      root,
    );

    assert.equal(retiredResult.exitCode, 0, retiredResult.stderr);
    assert.match(retiredResult.stdout, /status=miss/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    if (previousRenderer === undefined) {
      delete process.env.SEMANTIC_AGENT_PROTOCOL_BIN;
    } else {
      process.env.SEMANTIC_AGENT_PROTOCOL_BIN = previousRenderer;
    }
  }
});
