import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

function writeReasoningFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-reasoning-cli-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "tests"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/reasoning-cli",
      dependencies: { react: "^19.0.0" },
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts", "tests/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "src", "service.ts"),
    [
      'import { createElement } from "react";',
      "export function renderOrderStatus(input: string): unknown {",
      '  return createElement("div", undefined, input.trim());',
      "}",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "tests", "service.test.ts"),
    'import { renderOrderStatus } from "../src/service.js";\nrenderOrderStatus(" ok ");\n',
  );
  return root;
}

test("CLI advertises TypeScript reasoning search", () => {
  const root = writeReasoningFixture();

  const doctor = runCliCapture(["agent", "doctor", "--json", root], root);
  assert.equal(doctor.exitCode, 0, doctor.stderr);
  const registration = JSON.parse(doctor.stdout).registry.languages[0];
  assert.ok(registration.methods.includes("search/reasoning"));
  assert.ok(
    registration.methodDescriptors.some(
      (descriptor: { readonly method: string; readonly supportsCompact: boolean }) =>
        descriptor.method === "search/reasoning" && descriptor.supportsCompact,
    ),
  );

  const guide = runCliCapture(["agent", "guide", root], root);
  assert.equal(guide.exitCode, 0, guide.stderr);
  assert.match(guide.stdout, /reasoning-owner-tests=asp typescript search reasoning owner-tests/);
  assert.match(guide.stdout, /reasoning-owner-query=asp typescript search reasoning owner-query/);
  assert.match(guide.stdout, /reasoning-query-deps=asp typescript search reasoning query-deps/);
});

test("CLI executes TypeScript reasoning profiles", () => {
  const root = writeReasoningFixture();

  const ownerTests = runCliCapture(
    [
      "search",
      "reasoning",
      "owner-tests",
      "--owner",
      "src/service.ts",
      "--view",
      "seeds",
      "--workspace",
      root,
    ],
    root,
  );
  assert.equal(ownerTests.exitCode, 0, ownerTests.stderr);
  assert.match(
    ownerTests.stdout,
    /entries=owner-tests\(O=>covering-tests\+test-entrypoints\+fixtures\)/,
  );

  const ownerQuery = runCliCapture(
    [
      "search",
      "reasoning",
      "owner-query",
      "--owner",
      "src/service.ts",
      "--query",
      "renderOrderStatus",
      "--view",
      "seeds",
      "--workspace",
      root,
    ],
    root,
  );
  assert.equal(ownerQuery.exitCode, 0, ownerQuery.stderr);
  assert.match(ownerQuery.stdout, /entries=owner-query\(O,Q=>items\+tests\+dependency-usage\)/);

  const queryDeps = runCliCapture(
    [
      "search",
      "reasoning",
      "query-deps",
      "--query",
      "createElement",
      "--dependency",
      "react",
      "--view",
      "seeds",
      "--workspace",
      root,
    ],
    root,
  );
  assert.equal(queryDeps.exitCode, 0, queryDeps.stderr);
  assert.match(queryDeps.stdout, /entries=query-deps\(Q,D=>owners\+imports\+usage-tests\)/);
});
