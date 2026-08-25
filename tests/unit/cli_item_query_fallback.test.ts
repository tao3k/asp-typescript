import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

test("owner item query falls back to bounded top-level items on miss", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-owner-item-query-fallback-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "types.ts"),
    [
      "export type First = string;",
      "export interface Payload {",
      "  readonly id: string;",
      "}",
      "export function makePayload(): Payload {",
      "  return { id: 'demo' };",
      "}",
    ].join("\n"),
  );
  const result = runCliCapture(
    ["search", "owner", "src/types.ts", "items", "--query", "types|Types", "--workspace", "."],
    root,
  );
  assert.equal(result.exitCode, 0);
  assert.match(
    result.stdout,
    /^\[query-item\].*item=3.*itemQuery=types\|Types.*fallback=owner-top-items/mu,
  );
  assert.match(result.stdout, /\|item function makePayload owner=src\/types\.ts/mu);
  assert.match(result.stdout, /output=names/u);
  assert.match(result.stdout, /next=revise-query/u);
  assert.doesNotMatch(result.stdout, /\|code /u);
  fs.rmSync(root, { recursive: true, force: true });
});

test("owner item query fallback emits JSON packet evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-item-query-json-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "types.ts"),
    [
      "export interface Payload {",
      "  readonly id: string;",
      "}",
      "export function makePayload(): Payload {",
      "  return { id: 'demo' };",
      "}",
      "",
    ].join("\n"),
  );

  const result = runCliCapture(
    [
      "search",
      "owner",
      "src/types.ts",
      "items",
      "--query",
      "types|Types",
      "--json",
      "--workspace",
      ".",
    ],
    root,
  );

  assert.equal(result.exitCode, 0);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.header.fields.fallback, "owner-top-items");
  assert.equal(packet.queryCoverage[0].status, "miss");
  assert.equal(packet.queryCoverage[0].fields.fallback, "owner-top-items");
  assert.deepEqual(
    packet.items.map((item: { readonly name: string }) => item.name),
    ["Payload", "makePayload"],
  );
  assert.match(packet.items[1].fields.code, /makePayload/u);
  assert.equal(packet.notes[0].fields.fallback, "owner-top-items");

  fs.rmSync(root, { recursive: true, force: true });
});
