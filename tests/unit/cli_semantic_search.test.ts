import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

test("CLI exposes semantic-search protocol commands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-semantic-search-cli-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "tests"));
  fs.mkdirSync(path.join(root, "test-fixtures"));
  fs.mkdirSync(path.join(root, "schemas"));
  fs.mkdirSync(path.join(root, "packages", "core", "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/search-cli",
      scripts: { build: "rspack build" },
      dependencies: { react: "^19.0.0", "@rspack/core": "^1.0.0" },
      workspaces: ["packages/*"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify({ name: "@example/core", type: "module", types: "./src/index.ts" }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "src", "index.ts"),
    "export interface Core { readonly ok: true; }\n",
  );
  fs.writeFileSync(
    path.join(root, "schemas", "semantic-search-packet.v1.schema.json"),
    JSON.stringify(
      {
        $id: "agent.semantic-protocols.semantic-search-packet",
        title: "Semantic Search Packet",
        properties: {
          schemaVersion: { const: "1" },
          searchSynthesis: { type: "object" },
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(root, "packages", "core", "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "@example/core": ["packages/core/src/index.ts"] },
      },
      include: ["src/**/*.ts", "tests/**/*.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    "export function findOrderStatus(input: string, strict: boolean): { readonly status: string; readonly strict: boolean } { return { status: strict ? input : 'ok', strict }; }\n",
  );
  fs.writeFileSync(
    path.join(root, "src", "consumer.ts"),
    [
      'import { findOrderStatus } from "./index.js";',
      'import type { Core } from "@example/core";',
      'const internalOrderToken = "ready";',
      'export const status = findOrderStatus("ready", true);',
      "export type CoreStatus = Core;",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(root, "tests", "flow.spec.ts"), "const specOnlyMarker = true;\n");
  const olderSearchPath = path.join(root, "src", "a-old.ts");
  const newerSearchPath = path.join(root, "src", "z-new.ts");
  fs.writeFileSync(olderSearchPath, 'export {};\nconst sharedMtimeNeedle = "older";\n');
  fs.writeFileSync(newerSearchPath, 'export {};\nconst sharedMtimeNeedle = "newer";\n');
  fs.utimesSync(
    olderSearchPath,
    new Date("2025-01-01T00:00:00Z"),
    new Date("2025-01-01T00:00:00Z"),
  );
  fs.utimesSync(
    newerSearchPath,
    new Date("2025-02-01T00:00:00Z"),
    new Date("2025-02-01T00:00:00Z"),
  );
  fs.writeFileSync(
    path.join(root, "tests", "index.test.ts"),
    'import { findOrderStatus } from "../src/index.js";\nconst testOnlyMarker = "ready";\nfindOrderStatus("ready", true);\n',
  );
  fs.writeFileSync(
    path.join(root, "test-fixtures", "semantic_search_schema.test.ts"),
    "export const schemaFixture = true;\n",
  );

  const prime = runCliCapture(["search", "prime", "--workspace", "."], root);
  assert.equal(prime.exitCode, 0);
  assert.match(prime.stdout, /^\[search-prime\] /u);
  assert.match(prime.stdout, /\bsourceFiles=\d+\b/u);
  assert.match(prime.stdout, /\bowners=\d+\b/u);
  assert.match(prime.stdout, /\bextensions=1\b/u);
  assert.match(prime.stdout, /\bbuildTools=1\b/u);
  assert.match(prime.stdout, /\|tsconfig tsconfig\.json /u);
  assert.match(prime.stdout, /\bpathAliases=1\b/u);
  assert.match(prime.stdout, /\bpaths=@example\/core\b/u);
  assert.match(prime.stdout, /\|extension react /u);
  assert.match(prime.stdout, /\bactivation=dependency\b/u);
  assert.match(prime.stdout, /\|build_tool rspack /u);
  assert.match(prime.stdout, /\bscripts=build\b/u);
  assert.match(prime.stdout, /\|test_surface \. /u);
  assert.match(prime.stdout, /\btests=2\b/u);
  assert.match(prime.stdout, /\|synthesis .*algorithm=owner-rank-frontier/u);
  assert.match(prime.stdout, /\|owner src\/index\.ts/u);

  const primeSeeds = runCliCapture(
    ["search", "prime", "--view", "seeds", "--workspace", "."],
    root,
  );
  assert.equal(primeSeeds.exitCode, 0);
  assert.match(primeSeeds.stdout, /^\[search-prime\] /u);
  assert.match(primeSeeds.stdout, /alg=(owner-rank-frontier|budgeted-prime-frontier-v1)/u);
  assert.match(primeSeeds.stdout, /O=owner:path\(src\/index\.ts\)!owner/u);
  assert.match(
    primeSeeds.stdout,
    /(?:N=lexical:target\(findOrderStatus\)!lexical|Q=query:term\(findOrderStatus\).*?!lexical)/u,
  );
  assert.match(primeSeeds.stdout, /frontier=/u);
  assert.doesNotMatch(primeSeeds.stdout, /\|flow |\|synthesis |\|seed /u);
  assert.doesNotMatch(primeSeeds.stdout, /\|owner /u);

  const dependencySeeds = runCliCapture(
    ["search", "deps", "react", "--view", "seeds", "--workspace", "."],
    root,
  );
  assert.equal(dependencySeeds.exitCode, 0);
  assert.match(dependencySeeds.stdout, /^\[search-dependency\] /u);
  assert.match(dependencySeeds.stdout, /D=dependency:pkg\(react\)!dependency/u);
  assert.match(dependencySeeds.stdout, /O=owner:path\(\.\)!owner/u);
  assert.match(dependencySeeds.stdout, /rank=D,O frontier=D\.dependency,O\.owner/u);
  assert.doesNotMatch(dependencySeeds.stdout, /\|dependency |\|owner |\|synthesis |\|seed /u);

  const workspace = runCliCapture(["search", "workspace", "--workspace", "."], root);
  assert.equal(workspace.exitCode, 0);
  assert.match(workspace.stdout, /^\[search-workspace\] /u);
  assert.match(workspace.stdout, /\bmode=workspace-index\b/u);
  assert.match(workspace.stdout, /\|package packages\/core /u);
  assert.doesNotMatch(workspace.stdout, /\|edge /u);

  const workspaceJson = runCliCapture(["search", "workspace", "--json", "--workspace", "."], root);
  assert.equal(
    workspaceJson.exitCode,
    0,
    `workspace JSON failed: ${JSON.stringify(workspaceJson)}`,
  );
  const workspacePacket = JSON.parse(workspaceJson.stdout) as {
    readonly method: string;
    readonly view: string;
    readonly packages: readonly { readonly id: string }[];
    readonly edges: readonly { readonly kind: string; readonly to: string }[];
  };
  assert.equal(workspacePacket.method, "search/workspace");
  assert.equal(workspacePacket.view, "workspace");
  assert.ok(workspacePacket.packages.some((pkg) => pkg.id === "packages/core"));
  assert.ok(
    workspacePacket.edges.some(
      (edge) => edge.kind === "workspace" && edge.to === "P:packages/core",
    ),
  );

  const packagePrime = runCliCapture(
    ["search", "prime", "--package", "packages/core", "--workspace", "."],
    root,
  );
  assert.equal(packagePrime.exitCode, 0);
  assert.match(packagePrime.stdout, /^\[search-prime\] /u);
  assert.match(packagePrime.stdout, /\bpackage=@example\/core\b/u);
  assert.match(packagePrime.stdout, /\|owner src\/index\.ts/u);

  const packagePrimeSeeds = runCliCapture(
    ["search", "prime", "--package", "packages/core", "--view", "seeds", "--workspace", "."],
    root,
  );
  assert.equal(packagePrimeSeeds.exitCode, 0);
  assert.match(packagePrimeSeeds.stdout, /^\[search-prime\] /u);
  assert.match(packagePrimeSeeds.stdout, /O=owner:path\(packages\/core\/src\/index\.ts\)!owner/u);
  assert.match(packagePrimeSeeds.stdout, /Q=query:term\(\*\).*?!lexical/u);
  assert.match(
    packagePrimeSeeds.stdout,
    /entries=owner-query\(O,Q=>items\+tests\+dependency-usage\)/u,
  );
  assert.doesNotMatch(packagePrimeSeeds.stdout, /\|owner |\|synthesis |\|seed /u);

  const packageQuerySetSeeds = runCliCapture(
    [
      "search",
      "lexical",
      "--query-set",
      "Core",
      "owner",
      "tests",
      "--package",
      "packages/core",
      "--view",
      "seeds",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(packageQuerySetSeeds.exitCode, 0);
  assert.match(packageQuerySetSeeds.stdout, /^\[search-lexical\] /u);
  assert.match(packageQuerySetSeeds.stdout, /Q=query:term\(Core\).*?!lexical/u);
  assert.match(
    packageQuerySetSeeds.stdout,
    /O=owner:path\((?:packages\/core\/)?src\/index\.ts\)!owner/u,
  );
  assert.match(packageQuerySetSeeds.stdout, /S=symbol:symbol\(Core\)(?:@[^!]+)?!symbol/u);
  assert.match(
    packageQuerySetSeeds.stdout,
    /entries=owner-query\(O,Q=>items\+tests\+dependency-usage\)/u,
  );
  assert.doesNotMatch(packageQuerySetSeeds.stdout, /\|hit |\|owner |\|synthesis |\|seed /u);

  const packagePrimeJson = runCliCapture(
    ["search", "prime", "--package", "packages/core", "--json", "--workspace", "."],
    root,
  );
  assert.equal(packagePrimeJson.exitCode, 0);
  const packagePrimePacket = JSON.parse(packagePrimeJson.stdout) as {
    readonly method: string;
    readonly view: string;
    readonly packageName: string;
    readonly projectRoot: string;
  };
  assert.equal(packagePrimePacket.method, "search/prime");
  assert.equal(packagePrimePacket.view, "prime");
  assert.equal(packagePrimePacket.packageName, "@example/core");
  assert.equal(
    packagePrimePacket.projectRoot,
    fs.realpathSync(path.join(root, "packages", "core")),
  );

  const workspaceDirectRead = runCliCapture(
    [
      "query",
      "--from-hook",
      "direct-source-read",
      "--workspace",
      ".",
      "--package",
      "packages/core",
      "--selector",
      "packages/core/src/index.ts:1:1",
      "--json",
    ],
    root,
  );
  assert.equal(workspaceDirectRead.exitCode, 0, workspaceDirectRead.stderr);
  const workspaceReadPacket = JSON.parse(workspaceDirectRead.stdout) as {
    readonly method: string;
    readonly ownerPath: string;
    readonly sourceWindows: readonly { readonly text: string }[];
  };
  assert.equal(workspaceReadPacket.method, "query/direct-source-read");
  assert.equal(workspaceReadPacket.ownerPath, "packages/core/src/index.ts");
  assert.match(workspaceReadPacket.sourceWindows[0]?.text ?? "", /export interface Core/u);

  const primeJson = runCliCapture(["search", "prime", "--json", "--workspace", "."], root);
  assert.equal(primeJson.exitCode, 0);
  const packet = JSON.parse(primeJson.stdout) as {
    readonly schemaId: string;
    readonly schemaVersion: string;
    readonly schemaAuthority: string;
    readonly protocolId: string;
    readonly protocolVersion: string;
    readonly languageId: string;
    readonly providerId: string;
    readonly binary: string;
    readonly namespace: string;
    readonly method: string;
    readonly view: string;
    readonly header: {
      readonly fields: {
        readonly sourceFiles?: number;
        readonly extensions?: number;
        readonly buildTools?: number;
      };
    };
    readonly nodes: readonly {
      readonly kind: string;
      readonly path?: string;
      readonly fields: Record<string, unknown>;
    }[];
    readonly owners: readonly unknown[];
    readonly searchSynthesis?: {
      readonly algorithm?: string;
      readonly scope?: string;
      readonly summary?: string;
      readonly highImpactOwners?: readonly string[];
    };
  };
  assert.equal(packet.schemaId, "agent.semantic-protocols.semantic-search-packet");
  assert.equal(packet.schemaVersion, "1");
  assert.equal(packet.protocolId, "agent.semantic-protocols.semantic-language");
  assert.equal(packet.protocolVersion, "1");
  assert.equal(packet.languageId, "typescript");
  assert.equal(packet.providerId, "ts-harness");
  assert.equal(packet.binary, "ts-harness");
  assert.equal(packet.namespace, "agent.semantic-protocols.languages.typescript.ts-harness");
  assert.equal(packet.method, "search/prime");
  assert.equal(packet.view, "prime");
  assert.equal(packet.header.fields.extensions, 1);
  assert.equal(packet.header.fields.buildTools, 1);
  assert.ok((packet.header.fields.sourceFiles ?? 0) >= 1);
  assert.ok(
    packet.nodes.some(
      (node) =>
        node.kind === "tsconfig" && node.path === "tsconfig.json" && node.fields.pathAliases === 1,
    ),
  );
  assert.ok(
    packet.nodes.some(
      (node) =>
        node.kind === "extension" &&
        node.path === "react" &&
        node.fields.activation === "dependency",
    ),
  );
  assert.ok(
    packet.nodes.some(
      (node) =>
        node.kind === "build_tool" &&
        node.path === "rspack" &&
        Array.isArray(node.fields.scripts) &&
        node.fields.scripts.includes("build"),
    ),
  );
  assert.ok(
    packet.nodes.some(
      (node) => node.kind === "test_surface" && node.path === "." && node.fields.tests === 2,
    ),
  );
  assert.equal(packet.searchSynthesis?.algorithm, "owner-rank-frontier");
  assert.equal(packet.searchSynthesis?.scope, "prime");
  assert.ok(packet.searchSynthesis?.highImpactOwners?.includes("src/index.ts"));
  assert.equal(packet.owners.length, 2);

  const text = runCliCapture(["search", "lexical", "OrderStatus", "--workspace", "."], root);
  assert.equal(text.exitCode, 0);
  assert.match(text.stdout, /^\[search-lexical\] /u);
  assert.match(text.stdout, /\|hit path=src\/index\.ts\b/u);
  assert.match(text.stdout, /\bsource=parser-visible-source\b/u);
  assert.match(text.stdout, /\brole=source\b/u);
  assert.match(text.stdout, /\bsymbol=findOrderStatus\b/u);

  const textOwnerTestsPipe = runCliCapture(
    ["search", "lexical", "findOrderStatus", "owner", "tests", "--workspace", "."],
    root,
  );
  assert.equal(textOwnerTestsPipe.exitCode, 0);
  assert.match(textOwnerTestsPipe.stdout, /^\[search-lexical\] /u);
  assert.match(textOwnerTestsPipe.stdout, /\bpipes=owner,tests\b/u);
  assert.match(textOwnerTestsPipe.stdout, /\|owner src\/index\.ts/u);
  assert.match(textOwnerTestsPipe.stdout, /\|hit path=tests\/index\.test\.ts lineRange=1:1\b/u);
  assert.match(
    textOwnerTestsPipe.stdout,
    /\|edge O:src\/index\.ts -test-> T:tests\/index\.test\.ts/u,
  );

  const textOwnerTestsPipeSeeds = runCliCapture(
    [
      "search",
      "lexical",
      "findOrderStatus",
      "owner",
      "tests",
      "--view",
      "seeds",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(textOwnerTestsPipeSeeds.exitCode, 0);
  assert.match(textOwnerTestsPipeSeeds.stdout, /^\[search-lexical\] /u);
  assert.match(textOwnerTestsPipeSeeds.stdout, /O\d*=owner:path\(src\/index\.ts\)!owner/u);
  assert.match(textOwnerTestsPipeSeeds.stdout, /O\d*=owner:path\(tests\/index\.test\.ts\)!owner/u);
  assert.match(textOwnerTestsPipeSeeds.stdout, /T=test:path\(tests\/index\.test\.ts\)!tests/u);
  assert.match(textOwnerTestsPipeSeeds.stdout, /frontier=.*O\d*\.owner/u);
  assert.match(textOwnerTestsPipeSeeds.stdout, /frontier=.*T\.tests/u);
  assert.doesNotMatch(textOwnerTestsPipeSeeds.stdout, /\|seed /u);
  assert.doesNotMatch(textOwnerTestsPipeSeeds.stdout, /\|hit /u);

  const textQuerySetSeeds = runCliCapture(
    [
      "search",
      "lexical",
      "--query-set",
      "findOrderStatus",
      "--query-set",
      "internalOrderToken",
      "owner",
      "tests",
      "--view",
      "seeds",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(textQuerySetSeeds.exitCode, 0);
  assert.match(textQuerySetSeeds.stdout, /^\[search-lexical\] /u);
  assert.match(textQuerySetSeeds.stdout, /\bquerySet=2\b/u);
  assert.match(textQuerySetSeeds.stdout, /\bselector=lexical-set\b/u);
  assert.match(textQuerySetSeeds.stdout, /O\d*=owner:path\(src\/index\.ts\)!owner/u);
  assert.match(textQuerySetSeeds.stdout, /O\d*=owner:path\(src\/consumer\.ts\)!owner/u);
  assert.match(textQuerySetSeeds.stdout, /T=test:path\(tests\/index\.test\.ts\)!tests/u);
  assert.match(textQuerySetSeeds.stdout, /frontier=.*O\d*\.owner/u);
  assert.match(textQuerySetSeeds.stdout, /frontier=.*T\.tests/u);
  assert.doesNotMatch(textQuerySetSeeds.stdout, /\|seed /u);

  const scopedTextQuerySetJson = runCliCapture(
    [
      "search",
      "lexical",
      "--query-set",
      "findOrderStatus",
      "--query-set",
      "internalOrderToken",
      "--owner",
      "src/consumer.ts",
      "--json",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(scopedTextQuerySetJson.exitCode, 0);
  const scopedQuerySetPacket = JSON.parse(scopedTextQuerySetJson.stdout) as {
    readonly query: string;
    readonly querySet: readonly { readonly value: string; readonly kind: string }[];
    readonly queryComposition: {
      readonly mode: string;
      readonly selector: string;
      readonly scope?: { readonly ownerPath?: string };
    };
    readonly header: {
      readonly fields: { readonly querySet?: number; readonly scopeOwner?: string };
    };
    readonly hits: readonly {
      readonly ownerPath: string;
      readonly fields?: { readonly queryTerms?: readonly string[] };
    }[];
    readonly searchSynthesis?: {
      readonly windowSet?: readonly { readonly kind: string; readonly target: string }[];
    };
  };
  assert.equal(scopedQuerySetPacket.query, "findOrderStatus,internalOrderToken");
  assert.deepEqual(
    scopedQuerySetPacket.querySet.map((term) => [term.value, term.kind]),
    [
      ["findOrderStatus", "text"],
      ["internalOrderToken", "text"],
    ],
  );
  assert.equal(scopedQuerySetPacket.queryComposition.mode, "query-set");
  assert.equal(scopedQuerySetPacket.queryComposition.selector, "lexical-set");
  assert.equal(scopedQuerySetPacket.queryComposition.scope?.ownerPath, "src/consumer.ts");
  assert.equal(scopedQuerySetPacket.header.fields.querySet, 2);
  assert.equal(scopedQuerySetPacket.header.fields.scopeOwner, "src/consumer.ts");
  assert.ok(scopedQuerySetPacket.hits.length > 0);
  assert.ok(scopedQuerySetPacket.hits.every((hit) => hit.ownerPath === "src/consumer.ts"));
  assert.ok(
    scopedQuerySetPacket.hits.some((hit) => hit.fields?.queryTerms?.includes("internalOrderToken")),
  );
  assert.deepEqual(scopedQuerySetPacket.searchSynthesis?.windowSet, [
    { kind: "owner", target: "src/consumer.ts" },
  ]);

  const flagLikeTextQuery = runCliCapture(
    ["search", "lexical", "--query-set", "--json", "--view", "seeds", "--workspace", "."],
    root,
  );
  assert.equal(flagLikeTextQuery.exitCode, 0);
  assert.match(flagLikeTextQuery.stdout, /^\[search-lexical\] q=--json\b/u);
  assert.match(flagLikeTextQuery.stdout, /O=owner:path\(--json\)!owner/u);
  assert.match(flagLikeTextQuery.stdout, /rank=Q,O frontier=Q\.lexical,O\.owner/u);
  assert.doesNotMatch(flagLikeTextQuery.stdout, /\|seed /u);
  assert.doesNotMatch(flagLikeTextQuery.stdout, /^\{/u);

  const testOnlyTextPipe = runCliCapture(
    ["search", "lexical", "testOnlyMarker", "owner", "tests", "--workspace", "."],
    root,
  );
  assert.equal(testOnlyTextPipe.exitCode, 0);
  assert.match(testOnlyTextPipe.stdout, /^\[search-lexical\] /u);
  assert.match(testOnlyTextPipe.stdout, /\|owner tests\/index\.test\.ts/u);
  assert.match(testOnlyTextPipe.stdout, /\|hit path=tests\/index\.test\.ts lineRange=2:2\b/u);
  assert.match(testOnlyTextPipe.stdout, /\blayer=test\b/u);
  assert.match(testOnlyTextPipe.stdout, /\brole=test\b/u);
  assert.match(testOnlyTextPipe.stdout, /\bq=testOnlyMarker\b/u);
  assert.doesNotMatch(testOnlyTextPipe.stdout, /\|owner src\/index\.ts/u);
  assert.doesNotMatch(testOnlyTextPipe.stdout, /\|edge O:src\/index\.ts -test->/u);

  const specText = runCliCapture(["search", "lexical", "specOnlyMarker", "--workspace", "."], root);
  assert.equal(specText.exitCode, 0);
  assert.match(specText.stdout, /\|hit path=tests\/flow\.spec\.ts lineRange=1:1\b/u);
  assert.match(specText.stdout, /\blayer=test\b/u);

  const invalidTextPipe = runCliCapture(
    ["search", "lexical", "findOrderStatus", "tests", "owner", "--workspace", "."],
    root,
  );
  assert.equal(invalidTextPipe.exitCode, 2);
  assert.match(invalidTextPipe.stderr, /expected pipes \(owner,tests\) before workspace selector/u);

  const sourceText = runCliCapture(
    ["search", "lexical", "internalOrderToken", "--workspace", "."],
    root,
  );
  assert.equal(sourceText.exitCode, 0);
  assert.match(sourceText.stdout, /^\[search-lexical\] /u);
  assert.match(sourceText.stdout, /\|hit path=src\/consumer\.ts lineRange=3:3\b/u);
  assert.match(sourceText.stdout, /\bkind=text\b/u);
  assert.match(sourceText.stdout, /\breason=source-text\b/u);
  assert.match(sourceText.stdout, /\bsource=parser-visible-source\b/u);

  const recencyText = runCliCapture(
    ["search", "lexical", "sharedMtimeNeedle", "--workspace", "."],
    root,
  );
  assert.equal(recencyText.exitCode, 0);
  assert.match(recencyText.stdout, /^\[search-lexical\] /u);
  assert.match(recencyText.stdout, /\|hit path=src\/z-new\.ts lineRange=2:2\b/u);
  assert.match(recencyText.stdout, /\|hit path=src\/a-old\.ts lineRange=2:2\b/u);
  assert.ok(
    recencyText.stdout.indexOf("|hit path=src/z-new.ts lineRange=2:2") <
      recencyText.stdout.indexOf("|hit path=src/a-old.ts lineRange=2:2"),
    recencyText.stdout,
  );

  const symbol = runCliCapture(["search", "symbol", "findOrderStatus", "--workspace", "."], root);
  assert.equal(symbol.exitCode, 0);
  assert.match(symbol.stdout, /^\[search-symbol\] /u);
  assert.match(symbol.stdout, /\|hit path=src\/index\.ts lineRange=1:1\b/u);
  assert.match(symbol.stdout, /kind=symbol/u);

  const api = runCliCapture(["search", "api", "findOrderStatus", "--workspace", "."], root);
  assert.equal(api.exitCode, 0);
  assert.match(api.stdout, /^\[search-api\] /u);
  assert.match(api.stdout, /\bsource=native-parser\b/u);
  assert.match(api.stdout, /\|api path=src\/index\.ts lineRange=1:1\b/u);
  assert.match(api.stdout, /\bkind=api\b/u);
  assert.match(api.stdout, /\bapiKind=function\b/u);
  assert.match(api.stdout, /\bparams=input:string,strict:boolean\b/u);
  assert.match(api.stdout, /\breason=api-return-shape\b/u);
  assert.match(api.stdout, /\breturns=object\b/u);
  assert.match(api.stdout, /\bfields=status,strict\b/u);

  const externalApi = runCliCapture(
    ["search", "api", "react@18.0.0::jsx", "--workspace", "."],
    root,
  );
  assert.equal(externalApi.exitCode, 0);
  assert.match(externalApi.stdout, /^\[search-api\] /u);
  assert.match(externalApi.stdout, /\bsource=external-provider-missing\b/u);
  assert.match(externalApi.stdout, /external docs\/API provider/u);

  const docs = runCliCapture(["search", "docs", "searchSynthesis", "--workspace", "."], root);
  assert.equal(docs.exitCode, 0);
  assert.match(docs.stdout, /^\[search-docs\] /u);
  assert.match(docs.stdout, /\bsurface=schema-json\b/u);
  assert.match(docs.stdout, /\|hit path=schemas\/semantic-search-packet\.v1\.schema\.json/u);
  assert.match(docs.stdout, /\breason=schema-contract\b/u);
  assert.match(docs.stdout, /\bsource=schema-json\b/u);
  assert.match(docs.stdout, /\bpointer=.*searchSynthesis/u);

  const callsite = runCliCapture(
    ["search", "callsite", "findOrderStatus", "--workspace", "."],
    root,
  );
  assert.equal(callsite.exitCode, 0);
  assert.match(callsite.stdout, /^\[search-callsite\] /u);
  assert.match(callsite.stdout, /\|hit path=src\/consumer\.ts lineRange=1:1\b/u);
  assert.match(callsite.stdout, /reason=import-owner/u);

  const imports = runCliCapture(["search", "import", "./index", "--workspace", "."], root);
  assert.equal(imports.exitCode, 0);
  assert.match(imports.stdout, /^\[search-import\] /u);
  assert.match(imports.stdout, /\|hit path=src\/consumer\.ts lineRange=1:1\b/u);
  assert.match(imports.stdout, /\|edge O:src\/consumer\.ts -import-> O:src\/index\.ts/u);

  const tests = runCliCapture(["search", "tests", "src/index.ts", "--workspace", "."], root);
  assert.equal(tests.exitCode, 0);
  assert.match(tests.stdout, /^\[search-tests\] /u);
  assert.match(tests.stdout, /\|hit path=tests\/index\.test\.ts lineRange=1:1\b/u);
  assert.match(tests.stdout, /\|edge O:src\/index\.ts -test-> T:tests\/index\.test\.ts/u);

  const transitiveTestsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ts-transitive-tests-"));
  fs.mkdirSync(path.join(transitiveTestsRoot, "src", "cli"), { recursive: true });
  fs.mkdirSync(path.join(transitiveTestsRoot, "tests", "unit"), { recursive: true });
  fs.writeFileSync(
    path.join(transitiveTestsRoot, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts", "tests/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(transitiveTestsRoot, "src", "cli", "agent-hooks.ts"),
    "export function runCodexAgentHook(): string { return 'ok'; }\n",
  );
  fs.writeFileSync(
    path.join(transitiveTestsRoot, "src", "cli", "protocol.ts"),
    'import { runCodexAgentHook } from "./agent-hooks.js";\nexport function runProtocolCli(): string { return runCodexAgentHook(); }\n',
  );
  fs.writeFileSync(
    path.join(transitiveTestsRoot, "src", "cli", "main.ts"),
    'import { runProtocolCli } from "./protocol.js";\nexport const runCli = runProtocolCli;\n',
  );
  fs.writeFileSync(
    path.join(transitiveTestsRoot, "tests", "unit", "cli.test.ts"),
    'import { runCli } from "../../src/cli/main.js";\nrunCli();\n',
  );
  const transitiveTests = runCliCapture(
    ["search", "tests", "src/cli/agent-hooks.ts", "--workspace", "."],
    transitiveTestsRoot,
  );
  assert.equal(transitiveTests.exitCode, 0);
  assert.match(transitiveTests.stdout, /\|hit path=tests\/unit\/cli\.test\.ts lineRange=1:1\b/u);
  assert.match(
    transitiveTests.stdout,
    /\|edge O:src\/cli\/agent-hooks\.ts -test-> T:tests\/unit\/cli\.test\.ts .*match=transitive-import/u,
  );

  const ownerSeeds = runCliCapture(
    ["search", "owner", "src/index.ts", "--view", "seeds", "--workspace", "."],
    root,
  );
  assert.equal(ownerSeeds.exitCode, 0);
  assert.match(ownerSeeds.stdout, /^\[search-owner\] /u);
  assert.match(ownerSeeds.stdout, /O=owner:path\(src\/index\.ts\)!owner/u);
  assert.match(ownerSeeds.stdout, /rank=O frontier=O\.owner/u);
  assert.match(
    ownerSeeds.stdout,
    /entries=owner-tests\(O=>covering-tests\+test-entrypoints\+fixtures\)/u,
  );
  assert.doesNotMatch(ownerSeeds.stdout, /\|owner |\|synthesis |\|seed /u);
  assert.doesNotMatch(ownerSeeds.stdout, /\|edge /u);

  fs.writeFileSync(
    path.join(root, "src", "protocol-types.ts"),
    [
      "/** Protocol item fixture for owner item search tests. */",
      "export const MAX_PACKET_ITEMS = 8;",
      "export interface SearchPacket { readonly owners: readonly SearchOwner[]; }",
      "export type SearchOwner = { readonly path: string };",
      "export function buildPacket(): SearchPacket { return { owners: [] }; }",
    ].join("\n"),
  );

  const ownerItemsText = runCliCapture(
    ["search", "owner", "src/protocol-types.ts", "items", "--workspace", "."],
    root,
  );
  assert.equal(ownerItemsText.exitCode, 0);
  assert.match(ownerItemsText.stdout, /^\[search-owner\] /u);
  assert.match(ownerItemsText.stdout, /\bpipes=items\b/u);
  assert.match(
    ownerItemsText.stdout,
    /\|item interface SearchPacket lineRange=3:3 .*typeOnly=true/u,
  );
  assert.match(ownerItemsText.stdout, /\|item type SearchOwner lineRange=4:4 .*typeOnly=true/u);
  assert.match(
    ownerItemsText.stdout,
    /\|item function buildPacket lineRange=5:5 .*typeOnly=false/u,
  );
  assert.match(
    ownerItemsText.stdout,
    /\|item variable MAX_PACKET_ITEMS lineRange=2:2 .*typeOnly=false/u,
  );
  assert.ok(
    ownerItemsText.stdout.indexOf("|item interface SearchPacket") <
      ownerItemsText.stdout.indexOf("|item variable MAX_PACKET_ITEMS"),
  );
  assert.doesNotMatch(ownerItemsText.stdout, /\|edge /u);

  const ownerItemsSeeds = runCliCapture(
    ["search", "owner", "src/protocol-types.ts", "items", "--view", "seeds", "--workspace", "."],
    root,
  );
  assert.equal(ownerItemsSeeds.exitCode, 0);
  assert.match(ownerItemsSeeds.stdout, /^\[search-owner\] /u);
  assert.match(ownerItemsSeeds.stdout, /\bq=src\/protocol-types\.ts\b/u);
  assert.match(ownerItemsSeeds.stdout, /I=item:symbol\(SearchPacket\)(?:@[^!]+)?!(?:code|syntax)/u);
  assert.match(
    ownerItemsSeeds.stdout,
    /I\d*=item:symbol\(buildPacket\)(?:@[^!]+)?!(?:code|syntax)/u,
  );
  assert.match(ownerItemsSeeds.stdout, /frontier=.*I\.(?:code|syntax)/u);
  assert.doesNotMatch(ownerItemsSeeds.stdout, /^\|item /u);

  const ownerItemsJson = runCliCapture(
    ["search", "owner", "src/protocol-types.ts", "items", "--json", "--workspace", "."],
    root,
  );
  assert.equal(ownerItemsJson.exitCode, 0);
  const ownerItemsPacket = JSON.parse(ownerItemsJson.stdout) as {
    readonly items?: readonly {
      readonly name: string;
      readonly kind: string;
      readonly ownerPath: string;
      readonly fields: {
        readonly exported?: boolean;
        readonly exportKind?: string;
        readonly structuralSelector?: string;
      };
    }[];
  };
  assert.deepEqual(
    ownerItemsPacket.items?.map((item) => [item.kind, item.name]),
    [
      ["interface", "SearchPacket"],
      ["type", "SearchOwner"],
      ["function", "buildPacket"],
      ["variable", "MAX_PACKET_ITEMS"],
    ],
  );
  assert.equal(ownerItemsPacket.items?.[0]?.ownerPath, "src/protocol-types.ts");
  assert.equal(ownerItemsPacket.items?.[0]?.fields.exported, true);
  assert.equal(
    ownerItemsPacket.items?.[0]?.fields.structuralSelector,
    "typescript://src/protocol-types.ts#item/interface/SearchPacket",
  );

  const parserVisibleTestOwner = runCliCapture(
    ["search", "owner", "tests/index.test.ts", "--workspace", "."],
    root,
  );
  assert.equal(parserVisibleTestOwner.exitCode, 0);
  assert.match(parserVisibleTestOwner.stdout, /^\[search-owner\] /u);
  assert.match(parserVisibleTestOwner.stdout, /\brole=test\b/u);
  assert.match(parserVisibleTestOwner.stdout, /\|owner tests\/index\.test\.ts/u);
  assert.match(parserVisibleTestOwner.stdout, /\bsource=parser-visible-module\b/u);
  assert.match(parserVisibleTestOwner.stdout, /\bparserOwner=false\b/u);
  assert.match(parserVisibleTestOwner.stdout, /\bvalid=true\b/u);
  assert.match(
    parserVisibleTestOwner.stdout,
    /module is parser-visible but not a reasoning owner/u,
  );
  assert.match(parserVisibleTestOwner.stdout, /\|next .*tests:tests\/index\.test\.ts/u);
  assert.doesNotMatch(parserVisibleTestOwner.stdout, /\|next ingest:tests\/index\.test\.ts/u);

  const pathOnlyOwner = runCliCapture(
    ["search", "owner", "test-fixtures/semantic_search_schema.test.ts", "--workspace", "."],
    root,
  );
  assert.equal(pathOnlyOwner.exitCode, 0);
  assert.match(pathOnlyOwner.stdout, /^\[search-owner\] /u);
  assert.match(pathOnlyOwner.stdout, /\brole=test\b/u);
  assert.match(pathOnlyOwner.stdout, /\|owner test-fixtures\/semantic_search_schema\.test\.ts/u);
  assert.match(pathOnlyOwner.stdout, /\bsource=path-only\b/u);
  assert.match(pathOnlyOwner.stdout, /\bparserOwner=false\b/u);
  assert.match(
    pathOnlyOwner.stdout,
    /\|next ingest:test-fixtures\/semantic_search_schema\.test\.ts/u,
  );
  assert.match(pathOnlyOwner.stdout, /path exists but is not parser-visible/u);

  const pathOnlyOwnerJson = runCliCapture(
    [
      "search",
      "owner",
      "test-fixtures/semantic_search_schema.test.ts",
      "--json",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(pathOnlyOwnerJson.exitCode, 0);
  const pathOnlyOwnerPacket = JSON.parse(pathOnlyOwnerJson.stdout) as {
    readonly owners: readonly {
      readonly path: string;
      readonly role: string;
      readonly fields: { readonly source?: string; readonly parserOwner?: boolean };
    }[];
    readonly nextActions: readonly { readonly kind: string; readonly target: string }[];
  };
  assert.equal(pathOnlyOwnerPacket.owners[0]?.path, "test-fixtures/semantic_search_schema.test.ts");
  assert.equal(pathOnlyOwnerPacket.owners[0]?.role, "test");
  assert.equal(pathOnlyOwnerPacket.owners[0]?.fields.source, "path-only");
  assert.equal(pathOnlyOwnerPacket.owners[0]?.fields.parserOwner, false);
  assert.deepEqual(pathOnlyOwnerPacket.nextActions, [
    { kind: "ingest", target: "test-fixtures/semantic_search_schema.test.ts" },
  ]);

  const textMiss = runCliCapture(
    ["search", "lexical", "semantic-search-packet", "--workspace", "."],
    root,
  );
  assert.equal(textMiss.exitCode, 0);
  assert.match(
    textMiss.stdout,
    /^\[search-lexical\] q=semantic-search-packet mode=fuzzy backend=provider own=0 hit=0/u,
  );
  assert.match(textMiss.stdout, /pipe rg output to search ingest/u);
  assert.match(textMiss.stdout, /\|next ingest:semantic-search-packet/u);

  const ingest = runCliCapture(
    ["search", "ingest", "--workspace", "."],
    root,
    "src/index.ts:1:findOrderStatus\n",
  );
  assert.equal(ingest.exitCode, 0);
  assert.match(ingest.stdout, /^\[search-ingest\] src=rg-n/u);
  assert.match(ingest.stdout, /\|hit path=src\/index\.ts lineRange=1:1\b/u);

  const recencyIngest = runCliCapture(
    ["search", "ingest", "--workspace", "."],
    root,
    "src/a-old.ts:2:sharedMtimeNeedle\nsrc/z-new.ts:2:sharedMtimeNeedle\n",
  );
  assert.equal(recencyIngest.exitCode, 0);
  assert.ok(
    recencyIngest.stdout.indexOf("|hit path=src/z-new.ts lineRange=2:2") <
      recencyIngest.stdout.indexOf("|hit path=src/a-old.ts lineRange=2:2"),
    recencyIngest.stdout,
  );

  const check = runCliCapture(["check", "--changed", "."], root);
  assert.equal(check.exitCode, 0);
  assert.match(check.stdout, /^\[ok\] typescript/u);

  const doctor = runCliCapture(["agent", "doctor", "."], root);
  assert.equal(doctor.exitCode, 0);
  assert.match(
    doctor.stdout,
    /^\[agent-doctor\] status=ok protocol=agent\.semantic-protocols\.semantic-language/u,
  );
  assert.match(doctor.stdout, /\|language id=typescript provider=ts-harness binary=ts-harness/u);
  assert.match(
    doctor.stdout,
    /\|namespace agent\.semantic-protocols\.languages\.typescript\.ts-harness/u,
  );
  assert.match(doctor.stdout, /\|method search\/workspace,search\/prime,/u);

  const doctorJson = runCliCapture(["agent", "doctor", "--json", "."], root);
  assert.equal(doctorJson.exitCode, 0);
  const doctorPayload = JSON.parse(doctorJson.stdout) as {
    readonly schemaId: string;
    readonly schemaVersion: string;
    readonly schemaAuthority: string;
    readonly protocolId: string;
    readonly protocolVersion: string;
    readonly languageId: string;
    readonly providerId: string;
    readonly binary: string;
    readonly execution: string;
    readonly registrySchemaId: string;
    readonly registrySchemaVersion: string;
    readonly registryDigest: string;
    readonly registry: {
      readonly registryId: string;
      readonly protocolId: string;
      readonly languages: readonly {
        readonly languageId: string;
        readonly providerId: string;
        readonly binary: string;
        readonly namespace: string;
        readonly methods: readonly string[];
        readonly methodDescriptors: readonly {
          readonly method: string;
          readonly command: string;
          readonly view?: string;
          readonly outputSchemaIds?: readonly string[];
          readonly requiresQuery?: boolean;
          readonly acceptsStdin?: boolean;
          readonly supportsPackageScope?: boolean;
          readonly acceptedPipes?: readonly string[];
          readonly capabilities?: readonly {
            readonly languageId: string;
            readonly namespace: string;
            readonly name: string;
          }[];
          readonly ingestRequiredFor?: readonly {
            readonly languageId: string;
            readonly namespace: string;
            readonly name: string;
          }[];
          readonly clients?: readonly string[];
          readonly requiredOptions?: readonly string[];
          readonly input?: string;
          readonly outputModes?: readonly string[];
          readonly supportsJson: boolean;
          readonly supportsCompact: boolean;
        }[];
      }[];
    };
  };
  const registry = doctorPayload.registry;
  assert.equal(doctorPayload.schemaId, "agent.semantic-protocols.semantic-provider-doctor");
  assert.equal(doctorPayload.schemaVersion, "1");
  assert.equal(
    doctorPayload.schemaAuthority,
    "https://tao3k.github.io/agent-semantic-protocols/schemas/",
  );
  assert.equal(
    doctorPayload.registrySchemaId,
    "agent.semantic-protocols.semantic-language-registry",
  );
  assert.equal(doctorPayload.registrySchemaVersion, "1");
  assert.match(doctorPayload.registryDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(registry.registryId, "agent.semantic-protocols.semantic-language-registry");
  assert.equal(registry.protocolId, "agent.semantic-protocols.semantic-language");
  const expectedMethods = [
    "search/workspace",
    "search/prime",
    "search/owner",
    "search/dependency",
    "search/deps",
    "search/docs",
    "search/api",
    "search/public-external-types",
    "search/policy",
    "search/symbol",
    "search/callsite",
    "search/import",
    "search/tests",
    "search/lexical",
    "search/reasoning",
    "search/env",
    "search/runtime-source",
    "search/lang",
    "search/std",
    "search/capability",
    "search/extension",
    "search/pattern",
    "search/compare",
    "search/semantic-facts",
    "search/ingest",
    "query",
    "check/changed",
    "check/full",
    "ast-patch/dry-run",
    "evidence/graph",
    "evidence/analyze",
    "agent/doctor",
    "agent/guide",
  ];
  const providerRegistration = registry.languages[0] as unknown as Record<string, unknown> & {
    readonly methodDescriptors: readonly (Record<string, unknown> & {
      readonly invocation?: { readonly argv: readonly string[] };
    })[];
    readonly queryPackDescriptor: {
      readonly descriptorId: string;
      readonly descriptorVersion: string;
      readonly languageId: string;
      readonly recipes: readonly unknown[];
    };
  };
  assert.equal(providerRegistration.methodDescriptors.length, expectedMethods.length);
  assert.equal(
    providerRegistration.methodDescriptors.every(
      (descriptor) => descriptor.invocation?.argv[0] === "ts-harness",
    ),
    true,
  );
  assert.deepEqual(
    {
      descriptorId: providerRegistration.queryPackDescriptor.descriptorId,
      descriptorVersion: providerRegistration.queryPackDescriptor.descriptorVersion,
      languageId: providerRegistration.queryPackDescriptor.languageId,
      recipeCount: providerRegistration.queryPackDescriptor.recipes.length,
    },
    {
      descriptorId: "typescript.query-pack",
      descriptorVersion: "1",
      languageId: "typescript",
      recipeCount: 3,
    },
  );
  const { queryPackDescriptor: _queryPackDescriptor, ...providerWithoutQueryPack } =
    providerRegistration;
  assert.deepEqual(
    {
      ...providerWithoutQueryPack,
      methodDescriptors: providerRegistration.methodDescriptors.map(
        ({ invocation: _invocation, ...descriptor }) => descriptor,
      ),
    },
    {
      languageId: "typescript",
      providerId: "ts-harness",
      binary: "ts-harness",
      namespace: "agent.semantic-protocols.languages.typescript.ts-harness",
      displayName: "TypeScript",
      methods: expectedMethods,
      methodDescriptors: [
        ...expectedMethods
          .filter((method) => method.startsWith("search/"))
          .map((method) => ({
            method,
            command: "search",
            view: method.slice("search/".length),
            outputSchemaIds:
              method === "search/public-external-types"
                ? [
                    "agent.semantic-protocols.semantic-search-packet",
                    "agent.semantic-protocols.semantic-type-surface",
                  ]
                : method === "search/policy"
                  ? [
                      "agent.semantic-protocols.semantic-search-packet",
                      "agent.semantic-protocols.semantic-handle",
                    ]
                  : method === "search/semantic-facts"
                    ? ["agent.semantic-protocols.semantic-fact-graph"]
                    : ["agent.semantic-protocols.semantic-search-packet"],
            requiresQuery: [
              "search/owner",
              "search/dependency",
              "search/deps",
              "search/docs",
              "search/api",
              "search/public-external-types",
              "search/policy",
              "search/symbol",
              "search/callsite",
              "search/import",
              "search/tests",
              "search/lexical",
              "search/reasoning",
              "search/extension",
              "search/pattern",
              "search/compare",
              "search/semantic-facts",
            ].includes(method),
            acceptsStdin: method === "search/ingest" || method === "search/semantic-facts",
            supportsPackageScope: true,
            benchmarkInvocation: expectedSearchBenchmarkInvocation(method.slice("search/".length)),
            ...(method === "search/lexical" || method === "search/policy"
              ? { acceptedPipes: ["owner", "tests"] }
              : method === "search/owner"
                ? { acceptedPipes: ["items"] }
                : method === "search/ingest"
                  ? { acceptedPipes: ["items", "tests"] }
                  : {}),
            ...(method === "search/owner"
              ? {
                  fallbacks: [
                    {
                      name: "owner-top-items",
                      trigger: "item-query-miss",
                      appliesToPipes: ["items"],
                      maxItems: 4,
                    },
                  ],
                  packetSchemas: ["semantic-search-packet.v1", "semantic-tree-sitter-query.v1"],
                  grammarId: "tree-sitter-typescript",
                  input: "search owner <path> [items] [--query <symbol-or-a|b|c>]",
                  outputModes: ["frontier", "json"],
                }
              : {}),
            ...(method === "search/lexical"
              ? {
                  supportsQuerySet: true,
                  acceptedQuerySetSelectors: [
                    method === "search/lexical" ? "lexical-set" : "exact-set",
                  ],
                  querySetScopes: ["project", "owner"],
                  clients: ["semantic-agent-hook"],
                  input:
                    method === "search/lexical"
                      ? "search lexical <query> [owner|tests...] or --query-set TERM [--query-set TERM...]"
                      : "search lexical <query> [owner|tests...] or hook query with --from-hook, --selector, --term, and --surface",
                }
              : {}),
            ...(method === "search/policy"
              ? { input: "search policy <rule-id-or-alias> [owner tests]" }
              : {}),
            ...(method === "search/semantic-facts"
              ? {
                  clients: ["asp-graph-turbo"],
                  input: "search semantic-facts <query>",
                  packetSchemas: ["semantic-fact-graph.v1", "semantic-fact-ontology.v1"],
                  outputModes: ["json"],
                }
              : {}),
            capabilities: expectedSearchCapabilities(method),
            ...(expectedSearchIngestRequiredFor(method).length === 0
              ? {}
              : { ingestRequiredFor: expectedSearchIngestRequiredFor(method) }),
            supportsJson: true,
            supportsCompact: method === "search/semantic-facts" ? false : true,
          })),
        {
          method: "query",
          command: "query",
          input: "tree-sitter-compatible syntax query",
          requiredOptions: ["--catalog|--treesitter-query"],
          outputSchemaIds: ["agent.semantic-protocols.semantic-tree-sitter-query"],
          packetSchemas: ["semantic-tree-sitter-query.v1"],
          queryInputForms: ["catalog-id", "s-expression"],
          executionBackends: ["native-parser"],
          sourceAuthorities: ["native-parser-adapter", "native-parser"],
          adapterModes: ["native-projection"],
          renderProfiles: ["corpus-locator"],
          queryCatalogs: [
            {
              id: "declarations",
              path: "tree-sitter/tree-sitter-typescript/queries/declarations.scm",
              sourceDelivery: "provider-binary-embedded",
              captures: [
                "function.definition",
                "function.name",
                "class.definition",
                "class.name",
                "interface.definition",
                "interface.name",
                "type.definition",
                "type.name",
                "enum.definition",
                "enum.name",
                "variable.definition",
                "variable.name",
                "import.declaration",
                "import.source",
                "export.declaration",
              ],
              nodeTypes: [
                "function_declaration",
                "class_declaration",
                "interface_declaration",
                "type_alias_declaration",
                "enum_declaration",
                "lexical_declaration",
                "variable_declarator",
                "import_statement",
                "export_statement",
              ],
              fields: ["name", "source"],
            },
            {
              id: "imports",
              path: "tree-sitter/tree-sitter-typescript/queries/imports.scm",
              sourceDelivery: "provider-binary-embedded",
              captures: [
                "import.declaration",
                "import.source",
                "export.declaration",
                "export.source",
              ],
              nodeTypes: ["import_statement", "export_statement"],
              fields: ["source"],
            },
            {
              id: "calls",
              path: "tree-sitter/tree-sitter-typescript/queries/calls.scm",
              sourceDelivery: "provider-binary-embedded",
              captures: ["call.expression", "call.target"],
              nodeTypes: ["call_expression"],
              fields: ["function"],
            },
          ],
          grammarId: "tree-sitter-typescript",
          grammarProfileVersion: "2026-06-05.v1",
          grammarProfileSchema: "semantic-tree-sitter-grammar-profile.v1",
          grammarProfilePath: "tree-sitter/tree-sitter-typescript/grammar-profile.json",
          supportedPredicates: [
            "#eq?",
            "#any-eq?",
            "#any-of?",
            "#match?",
            "#any-match?",
            "#not-eq?",
            "#not-match?",
          ],
          unsupportedPredicates: [],
          cacheReplay: true,
          supportsJson: true,
          supportsCompact: true,
          outputModes: ["frontier", "json"],
          unsupportedPatternBehavior: "diagnostic",
        },
        ...expectedMethods
          .filter((method) => method.startsWith("check/"))
          .map((method) => ({
            method,
            command: "check",
            supportsJson: true,
            supportsCompact: true,
          })),
        {
          method: "ast-patch/dry-run",
          command: "ast-patch",
          input: "semantic-ast-patch packet",
          requiredOptions: ["--packet"],
          outputSchemaIds: ["agent.semantic-protocols.semantic-ast-patch-receipt"],
          mutationAvailable: false,
          supportsJson: true,
          supportsCompact: false,
        },
        {
          method: "evidence/graph",
          command: "evidence",
          input: "provider project root",
          outputSchemaIds: ["agent.semantic-protocols.semantic-evidence-graph"],
          supportsJson: true,
          supportsCompact: true,
        },
        {
          method: "evidence/analyze",
          command: "evidence",
          input: "provider project root",
          outputSchemaIds: ["agent.semantic-protocols.semantic-graph-turbo-request"],
          packetSchemas: ["semantic-graph-turbo-request.v1"],
          clients: ["asp-graph-turbo"],
          supportsJson: true,
          supportsCompact: true,
        },
        {
          method: "agent/doctor",
          command: "agent",
          outputSchemaIds: ["agent.semantic-protocols.semantic-provider-doctor"],
          supportsJson: true,
          supportsCompact: true,
        },
        {
          method: "agent/guide",
          command: "agent",
          supportsJson: false,
          supportsCompact: true,
        },
      ],
      schemas: [
        {
          schemaId: "agent.semantic-protocols.semantic-search-packet",
          schemaVersion: "1",
          path: "schemas/semantic-search-packet.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-query-packet",
          schemaVersion: "1",
          path: "schemas/semantic-query-packet.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-read-packet",
          schemaVersion: "1",
          path: "schemas/semantic-read-packet.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-source-location",
          schemaVersion: "1",
          path: "schemas/semantic-source-location.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-tree-sitter-provenance",
          schemaVersion: "1",
          path: "schemas/semantic-tree-sitter-provenance.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-tree-sitter-query",
          schemaVersion: "1",
          path: "schemas/semantic-tree-sitter-query.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-tree-sitter-grammar-profile",
          schemaVersion: "1",
          path: "schemas/semantic-tree-sitter-grammar-profile.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-graph",
          schemaVersion: "1",
          path: "schemas/semantic-graph.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-graph-turbo-request",
          schemaVersion: "1",
          path: "schemas/semantic-graph-turbo-request.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-fact-graph",
          schemaVersion: "1",
          path: "schemas/semantic-fact-graph.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-fact-ontology",
          schemaVersion: "1",
          path: "schemas/semantic-fact-ontology.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-verification-receipt",
          schemaVersion: "1",
          path: "schemas/semantic-verification-receipt.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-behavior-snapshot",
          schemaVersion: "1",
          path: "schemas/semantic-behavior-snapshot.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-determinism-readiness",
          schemaVersion: "1",
          path: "schemas/semantic-determinism-readiness.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.dev-command-log",
          schemaVersion: "1",
          path: "schemas/semantic-dev-command-log.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-formal-proof-pilot",
          schemaVersion: "1",
          path: "schemas/semantic-formal-proof-pilot.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-review-packet",
          schemaVersion: "1",
          path: "schemas/semantic-review-packet.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-evidence-graph",
          schemaVersion: "1",
          path: "schemas/semantic-evidence-graph.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-assurance-case",
          schemaVersion: "1",
          path: "schemas/semantic-assurance-case.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-ast-patch",
          schemaVersion: "1",
          path: "schemas/semantic-ast-patch.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-ast-patch-receipt",
          schemaVersion: "1",
          path: "schemas/semantic-ast-patch-receipt.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-type-surface",
          schemaVersion: "1",
          path: "schemas/semantic-type-surface.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-handle",
          schemaVersion: "1",
          path: "schemas/semantic-handle.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-language-registry",
          schemaVersion: "1",
          path: "schemas/semantic-language-registry.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.semantic-provider-doctor",
          schemaVersion: "1",
          path: "schemas/semantic-provider-doctor.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.provider-query-pack-descriptor",
          schemaVersion: "1",
          path: "schemas/provider-query-pack-descriptor.v1.schema.json",
        },
        {
          schemaId: "agent.semantic-protocols.languages.typescript.ts-harness.capabilities",
          schemaVersion: "1",
          path: "schemas/typescript-semantic-capabilities.v1.schema.json",
        },
      ],
    },
  );

  const unknownProtocolCommand = runCliCapture(["agent-client", "doctor", "."], root);
  assert.equal(unknownProtocolCommand.exitCode, 2);
  assert.match(unknownProtocolCommand.stderr, /unknown command: agent-client/u);
});

function expectedSearchCapabilities(
  method: string,
): readonly { readonly languageId: string; readonly namespace: string; readonly name: string }[] {
  switch (method) {
    case "search/workspace":
      return [semanticCapability("workspace-router")];
    case "search/prime":
      return [semanticCapability("package-prime-map")];
    case "search/owner":
      return [
        semanticCapability("reasoning-owner-search"),
        typeScriptCapability("parser-visible-module-owner-search"),
        typeScriptCapability("test-owner-search"),
        semanticCapability("path-owner-fallback"),
        typeScriptCapability("owner-item-query"),
        typeScriptCapability("owner-top-items-fallback"),
      ];
    case "search/dependency":
      return [
        semanticCapability("dependency-manifest-search"),
        typeScriptCapability("dependency-local-usage-search"),
      ];
    case "search/deps":
      return [
        semanticCapability("dependency-manifest-search"),
        typeScriptCapability("dependency-local-usage-search"),
        semanticCapability("dependency-version-scope"),
        typeScriptCapability("dependency-api-token-usage-search"),
      ];
    case "search/docs":
      return [
        semanticCapability("local-docs-search"),
        semanticCapability("schema-contract-search"),
        typeScriptCapability("local-semantic-schema-search"),
      ];
    case "search/api":
      return [
        typeScriptCapability("exported-api-shape-search"),
        typeScriptCapability("public-function-api-shape-search"),
        typeScriptCapability("public-data-api-shape-search"),
        semanticCapability("dependency-version-scope"),
      ];
    case "search/public-external-types":
      return [
        semanticCapability("dependency-manifest-search"),
        typeScriptCapability("public-external-type-search"),
        typeScriptCapability("public-api-type-text-search"),
      ];
    case "search/policy":
      return [
        semanticCapability("policy-rule-handle-search"),
        typeScriptCapability("typescript-project-policy-rule-handle-search"),
        typeScriptCapability("typescript-agent-policy-rule-handle-search"),
        typeScriptCapability("typescript-extension-policy-rule-handle-search"),
      ];
    case "search/symbol":
      return [typeScriptCapability("symbol-export-search")];
    case "search/callsite":
      return [typeScriptCapability("owner-callsite-search")];
    case "search/import":
      return [typeScriptCapability("import-edge-search")];
    case "search/tests":
      return [typeScriptCapability("test-owner-search")];
    case "search/lexical":
      return [
        semanticCapability("dynamic-lexical-overlay-search"),
        typeScriptCapability("parser-visible-module-owner-search"),
        typeScriptCapability("test-owner-search"),
      ];
    case "search/reasoning":
      return [
        semanticCapability("reasoning-owner-search"),
        semanticCapability("dependency-manifest-search"),
        typeScriptCapability("owner-item-query"),
        typeScriptCapability("test-owner-search"),
        typeScriptCapability("dependency-local-usage-search"),
      ];
    case "search/env":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-project-environment-facts"),
      ];
    case "search/runtime-source":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-runtime-source-frontier"),
      ];
    case "search/lang":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-language-semantics-facts"),
      ];
    case "search/std":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-standard-api-facts"),
      ];
    case "search/capability":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-provider-capability-facts"),
      ];
    case "search/extension":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-ecosystem-extension-facts"),
      ];
    case "search/pattern":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-executable-pattern-facts"),
      ];
    case "search/compare":
      return [
        semanticCapability("provider-knowledge-axis"),
        typeScriptCapability("typescript-semantic-comparison-facts"),
      ];
    case "search/semantic-facts":
      return [
        semanticCapability("graph-turbo-provider-facts"),
        typeScriptCapability("typescript-ast-field-type-collection-facts"),
      ];
    case "search/ingest":
      return [
        semanticCapability("external-candidate-ingest"),
        semanticCapability("stdin-shape-detection"),
        semanticCapability("owner-grouped-ingest"),
      ];
    default:
      return [];
  }
}

function expectedSearchIngestRequiredFor(
  method: string,
): readonly { readonly languageId: string; readonly namespace: string; readonly name: string }[] {
  switch (method) {
    case "search/owner":
      return [typeScriptCapability("non-parser-path")];
    case "search/lexical":
      return [typeScriptCapability("non-parser-path")];
    case "search/docs":
      return [typeScriptCapability("external-docs")];
    case "search/api":
      return [typeScriptCapability("external-api-docs")];
    default:
      return [];
  }
}

function expectedSearchBenchmarkInvocation(view: string): {
  readonly args: readonly string[];
  readonly stdinTemplate?: string;
  readonly expectsJson: boolean;
  readonly maxElapsedMs: number;
} {
  const workspace = ["--workspace", "{workspace}"] as const;
  const seeds = [...workspace, "--view", "seeds"] as const;
  const invocation = (args: readonly string[]) => ({
    args,
    expectsJson: false,
    maxElapsedMs: 15_000,
  });

  switch (view) {
    case "owner":
      return invocation(["search", "owner", "{owner}", "items", "--query", "{query}", ...seeds]);
    case "lexical":
      return invocation([
        "search",
        "lexical",
        "--query",
        "{query}",
        "--query",
        "{dependency}",
        ...seeds,
      ]);
    case "dependency":
    case "deps":
      return invocation(["search", view, "{dependency}", ...seeds]);
    case "tests":
      return invocation(["search", "tests", "{owner}", ...seeds]);
    case "reasoning":
      return invocation([
        "search",
        "reasoning",
        "query-deps",
        "--query",
        "{query}",
        "--dependency",
        "{dependency}",
        ...seeds,
      ]);
    case "ingest":
      return {
        args: ["search", "ingest", ...seeds],
        stdinTemplate: "{owner}:1:{query}\\n",
        expectsJson: false,
        maxElapsedMs: 15_000,
      };
    case "semantic-facts":
      return {
        args: ["search", "semantic-facts", "{query}", ...workspace, "--json"],
        stdinTemplate: "{owner}:1:{query}\n",
        expectsJson: true,
        maxElapsedMs: 15_000,
      };
    case "extension":
    case "public-external-types":
      return invocation(["search", view, "{dependency}", ...seeds]);
    case "api":
    case "callsite":
    case "compare":
    case "docs":
    case "import":
    case "pattern":
    case "policy":
    case "symbol":
      return invocation(["search", view, "{query}", ...seeds]);
    default:
      return invocation(["search", view, ...seeds]);
  }
}

function semanticCapability(name: string): {
  readonly languageId: string;
  readonly namespace: string;
  readonly name: string;
} {
  return { languageId: "typescript", namespace: "semantic", name };
}

function typeScriptCapability(name: string): {
  readonly languageId: string;
  readonly namespace: string;
  readonly name: string;
} {
  return { languageId: "typescript", namespace: "typescript", name };
}
