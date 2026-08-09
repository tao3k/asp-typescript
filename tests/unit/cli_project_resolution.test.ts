import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/main.js";

test("ProjectResolution derives package and source scope only from ASP candidates", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "ts-project-resolution-"));
  try {
    mkdirSync(join(workspaceRoot, "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "packages", "core", "src"), { recursive: true });
    mkdirSync(join(workspaceRoot, "examples", "not-a-member", "src"), { recursive: true });
    writeFileSync(
      join(workspaceRoot, "package.json"),
      JSON.stringify({
        name: "workspace-root",
        packageManager: "pnpm@10.0.0",
        workspaces: ["packages/*"],
        dependencies: { core: "workspace:*", react: "^19.0.0" },
      }),
    );
    writeFileSync(
      join(workspaceRoot, "tsconfig.json"),
      JSON.stringify({ include: ["src/**/*.ts"] }),
    );
    writeFileSync(join(workspaceRoot, "src", "index.ts"), "export const root = true;\n");
    writeFileSync(
      join(workspaceRoot, "src", "not-a-candidate.ts"),
      "export const hidden = true;\n",
    );
    writeFileSync(
      join(workspaceRoot, "packages", "core", "package.json"),
      JSON.stringify({ name: "core", devDependencies: { vitest: "^3.0.0" } }),
    );
    writeFileSync(
      join(workspaceRoot, "packages", "core", "src", "core.ts"),
      "export const core = true;\n",
    );
    writeFileSync(
      join(workspaceRoot, "examples", "not-a-member", "package.json"),
      JSON.stringify({ name: "not-a-workspace-member" }),
    );
    writeFileSync(
      join(workspaceRoot, "examples", "not-a-member", "src", "index.ts"),
      "export const mustNotEnterScope = true;\n",
    );
    writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

    const request = {
      schemaId: "agent.semantic-protocols.provider-project-resolution-request",
      schemaVersion: "1",
      languageId: "typescript",
      providerId: "ts-harness",
      candidateBase: ".",
      candidateGeneration: {
        algorithm: "blake3-path-set-v1",
        digest: `blake3:${"0".repeat(64)}`,
        authorities: ["asp-workspace-generation"],
      },
      collectionScope: { kind: "complete-generation" },
      candidatePaths: [
        "package.json",
        "tsconfig.json",
        "src/index.ts",
        "packages/core/package.json",
        "packages/core/src/core.ts",
        "examples/not-a-member/package.json",
        "examples/not-a-member/src/index.ts",
        "pnpm-lock.yaml",
      ],
      policyExclusions: [],
    };
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["project-resolution-stdin"],
      {
        stdin: JSON.stringify(request),
        stdout: { write: (chunk: string) => (stdout += chunk) },
        stderr: { write: (chunk: string) => (stderr += chunk) },
      },
      workspaceRoot,
    );

    assert.equal(exitCode, 0);
    assert.equal(stderr, "");
    const response = JSON.parse(stdout) as {
      readonly state: string;
      readonly scope: {
        readonly parserId: string;
        readonly packageGraph: {
          readonly parserId: string;
          readonly packages: readonly {
            readonly name: string;
            readonly targets: readonly {
              readonly sourceRoots: readonly string[];
              readonly entrypoints: readonly string[];
            }[];
          }[];
          readonly internalDependencyEdges: readonly unknown[];
          readonly externalDependencies: readonly unknown[];
        };
        readonly sourceScopes: readonly {
          readonly includeAuthority: string;
          readonly explicitPaths: readonly string[];
        }[];
        readonly metrics: {
          readonly parsedManifestCount: number;
          readonly affectedPackageCount: number;
          readonly fullWorkspaceReads: number;
          readonly dbOpens: number;
        };
      };
    };
    assert.equal(response.state, "resolved");
    assert.equal("resolution" in response, false);
    assert.equal(response.scope.parserId, "typescript.package-json");
    assert.equal(response.scope.packageGraph.parserId, "typescript.package-json");
    assert.equal(response.scope.metrics.parsedManifestCount, 2);
    assert.equal(response.scope.metrics.affectedPackageCount, 2);
    assert.equal(response.scope.metrics.fullWorkspaceReads, 0);
    assert.equal(response.scope.metrics.dbOpens, 0);
    assert.deepEqual(response.scope.packageGraph.packages.map(({ name }) => name).sort(), [
      "core",
      "workspace-root",
    ]);
    const allSourceRoots = response.scope.packageGraph.packages.flatMap(({ targets }) =>
      targets.flatMap(({ sourceRoots }) => sourceRoots),
    );
    assert.ok(allSourceRoots.includes("src"));
    assert.ok(allSourceRoots.includes("packages/core/src"));
    assert.ok(!allSourceRoots.includes("src/not-a-candidate.ts"));
    const rootScope = response.scope.sourceScopes.find(({ explicitPaths }) =>
      explicitPaths.includes("src/index.ts"),
    );
    assert.equal(rootScope?.includeAuthority, "manifest-explicit");
    assert.deepEqual(rootScope?.explicitPaths, ["src/index.ts"]);
    assert.equal(response.scope.packageGraph.internalDependencyEdges.length, 1);
    assert.equal(response.scope.packageGraph.externalDependencies.length, 2);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
