import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { TYPE_SCRIPT_BINARY } from "../../src/cli/semantic-language.js";

function packageRoot(): string {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "src"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error("package root not found");
}

test("package lock keeps the descriptor binary on the compiled CLI entrypoint", () => {
  const root = packageRoot();
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
    readonly bin?: Record<string, string>;
  };
  const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")) as {
    readonly packages?: Record<string, { readonly bin?: Record<string, string> }>;
  };

  assert.equal(
    packageJson.bin?.[TYPE_SCRIPT_BINARY]?.replace(/^\.\//u, ""),
    "dist/src/cli/main.js",
  );
  assert.equal(
    packageLock.packages?.[""]?.bin?.[TYPE_SCRIPT_BINARY]?.replace(/^\.\//u, ""),
    "dist/src/cli/main.js",
  );
});
