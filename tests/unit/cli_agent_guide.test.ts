import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

test("agent guide keeps workspace independent from exact projections", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-agent-guide-workspace-"));

  const result = runCliCapture(["agent", "guide", "."], root);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(
    result.stdout,
    /--selector <exact-structural-selector> --projection source --workspace <workspace-root>/u,
  );
  assert.match(
    result.stdout,
    /--selector <exact-structural-selector> --projection callable-skeleton --workspace <workspace-root>/u,
  );
  assert.match(
    result.stdout,
    /--workspace <workspace-root> is the independent workspace override/u,
  );
  assert.doesNotMatch(result.stdout, /trailing \. is the project root/u);
  assert.doesNotMatch(result.stdout, /<path\[:line\|:start-end\]>/u);
  assert.doesNotMatch(result.stdout, /--code/u);
});
