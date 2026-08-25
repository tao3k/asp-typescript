import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { typeScriptHarnessConfigForProject } from "../../src/config.js";
import { discoverTypeScriptFiles } from "../../src/parser.js";

function writeFile(root: string, relativePath: string, content: string): string {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

describe("TypeScript file discovery", () => {
  it("skips generated parser compact TypeScript projection artifacts", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-files-"));
    const source = writeFile(root, "src/index.ts", "export const value = 1;\n");
    const generated = writeFile(
      root,
      "tests/fixtures/parser-compact/expected-output/data-shape/data-shape-basic/typescript/code.ts",
      "class PartialProjection {\n",
    );
    const realOutput = writeFile(
      root,
      "tests/fixtures/parser-compact/real-output/data-shape/data-shape-basic/typescript/code.ts",
      "class PartialProjection {\n",
    );

    const files = discoverTypeScriptFiles([root]);

    assert.ok(files.includes(source));
    assert.equal(files.includes(generated), false);
    assert.equal(files.includes(realOutput), false);
  });

  it("skips hidden directories by default", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-hidden-"));
    const source = writeFile(root, "src/index.ts", "export const value = 1;\n");
    const hidden = writeFile(root, ".devenv/generated.ts", "export const generated = 1;\n");

    const files = discoverTypeScriptFiles([root]);

    assert.ok(files.includes(source));
    assert.equal(files.includes(hidden), false);
  });

  it("allows configured hidden directories from asp.toml", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-asp-config-"));
    fs.writeFileSync(
      path.join(root, "asp.toml"),
      '[discovery]\nincludeHiddenDirNames = [".agent-fixtures"]\n',
      "utf8",
    );
    const source = writeFile(root, "src/index.ts", "export const value = 1;\n");
    const fixture = writeFile(
      root,
      ".agent-fixtures/generated.ts",
      "export const generated = 1;\n",
    );
    const config = typeScriptHarnessConfigForProject(root);

    const files = discoverTypeScriptFiles(
      [root],
      config.ignoredDirNames,
      config.includeHiddenDirNames,
    );

    assert.ok(files.includes(source));
    assert.ok(files.includes(fixture));
  });
});
