import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { tryRunFastSearchCli } from "../../src/cli/fast-search-cli.js";
import { runCli } from "../../src/cli/main.js";
import { TYPE_SCRIPT_PROVIDER_ID } from "../../src/cli/semantic-language.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function captureStreams() {
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

describe("metadata-only search fast path", () => {
  it("accepts every declared metadata view before protocol report construction", () => {
    const views = [
      ["env"],
      ["runtime-source"],
      ["lang"],
      ["std"],
      ["capability"],
      ["policy", "TS-AGENT"],
      ["extension", "node"],
      ["pattern", "declaration"],
      ["compare", "createProgram"],
    ] as const;

    for (const [view, ...query] of views) {
      const { stdout, stderr, out, err } = captureStreams();
      const status = tryRunFastSearchCli(
        ["search", view, ...query, "--workspace", packageRoot, "--json"],
        { stdout, stderr },
        packageRoot,
      );
      assert.equal(status, 0, view);
      assert.equal(err.join(""), "", view);
      const packet = JSON.parse(out.join("")) as Record<string, unknown>;
      assert.equal(packet.method, `search/${view}`);
      assert.equal(packet.projectRoot, packageRoot);
      assert.equal(packet.schemaId, "agent.semantic-protocols.semantic-search-packet");
      assert.equal(packet.providerId, TYPE_SCRIPT_PROVIDER_ID);
    }
  });

  it("preserves the shared v1 packet at the public CLI boundary", async () => {
    const { stdout, stderr, out, err } = captureStreams();
    const status = await runCli(
      ["search", "capability", "--workspace", packageRoot, "--json"],
      { stdout, stderr },
      packageRoot,
    );
    assert.equal(status, 0);
    assert.equal(err.join(""), "");
    const packet = JSON.parse(out.join("")) as Record<string, unknown>;
    assert.equal(packet.method, "search/capability");
    assert.equal(packet.view, "capability");
    assert.equal(packet.renderMode, "graph");
    assert.ok(Array.isArray(packet.nodes));
    assert.ok(Array.isArray(packet.hits));
  });
});
