import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

type JsonObject = Record<string, unknown>;

type PredicatePlanValue = { readonly kind: "string" | "capture"; readonly value: string };

test("query --treesitter-query renders compact syntax capture locators", () => {
  const root = treeSitterQueryFixture();
  const result = runCliCapture(functionNameTreeSitterQueryArgs(), root);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout, "src/demo.ts:1\nalpha");
  assert.doesNotMatch(result.stdout, /\|syntax-capture/u);
  assert.doesNotMatch(result.stdout, /artifactId|sqlite|cacheRoot/u);
});

test("query --treesitter-query --json emits semantic tree-sitter query packet", () => {
  const root = treeSitterQueryFixture();
  const result = runCliCapture(functionNameTreeSitterQueryArgs(["--json"]), root);
  assert.equal(result.exitCode, 0, result.stderr);
  const packet = JSON.parse(result.stdout) as JsonObject;
  assert.equal(packet.schemaId, "agent.semantic-protocols.semantic-tree-sitter-query");
  assert.equal(packet.method, "query");
  assert.equal(packet.languageId, "typescript");
  assert.equal(packet.providerId, "ts-harness");
  assert.equal(packet.grammarId, "tree-sitter-typescript");
  assert.equal(packet.grammarProfileVersion, "2026-06-05.v1");
  assert.equal(packet.sourceAuthority, "native-parser-adapter");
  assert.equal(packet.adapterMode, "native-projection");
  assert.equal(packet.compatibilityLevel, "native-only");
  const query = record(packet.query, "packet.query");
  assert.equal(query.inputForm, "s-expression");
  const queryFields = record(query.fields, "packet.query.fields");
  assert.deepEqual(queryFields.captures, ["function.name"]);
  assert.deepEqual(queryFields.nodeTypes, ["function_declaration", "identifier"]);
  assert.deepEqual(queryFields.fields, ["name"]);
  const matches = array(packet.matches, "packet.matches");
  assert.equal(matches.length, 1);
  const firstMatch = record(matches[0], "packet.matches[0]");
  assert.deepEqual(firstMatch.nativeFactRefs, ["typescript:item:src/demo.ts:1:3:alpha"]);
  assert.deepEqual(record(firstMatch.range, "match.range").lineRange, { start: 1, end: 3 });
  const firstCapture = record(
    array(firstMatch.captures, "packet.matches[0].captures")[0],
    "capture",
  );
  assert.equal(firstCapture.name, "function.name");
  assert.equal(firstCapture.nodeType, "identifier");
  assert.equal(firstCapture.field, "name");
  assert.deepEqual(record(firstCapture.range, "capture.range").lineRange, { start: 1, end: 1 });
  const captureFields = record(firstCapture.fields, "capture.fields");
  assert.equal(captureFields.read, "src/demo.ts:1:1");
  assert.equal(captureFields.itemRead, "src/demo.ts:1:3");
  assert.equal(captureFields.nativeNodeType, "function_declaration");
  assert.equal(record(packet.cache, "packet.cache").rawSourceStored, false);
});

test("query --treesitter-query --json keeps capture line separate from declaration range", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-tree-sitter-split-name-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "src", "demo.ts"),
    ["export function", "splitName(): number {", "  return 1;", "}"].join("\n"),
  );

  const result = runCliCapture(functionNameTreeSitterQueryArgs(["--json"]), root);
  assert.equal(result.exitCode, 0, result.stderr);
  const packet = JSON.parse(result.stdout) as JsonObject;
  const firstMatch = record(array(packet.matches, "packet.matches")[0], "match");
  assert.deepEqual(record(firstMatch.range, "match.range").lineRange, { start: 1, end: 4 });
  const firstCapture = record(array(firstMatch.captures, "match.captures")[0], "capture");
  assert.equal(firstCapture.nodeType, "identifier");
  assert.equal(firstCapture.field, "name");
  assert.deepEqual(record(firstCapture.range, "capture.range").lineRange, { start: 2, end: 2 });
  const fields = record(firstCapture.fields, "capture.fields");
  assert.equal(fields.read, "src/demo.ts:2:2");
  assert.equal(fields.itemRead, "src/demo.ts:1:4");
});

test("query --treesitter-query applies ASP typed match predicates", () => {
  const root = treeSitterPredicateFixture();
  const query =
    '(function_declaration name: (identifier) @function.name (#match? @function.name "^alp"))';
  const result = runCliCapture(
    functionNameTreeSitterQueryArgs([], predicatePlanArgs("match", "^alp"), query),
    root,
  );

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout, "src/demo.ts:1\nalpha");
});

