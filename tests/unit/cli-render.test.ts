import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HELP_TEXT, runCli } from "../../src/cli/main.js";
import { TYPE_SCRIPT_BINARY } from "../../src/cli/semantic-language.js";

function captureStd() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    stdout: {
      write(chunk: string) {
        out.push(chunk);
      },
    },
    stderr: {
      write(chunk: string) {
        err.push(chunk);
      },
    },
    out,
    err,
  };
}

describe("CLI protocol help", () => {
  it("documents only search, check, and agent entrypoints", () => {
    assert.ok(HELP_TEXT.includes(`${TYPE_SCRIPT_BINARY} search <view>`));
    assert.ok(
      HELP_TEXT.includes(`${TYPE_SCRIPT_BINARY} query (--catalog <id> | --treesitter-query`),
    );
    assert.ok(HELP_TEXT.includes(`${TYPE_SCRIPT_BINARY} check`));
    assert.ok(HELP_TEXT.includes(`${TYPE_SCRIPT_BINARY} agent doctor`));
    assert.doesNotMatch(HELP_TEXT, /--tree(?:\s|$)/u);
    assert.equal(HELP_TEXT.includes("--stats"), false);
    assert.equal(HELP_TEXT.includes("--harness"), false);
    assert.equal(HELP_TEXT.includes("--agent-compact"), false);
    assert.equal(HELP_TEXT.includes("--agent-snapshot"), false);
  });

  it("runCli with --help prints help and exits 0", async () => {
    const { stdout, stderr, out, err } = captureStd();
    const code = await runCli(["--help"], { stdout, stderr }, "/");
    assert.equal(code, 0);
    assert.ok(out.join("").startsWith(TYPE_SCRIPT_BINARY));
    assert.equal(err.join(""), "");
  });
});

describe("CLI removed compatibility flags", () => {
  it("rejects old direct output flags", async () => {
    for (const argv of [
      ["--tree", "."],
      ["--stats", "."],
      ["--harness", "."],
      ["--agent-compact", "."],
      ["--agent-snapshot", "."],
    ]) {
      const { stdout, stderr } = captureStd();
      const code = await runCli(argv, { stdout, stderr }, "/");
      assert.equal(code, 2);
    }
  });

  it("rejects bare project-root invocation", async () => {
    const { stdout, stderr } = captureStd();
    const code = await runCli(["."], { stdout, stderr }, "/");
    assert.equal(code, 2);
  });
});
