import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderTypeScriptReasoningTree, runTypeScriptProjectHarness } from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("reasoning tree renders tsconfig paths, package entries, roles, and import edges", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-reasoning-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "tests"));
  fs.mkdirSync(path.join(root, "generated"));
  fs.mkdirSync(path.join(root, "packages", "core"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/app",
      type: "module",
      main: "./dist/src/index.js",
      module: "./dist/src/consumer.js",
      types: "./dist/src/index.d.ts",
      browser: {
        "./dist/src/consumer.js": "./dist/src/browser.js",
      },
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
        },
        "./feature": "./dist/feature.js",
      },
      imports: {
        "#internal": "./src/domain.ts",
      },
      bin: {
        app: "./dist/src/consumer.js",
      },
      scripts: {
        build: "tsc -p tsconfig.json",
        harness: "asp-typescript check --full .",
      },
      workspaces: ["packages/*"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify({
      name: "@example/core",
      type: "module",
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      references: [{ path: "./packages/core" }],
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        baseUrl: ".",
        rootDir: ".",
        rootDirs: ["src", "generated"],
        outDir: "dist",
        paths: {
          "@app/*": ["src/*"],
        },
        declaration: true,
      },
      include: ["src/**/*.ts", "generated/**/*.ts", "tests/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "domain.ts"),
    ["export interface Domain { id: string }", "export const domain = 1;"].join("\n"),
  );
  fs.writeFileSync(path.join(root, "generated", "generated.ts"), "export const generated = 1;\n");
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    [
      'export { domain } from "./domain.js";',
      'export * as domainNs from "./domain.js";',
      'export type * as domainTypes from "./domain.js";',
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "src", "consumer.ts"),
    [
      'import { domain } from "@app/domain";',
      'import type { Domain } from "./domain.js";',
      'import "./domain.js";',
      'import "./generated.js";',
      'import "#internal";',
      'import "react";',
      'import "@example/core";',
      "export const consumed: Domain = { id: String(domain) };",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "tests", "consumer.test.ts"),
    'import { consumed } from "../src/consumer.js";\n',
  );

  const report = runTypeScriptProjectHarness(root);
  const tree = report.reasoningTree;
  assert.deepEqual(
    tree.pathAliases.map((alias) => alias.pattern),
    ["@app/*"],
  );
  assert.deepEqual(
    tree.packageEntrypoints.map((entry) => `${entry.subpath}:${entry.targets.join(",")}`),
    [
      "browser:./dist/src/browser.js",
      "main:./dist/src/index.js",
      "module:./dist/src/consumer.js",
      "types:./dist/src/index.d.ts",
    ],
  );
  assert.deepEqual(
    tree.packageExports.map((entry) => entry.subpath),
    [".", "./feature"],
  );
  assert.deepEqual(
    tree.packageImports.map((entry) => entry.subpath),
    ["#internal"],
  );
  assert.deepEqual(
    tree.packageBins.map((entry) => entry.subpath),
    ["app"],
  );
  assert.deepEqual(
    tree.packageScripts.map((script) => `${script.name}:${script.command}`),
    ["build:tsc -p tsconfig.json", "harness:asp-typescript check --full ."],
  );
  assert.deepEqual(
    tree.packageWorkspaces.map((workspace) => workspace.pattern),
    ["packages/*"],
  );
  assert.deepEqual(tree.workspacePatterns, ["packages/*"]);
  assert.deepEqual(
    tree.workspacePackages.map((workspacePackage) => ({
      name: workspacePackage.name,
      path: relativePath(root, workspacePackage.path),
      pattern: workspacePackage.pattern,
      configPath: relativePath(root, workspacePackage.configPath ?? ""),
    })),
    [
      {
        name: "@example/core",
        path: "packages/core",
        pattern: "packages/*",
        configPath: "packages/core/tsconfig.json",
      },
    ],
  );
  assert.deepEqual(
    tree.projectReferences.map((reference) => relativePath(root, reference)),
    ["packages/core"],
  );
  assert.deepEqual(
    tree.projectReferencePackages.map((referencePackage) => ({
      name: referencePackage.name,
      path: relativePath(root, referencePackage.path),
      configPath: relativePath(root, referencePackage.configPath ?? ""),
    })),
    [
      {
        name: "@example/core",
        path: "packages/core",
        configPath: "packages/core/tsconfig.json",
      },
    ],
  );
  assert.deepEqual(
    tree.projectReferenceResolutions.map((reference) => ({
      referencePath: relativePath(root, reference.referencePath),
      packageName: reference.packageName,
      packagePath: relativePath(root, reference.packagePath ?? ""),
    })),
    [
      {
        referencePath: "packages/core",
        packageName: "@example/core",
        packagePath: "packages/core",
      },
    ],
  );
  assert.deepEqual(
    tree.packageImportOwners.map((owner) => ({
      fromPath: relativePath(root, owner.fromPath),
      moduleSpecifier: owner.moduleSpecifier,
      packageName: owner.packageName,
      ownerKind: owner.ownerKind,
      via: owner.via,
    })),
    [
      {
        fromPath: "src/consumer.ts",
        moduleSpecifier: "@example/core",
        packageName: "@example/core",
        ownerKind: "project-reference",
        via: "package-name",
      },
    ],
  );
  assert.equal(tree.compilerOptions.declaration, true);

  const roleByPath = new Map(
    tree.modules.map((moduleReport) => [relativePath(root, moduleReport.path), moduleReport.role]),
  );
  assert.equal(roleByPath.get("src/index.ts"), "facade");
  assert.equal(roleByPath.get("src/consumer.ts"), "entrypoint");
  assert.equal(roleByPath.get("tests/consumer.test.ts"), "test");
  // All branches (including non-root source branches added by source+exports rule)
  assert.ok(
    tree.ownerBranches.length >= 4,
    `expected >=4 branches, got ${tree.ownerBranches.length}`,
  );

  // Root/facade/entrypoint branches should still match golden expectations
  const rootBranches = tree.ownerBranches
    .filter(
      (b) =>
        b.roles.includes("root") || b.roles.includes("facade") || b.roles.includes("entrypoint"),
    )
    .map((branch) => ({
      path: relativePath(root, branch.path),
      ownerNamespace: branch.ownerNamespace,
      roles: branch.roles,
      externalImports: branch.importSummary.externalImports,
      childEdges: branch.childEdges.map(
        (edge) => `${edge.kind}:${relativePath(root, edge.toPath ?? "")}`,
      ),
    }));

  assert.deepEqual(rootBranches, [
    {
      path: "src/consumer.ts",
      ownerNamespace: "src/consumer",
      roles: ["root", "entrypoint"],
      externalImports: 2,
      childEdges: [],
    },
    {
      path: "src/index.ts",
      ownerNamespace: "src",
      roles: ["root", "facade"],
      externalImports: 0,
      childEdges: ["export:src/domain.ts", "export:src/domain.ts", "export:src/domain.ts"],
    },
  ]);
  // Non-root source branches are present
  assert.ok(
    tree.ownerBranches.some((b) => relativePath(root, b.path) === "generated/generated.ts"),
  );
  assert.ok(tree.ownerBranches.some((b) => relativePath(root, b.path) === "src/domain.ts"));
  assert.ok(
    tree.ownerDependencies.some(
      (dependency) =>
        relativePath(root, dependency.fromPath) === "src/consumer.ts" &&
        dependency.resolution === "path-alias" &&
        dependency.kind === "import" &&
        relativePath(root, dependency.toPath ?? "") === "src/domain.ts",
    ),
  );
  assert.equal(
    tree.ownerDependencies.some((dependency) => dependency.moduleSpecifier === "react"),
    false,
  );
  assert.deepEqual(tree.shadowedSourceOwners, []);
  assert.deepEqual(tree.orphanedSourceFiles, []);

  const rendered = renderTypeScriptReasoningTree(report);
  assert.match(rendered, /^Modules: source=4 roots=2 branches=4 deps=/u);
  assert.match(rendered, /OwnerBranches:/u);
  assert.match(rendered, /src\/index\.ts \[root, facade\] owner=src/u);
  assert.match(rendered, /src\/consumer\.ts \[root, entrypoint\] owner=src\/consumer/u);
  assert.match(rendered, /src\/consumer\.ts \[root, entrypoint\].*imports=.*external:2/u);
  assert.match(rendered, /OwnerDependencies:/u);
  assert.match(rendered, /package exports:\. \[types\] --unresolved--> \.\/dist\/index\.d\.ts/u);
  assert.match(rendered, /package field:main --owner--> src\/index\.ts/u);
  assert.match(rendered, /src\/consumer\.ts --path-alias\/import--> src\/domain\.ts/u);
  assert.match(
    rendered,
    /src\/consumer\.ts --package-name\/import--> packages\/core owner=project-reference/u,
  );
  assert.doesNotMatch(rendered, /src\/consumer\.ts --external\/import--> react/u);
});