test("query --treesitter-query applies ASP typed any predicates", () => {
  const root = treeSitterPredicateFixture();
  const query =
    '(function_declaration name: (identifier) @function.name (#any-match? @function.name "^bet"))';
  const result = runCliCapture(
    functionNameTreeSitterQueryArgs([], predicatePlanArgs("any-match", "^bet"), query),
    root,
  );

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout, "src/demo.ts:2\nbeta");
});

test("query --treesitter-query renders multi-path corpus locators", () => {
  const root = treeSitterMultiPathFixture();
  const result = runCliCapture(functionNameTreeSitterQueryArgs(), root);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout, "src/a.ts:1\nalpha\n\nsrc/b.ts:1\nbeta");
  assert.doesNotMatch(result.stdout, /\|syntax-capture|artifactId|sqlite|cacheRoot/u);
});

const predicateMatrixCases: readonly {
  readonly name: string;
  readonly queryOperator: string;
  readonly planOperator: string;
  readonly values: readonly PredicatePlanValue[];
  readonly expected: string;
}[] = [
  {
    name: "eq",
    queryOperator: "#eq?",
    planOperator: "eq",
    values: [{ kind: "string", value: "alpha" }],
    expected: "src/demo.ts:1\nalpha",
  },
  {
    name: "any-eq",
    queryOperator: "#any-eq?",
    planOperator: "any-eq",
    values: [{ kind: "string", value: "beta" }],
    expected: "src/demo.ts:2\nbeta",
  },
  {
    name: "any-of",
    queryOperator: "#any-of?",
    planOperator: "any-of",
    values: [
      { kind: "string", value: "missing" },
      { kind: "string", value: "beta" },
    ],
    expected: "src/demo.ts:2\nbeta",
  },
  {
    name: "match",
    queryOperator: "#match?",
    planOperator: "match",
    values: [{ kind: "string", value: "^alp" }],
    expected: "src/demo.ts:1\nalpha",
  },
  {
    name: "any-match",
    queryOperator: "#any-match?",
    planOperator: "any-match",
    values: [{ kind: "string", value: "^bet" }],
    expected: "src/demo.ts:2\nbeta",
  },
  {
    name: "not-eq",
    queryOperator: "#not-eq?",
    planOperator: "not-eq",
    values: [{ kind: "string", value: "alpha" }],
    expected: "src/demo.ts:2\nbeta",
  },
  {
    name: "not-match",
    queryOperator: "#not-match?",
    planOperator: "not-match",
    values: [{ kind: "string", value: "^alp" }],
    expected: "src/demo.ts:2\nbeta",
  },
  {
    name: "capture operand",
    queryOperator: "#eq?",
    planOperator: "eq",
    values: [{ kind: "capture", value: "function.name" }],
    expected: "src/demo.ts:1\nalpha\n\nsrc/demo.ts:2\nbeta",
  },
];

for (const scenario of predicateMatrixCases) {
  test(`query --treesitter-query predicate matrix applies ${scenario.name}`, () => {
    const root = treeSitterPredicateFixture();
    const result = runCliCapture(
      functionNameTreeSitterQueryArgs(
        [],
        predicatePlanArgs(scenario.planOperator, scenario.values),
        functionNamePredicateQuery(scenario.queryOperator, scenario.values),
      ),
      root,
    );

    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stdout, scenario.expected);
  });
}

test("query --treesitter-query --json reports ASP typed predicates", () => {
  const root = treeSitterPredicateFixture();
  const query =
    '(function_declaration name: (identifier) @function.name (#not-eq? @function.name "alpha"))';
  const result = runCliCapture(
    functionNameTreeSitterQueryArgs(["--json"], predicatePlanArgs("not-eq", "alpha"), query),
    root,
  );

  assert.equal(result.exitCode, 0, result.stderr);
  const packet = JSON.parse(result.stdout) as JsonObject;
  const fields = record(record(packet.query, "packet.query").fields, "packet.query.fields");
  assert.deepEqual(fields.nodeTypes, ["function_declaration", "identifier"]);
  assert.deepEqual(fields.predicates, [
    {
      op: "not-eq",
      capture: "function.name",
      values: [{ kind: "string", value: "alpha" }],
    },
  ]);
  assert.deepEqual(fields.unsupportedPredicates, []);
  const matches = array(packet.matches, "packet.matches");
  assert.equal(matches.length, 1);
  assert.deepEqual(record(matches[0], "packet.matches[0]").nativeFactRefs, [
    "typescript:item:src/demo.ts:2:2:beta",
  ]);
});

test("query --treesitter-query rejects removed direct code output", () => {
  const root = treeSitterQueryFixture();
  const result = runCliCapture(
    functionNameTreeSitterQueryArgs(["--selector", "src/demo.ts:1:3", "--code"]),
    root,
  );
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /unknown tree-sitter query option: --code/u);
});

