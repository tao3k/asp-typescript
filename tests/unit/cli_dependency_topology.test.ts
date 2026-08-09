import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { buildDependencyTopologyPacket } from "../../src/cli/dependency-topology.js";
import { runCli } from "../../src/cli/main.js";

async function withPackageJson(
  run: (workspaceRoot: string) => void | Promise<void>,
): Promise<void> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "ts-dependency-topology-"));
  try {
    writeFileSync(
      join(workspaceRoot, "package.json"),
      JSON.stringify({
        name: "dependency-topology-fixture",
        dependencies: { react: "18.2.0" },
        devDependencies: { vitest: "^2.1.0" },
      }),
    );
    await run(workspaceRoot);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

test("dependency topology packet uses parser-owned dependency versions", async () => {
  await withPackageJson((workspaceRoot) => {
    const packet = buildDependencyTopologyPacket(workspaceRoot);
    assert.equal(packet.packetKind, "dependency-topology");
    assert.match(packet.fingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(
      packet.graph.nodes.map(({ id, kind, value }) => ({ id, kind, value })),
      [
        {
          id: "dependency:react",
          kind: "dependency",
          value: "react",
        },
        {
          id: "dependency-version:react",
          kind: "dependency-version",
          value: "18.2.0",
        },
        {
          id: "dependency:vitest",
          kind: "dependency",
          value: "vitest",
        },
        {
          id: "dependency-version:vitest",
          kind: "dependency-version",
          value: "^2.1.0",
        },
      ],
    );
    assert.deepEqual(packet.graph.edges, [
      {
        source: "dependency:react",
        target: "dependency-version:react",
        relation: "version_locked",
      },
      {
        source: "dependency:vitest",
        target: "dependency-version:vitest",
        relation: "version_locked",
      },
    ]);
  });
});

test("search dependency-topology emits the canonical JSON packet", async () => {
  await withPackageJson(async (workspaceRoot) => {
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["search", "dependency-topology", "--json", "--workspace", workspaceRoot],
      {
        stdout: {
          write(chunk: string) {
            stdout += chunk;
          },
        },
        stderr: {
          write(chunk: string) {
            stderr += chunk;
          },
        },
      },
      workspaceRoot,
    );
    assert.equal(exitCode, 0);
    assert.equal(stderr, "");
    const packet = JSON.parse(stdout) as {
      readonly packetKind: string;
      readonly graph: {
        readonly nodes: readonly { readonly kind: string }[];
        readonly edges: readonly { readonly relation: string }[];
      };
    };
    assert.equal(packet.packetKind, "dependency-topology");
    assert.ok(packet.graph.nodes.some(({ kind }) => kind === "dependency-version"));
    assert.ok(packet.graph.edges.every(({ relation }) => relation === "version_locked"));
  });
});

test("bundled provider emits dependency topology through the canonical CLI", async () => {
  await withPackageJson((workspaceRoot) => {
    const providerBinary = resolve(import.meta.dirname, "../../provider/ts-harness.mjs");
    const result = spawnSync(
      process.execPath,
      [providerBinary, "search", "dependency-topology", "--json", "--workspace", workspaceRoot],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(result.stdout) as {
      readonly packetKind: string;
      readonly fingerprint: string;
    };
    assert.equal(packet.packetKind, "dependency-topology");
    assert.match(packet.fingerprint, /^sha256:[0-9a-f]{64}$/);
  });
});

test("provider manifest advertises the canonical dependency-topology route", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../../provider/asp-provider-manifest.json"), "utf8"),
  ) as {
    readonly searchCapabilities: { readonly dependencyTopology?: boolean };
    readonly routeBindings: { readonly dependencyTopology?: string };
  };
  assert.equal(manifest.searchCapabilities.dependencyTopology, true);
  assert.equal(manifest.routeBindings.dependencyTopology, "search/dependency-topology");
});