test("reasoning tree reports shadowed TypeScript source owner shapes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-shadowed-source-"));
  fs.mkdirSync(path.join(root, "src", "domain"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@example/shadowed-source", type: "module" }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), 'export { domain } from "./domain.js";\n');
  fs.writeFileSync(path.join(root, "src", "domain.ts"), "export const domain = 1;\n");
  fs.writeFileSync(path.join(root, "src", "domain", "index.ts"), "export const indexed = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const tree = report.reasoningTree;
  const rendered = renderTypeScriptReasoningTree(report);

  assert.deepEqual(
    tree.shadowedSourceOwners.map((shadow) => ({
      ownerNamespace: shadow.ownerNamespace,
      paths: shadow.paths.map((filePath) => relativePath(root, filePath)),
    })),
    [
      {
        ownerNamespace: "src/domain",
        paths: ["src/domain.ts", "src/domain/index.ts"],
      },
    ],
  );
  assert.match(rendered, /^Modules: .*shadowed=1/mu);
  assert.doesNotMatch(rendered, /shadowed=0/u);
});

test("reasoning tree does not treat explicit facade forwarding as shadowed source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-facade-forward-"));
  fs.mkdirSync(path.join(root, "src", "domain"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@example/facade-forward", type: "module" }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), 'export * from "./domain.js";\n');
  fs.writeFileSync(path.join(root, "src", "domain.ts"), 'export * from "./domain/index.js";\n');
  fs.writeFileSync(path.join(root, "src", "domain", "index.ts"), "export const domain = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptReasoningTree(report);

  assert.deepEqual(report.reasoningTree.shadowedSourceOwners, []);
  assert.doesNotMatch(rendered, /shadowed=/u);
});

test("reasoning tree reports orphaned TypeScript source files from entry roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-orphaned-source-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@example/orphaned-source", type: "module" }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = 1;\n");
  fs.writeFileSync(path.join(root, "src", "forgotten.ts"), "export const forgotten = 1;\n");

  const report = runTypeScriptProjectHarness(root);
  const tree = report.reasoningTree;
  const rendered = renderTypeScriptReasoningTree(report);

  assert.deepEqual(
    tree.orphanedSourceFiles.map((filePath) => relativePath(root, filePath)),
    ["src/forgotten.ts"],
  );
  assert.match(rendered, /^Modules: .*orphaned=1/mu);
  assert.doesNotMatch(rendered, /orphaned=0/u);
  assert.doesNotMatch(rendered, /FindingGroups:/u);
});