test("query --treesitter-query exact selector scans outside default source roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-tree-sitter-selector-"));
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "dist", "member.ts"),
    ["export function fromDist(): string {", "  return 'dist';", "}"].join("\n"),
  );

  const result = runCliCapture(
    functionNameTreeSitterQueryArgs(["--selector", "dist/member.ts:1:3", "--json"]),
    root,
  );

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(array(record(JSON.parse(result.stdout), "packet").matches, "matches").length, 1);
});

test("query --treesitter-query selector uses canonical paths instead of suffix matching", () => {
  const root = treeSitterQueryFixture();

  const suffixSelector = runCliCapture(
    functionNameTreeSitterQueryArgs(["--selector", "demo.ts:1:3", "--json"]),
    root,
  );
  assert.equal(suffixSelector.exitCode, 0, suffixSelector.stderr);
  assert.equal(
    array(record(JSON.parse(suffixSelector.stdout), "packet").matches, "matches").length,
    0,
  );

  const absoluteSelector = runCliCapture(
    functionNameTreeSitterQueryArgs([
      "--selector",
      `${path.join(root, "src", "demo.ts")}:1:3`,
      "--json",
    ]),
    root,
  );
  assert.equal(absoluteSelector.exitCode, 0, absoluteSelector.stderr);
  assert.equal(
    array(record(JSON.parse(absoluteSelector.stdout), "packet").matches, "matches").length,
    1,
  );
});

test("direct provider inline tree-sitter query requires ASP compiled plan", () => {
  const root = treeSitterQueryFixture();
  const result = runCliCapture(
    [
      "query",
      "--treesitter-query",
      "(function_declaration name: (identifier) @function.name)",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(result.exitCode, 3);
  assert.match(result.stderr, /requires ASP-compiled query plan/u);
});

test("query --catalog declarations uses embedded canonical catalog", () => {
  const root = treeSitterQueryFixture();
  const result = runCliCapture(
    ["query", "--catalog", "declarations", "--json", "--workspace", "."],
    root,
  );
  assert.equal(result.exitCode, 0, result.stderr);
  const packet = JSON.parse(result.stdout) as JsonObject;
  const query = record(packet.query, "packet.query");
  assert.equal(query.inputForm, "catalog-id");
  assert.equal(query.catalogId, "declarations");
  assert.equal(query.catalogPath, "tree-sitter/tree-sitter-typescript/queries/declarations.scm");
  assert.match(String(query.compiledSource), /function_declaration/u);
  assert.equal(query.grammarProfilePath, "tree-sitter/tree-sitter-typescript/grammar-profile.json");
  assert.ok(array(packet.matches, "packet.matches").length >= 4);
});

test("query --catalog flow-lite renders native bounded frontier", () => {
  const root = flowLiteQueryFixture();
  const result = runCliCapture(flowLiteQueryArgs(), root);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /^\[query-flow-lite\] root=.* lang=typescript catalog=flow-lite/u);
  assert.match(result.stdout, /S=source:call\(payload_string\)@src\/flow.ts:10!code/u);
  assert.match(result.stdout, /K=sink:constructs\(ToolAction\)@src\/flow.ts:11!code/u);
  assert.match(result.stdout, /P=path:bounded\(S->K\)!flow/u);
  assert.match(result.stdout, /S>\{K:flows-to\}/u);
  assert.match(result.stdout, /confidence=bounded sourceAuthority=native-parser/u);
  assert.match(result.stdout, /frontier=S\.code,K\.code,P\.flow/u);
  assert.doesNotMatch(result.stdout, /unknown tree-sitter query option/u);
});

test("query --catalog flow-lite --json emits semantic flow-lite bounded packet", () => {
  const root = flowLiteQueryFixture();
  const result = runCliCapture(flowLiteQueryArgs(["--json"]), root);

  assert.equal(result.exitCode, 0, result.stderr);
  const packet = JSON.parse(result.stdout) as JsonObject;
  assert.equal(packet.schemaId, "agent.semantic-protocols.semantic-flow-lite");
  assert.equal(packet.languageId, "typescript");
  assert.equal(packet.providerId, "ts-harness");
  assert.equal(packet.flowKind, "local-source-sink");
  assert.equal(packet.sourceAuthority, "native-parser");
  assert.equal(packet.executionBackend, "native-parser");
  assert.equal(packet.adapterMode, "native-projection");
  assert.equal(packet.confidence, "bounded");
  assert.equal(packet.ownerPath, "src/flow.ts");
  assert.equal(array(packet.path, "packet.path").length, 3);
  assert.equal(record(array(packet.path, "packet.path")[0], "packet.path[0]").relation, "source");
  assert.equal(record(array(packet.path, "packet.path")[1], "packet.path[1]").relation, "sink");
  assert.equal(record(array(packet.path, "packet.path")[2], "packet.path[2]").relation, "flows-to");
  assert.deepEqual(packet.omissions, []);
  const fields = record(packet.fields, "packet.fields");
  assert.equal(fields.rawSourceStored, false);
  assert.equal(record(fields.where, "packet.fields.where")["scope.fn"], "collectToolActions");
});

test("query --catalog flow-lite rejects code output and open where keys", () => {
  const root = treeSitterQueryFixture();

  const codeOutput = runCliCapture(flowLiteQueryArgs(["--code"]), root);
  assert.equal(codeOutput.exitCode, 2);
  assert.match(codeOutput.stderr, /unsupported flow-lite query option: --code/u);

  const openWhere = runCliCapture(
    [
      "query",
      "--catalog",
      "flow-lite",
      "--where",
      "source.call=payload sink.constructs=Action scope.fn=collectToolActions guard.eq=isSafe",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(openWhere.exitCode, 2);
  assert.match(openWhere.stderr, /unsupported flow-lite --where key `guard\.eq`/u);
});

function treeSitterQueryFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-tree-sitter-query-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "src", "demo.ts"),
    [
      "export function alpha(input: string): string {",
      "  return input.toUpperCase();",
      "}",
      "export class Worker {}",
      "export interface Beta { readonly id: string; }",
      "export const value = alpha('x');",
    ].join("\n"),
  );
  return root;
}

function treeSitterPredicateFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-tree-sitter-predicate-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "src", "demo.ts"),
    [
      "export function alpha(): string { return 'alpha'; }",
      "export function beta(): string { return 'beta'; }",
    ].join("\n"),
  );
  return root;
}

function treeSitterMultiPathFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-tree-sitter-multipath-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "src", "a.ts"),
    "export function alpha(): string { return 'a'; }\n",
  );
  fs.writeFileSync(
    path.join(root, "src", "b.ts"),
    "export function beta(): string { return 'b'; }\n",
  );
  return root;
}

function flowLiteQueryFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-flow-lite-query-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "src", "flow.ts"),
    [
      "export class ToolAction {",
      "  constructor(readonly payload: string) {}",
      "}",
      "",
      "export function payload_string(input: string): string {",
      "  return input.trim();",
      "}",
      "",
      "export function collectToolActions(input: string): ToolAction[] {",
      "  const payload = payload_string(input);",
      "  return [new ToolAction(payload)];",
      "}",
    ].join("\n"),
  );
  return root;
}

function functionNameTreeSitterQueryArgs(
  extraArgs: readonly string[] = [],
  planArgs: readonly string[] = [],
  query = "(function_declaration name: (identifier) @function.name)",
): readonly string[] {
  const rootArgs = ["--workspace", "."];
  return [
    "query",
    "--treesitter-query",
    query,
    ...extraArgs,
    ...rootArgs,
    "--asp-syntax-query-captures",
    "function.name",
    "--asp-syntax-query-node-types",
    "function_declaration,identifier",
    "--asp-syntax-query-fields",
    "name",
    ...planArgs,
  ];
}

function flowLiteQueryArgs(extraArgs: readonly string[] = []): readonly string[] {
  const rootArgs = ["--workspace", "."];
  return [
    "query",
    "--catalog",
    "flow-lite",
    "--where",
    "source.call=payload_string sink.constructs=ToolAction scope.fn=collectToolActions",
    ...extraArgs,
    ...rootArgs,
  ];
}

function functionNamePredicateQuery(
  queryOperator: string,
  values: readonly PredicatePlanValue[],
): string {
  return `(function_declaration name: (identifier) @function.name (${queryOperator} @function.name ${values.map(predicateQueryOperand).join(" ")}))`;
}

function predicateQueryOperand(value: PredicatePlanValue): string {
  return value.kind === "capture" ? `@${value.value}` : JSON.stringify(value.value);
}

function predicatePlanArgs(
  op: string,
  value: string | readonly PredicatePlanValue[],
): readonly string[] {
  const values = typeof value === "string" ? [{ kind: "string" as const, value }] : value;
  return [
    "--asp-syntax-query-predicates-json",
    JSON.stringify([
      {
        op,
        capture: "function.name",
        values,
      },
    ]),
  ];
}

function record(value: unknown, label: string): JsonObject {
  assert.equal(typeof value, "object", `${label} should be object`);
  assert.notEqual(value, null, `${label} should not be null`);
  return value as JsonObject;
}

function array(value: unknown, label: string): readonly unknown[] {
  assert.ok(Array.isArray(value), `${label} should be array`);
  return value;
}
