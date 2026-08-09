import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`../../../tests/fixtures/${relativePath}`, import.meta.url));
}

function readTextFixture(relativePath: string): string {
  return fs.readFileSync(fixturePath(relativePath), "utf8").replace(/\r\n/gu, "\n");
}

function writeTsProject(root: string, packageName: string, sourceText: string): void {
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: packageName, type: "module" }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        strict: true,
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "demo.ts"), sourceText);
}

test("owner items --query emits compact item locators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-owner-item-query-"));
  writeTsProject(
    root,
    "owner-item-query-fixture",
    readTextFixture("compact-query/sources/owner-item-demo.ts"),
  );

  const result = runCliCapture(
    ["search", "owner", "src/demo.ts", "items", "--query", "alpha", "--workspace", "."],
    root,
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^\[query-item\].*item=1.*itemQuery=alpha/mu);
  assert.match(result.stdout, /next=query-code/u);
  assert.match(
    result.stdout,
    /\|item function alpha owner=src\/demo\.ts column=0 exported=true read=src\/demo\.ts:1:4/u,
  );
  assert.doesNotMatch(result.stdout, /\|code /u);
  assert.doesNotMatch(result.stdout, / text=/u);
  assert.doesNotMatch(result.stdout, /function beta/u);
});

test("owner items --query emits class member locators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-owner-class-member-query-"));
  writeTsProject(
    root,
    "owner-class-member-query-fixture",
    `
export class Runtime {
  tell(message: string): void {
    this.process(message);
  }

  private process(message: string): void {
    void message;
  }
}

export const unrelated = 1;
`.trimStart(),
  );

  const result = runCliCapture(
    ["search", "owner", "src/demo.ts", "items", "--query", "Runtime.tell", "--workspace", "."],
    root,
  );

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /^\[query-item\].*item=1.*itemQuery=Runtime\.tell/mu);
  assert.match(result.stdout, /next=query-code/u);
  assert.match(
    result.stdout,
    /\|item method Runtime\.tell owner=src\/demo\.ts column=2 read=src\/demo\.ts:\d+:\d+/u,
  );
  assert.doesNotMatch(result.stdout, /\|item class Runtime /u);
  assert.doesNotMatch(result.stdout, /\|item method Runtime\.process /u);
});
test("provider query rejects ASP-owned exact source projection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-structural-selector-no-hit-"));
  writeTsProject(root, "structural-selector-no-hit", "export function alpha(): void {}\n");

  const result = runCliCapture(
    [
      "query",
      "--selector",
      "typescript://src/demo.ts#item/function/does_not_exist",
      "--term",
      "does_not_exist",
      "--json",
      "--workspace",
      ".",
    ],
    root,
  );

  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /exact source projection is ASP-owned/u);
  assert.match(result.stderr, /--projection source\|callable-skeleton/u);
});
