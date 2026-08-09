import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultTypeScriptHarnessConfig,
  parseTypeScriptProjectFiles,
  parseTypeScriptSourceFile,
  readProjectResolution,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("parser extracts native import and export facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-"));
  const sourcePath = path.join(root, "module.ts");
  fs.writeFileSync(
    sourcePath,
    [
      'import { readFile } from "node:fs";',
      'import type { Stats } from "node:fs";',
      'import { type Dirent } from "node:fs";',
      'import { type BigIntStats, readFileSync } from "node:fs";',
      'export { writeFile } from "node:fs";',
      'export type { Stats } from "node:fs";',
      'export { type Dirent } from "node:fs";',
      'export { type BigIntStats, writeFileSync } from "node:fs";',
      'export * as fsRuntime from "node:fs";',
      'export type * as fsTypes from "node:fs";',
      "type Lazy = import('./lazy-type.js').Lazy;",
      "export interface User { id: string }",
      "export const answer = 42;",
      "export { answer as localAnswer };",
      'void import("./lazy.js");',
    ].join("\n"),
  );

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.equal(report.isValid, true);
  assert.deepEqual(
    report.imports.map(
      (importFact) =>
        `${importFact.isTypeOnly ? "type-" : ""}${importFact.kind}:${importFact.moduleSpecifier}`,
    ),
    [
      "import:node:fs",
      "type-import:node:fs",
      "type-import:node:fs",
      "import:node:fs",
      "export:node:fs",
      "type-export:node:fs",
      "type-export:node:fs",
      "export:node:fs",
      "export:node:fs",
      "type-export:node:fs",
      "type-import:./lazy-type.js",
      "dynamic-import:./lazy.js",
    ],
  );
  assert.deepEqual(
    report.exports.map(
      (exportFact) =>
        `${exportFact.isTypeOnly ? "type-" : ""}${exportFact.kind}:${exportFact.name}`,
    ),
    [
      "reexport:writeFile",
      "type-reexport:Stats",
      "type-reexport:Dirent",
      "type-reexport:BigIntStats",
      "reexport:writeFileSync",
      "namespace-reexport:fsRuntime",
      "type-namespace-reexport:fsTypes",
      "type-interface:User",
      "variable:answer",
      "export-list:localAnswer",
    ],
  );
});

test("parser extracts declaration-only export assignment facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-dts-"));
  const sourcePath = path.join(root, "module.d.ts");
  fs.writeFileSync(
    sourcePath,
    [
      "export as namespace HarnessGlobal;",
      "export = harness;",
      "declare function harness(): void;",
    ].join("\n"),
  );

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.equal(report.isDeclarationFile, true);
  assert.deepEqual(
    report.exports.map((exportFact) => `${exportFact.kind}:${exportFact.name}`),
    ["global-namespace:HarnessGlobal", "export-assignment:harness"],
  );
});

test("parser reports parser Debug Failure as invalid module", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-debug-failure-"));
  const sourcePath = path.join(root, "decoratorOnAwait.ts");
  fs.writeFileSync(
    sourcePath,
    ["declare function dec<T>(target: T): T;", "", "@dec", "await 1"].join("\n"),
  );

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.equal(report.isValid, false);
  assert.equal(report.diagnostics[0]?.category, "error");
  assert.match(report.diagnostics[0]?.message ?? "", /Debug Failure/u);
});

test("project parser falls back when compiler program hits parser Debug Failure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-project-debug-failure-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@example/debug" }));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ include: ["src/**/*.ts"] }));
  const sourcePath = path.join(root, "src", "decoratorOnAwait.ts");
  fs.writeFileSync(
    sourcePath,
    ["declare function dec<T>(target: T): T;", "", "@dec", "await 1"].join("\n"),
  );
  const okPath = path.join(root, "src", "ok.ts");
  const consumerPath = path.join(root, "src", "consumer.ts");
  fs.writeFileSync(okPath, "export const ok = 1;\n");
  fs.writeFileSync(consumerPath, 'import { ok } from "./ok.js";\nexport const value = ok;\n');

  const scope = readProjectResolution(root, defaultTypeScriptHarnessConfig());
  const reports = parseTypeScriptProjectFiles(scope, [sourcePath, okPath, consumerPath]);

  assert.equal(reports.length, 3);
  const invalidReport = reports.find((report) => report.path === sourcePath);
  assert.equal(invalidReport?.isValid, false);
  assert.match(invalidReport?.diagnostics[0]?.message ?? "", /Debug Failure/u);
  const consumerReport = reports.find((report) => report.path === consumerPath);
  assert.equal(consumerReport?.importResolutions[0]?.resolution, "relative");
  assert.equal(consumerReport?.importResolutions[0]?.resolvedPath, okPath);
});

test("parser handles deeply nested binary expressions without recursive visitor overflow", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-deep-binary-"));
  const sourcePath = path.join(root, "deep.ts");
  const expression = Array.from({ length: 5000 }, (_, index) => `value${index}`).join(" + ");
  fs.writeFileSync(sourcePath, `export const value = ${expression};\n`);

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.equal(report.path, sourcePath);
  assert.equal(report.exports[0]?.name, "value");
});

test("parser extracts native public API and control-flow facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-native-api-"));
  const sourcePath = path.join(root, "api.ts");
  fs.writeFileSync(
    sourcePath,
    [
      "export interface ApiRecord {",
      "  id: string;",
      "  revision: number;",
      "  enabled: boolean;",
      "  status: string;",
      "}",
      "export type OwnerId = string;",
      "export type OwnerState = 'draft' | 'published';",
      "export type Pair = { left: string; right: number };",
      "export type OwnerEvent =",
      "  | { kind: 'created'; ownerId: string; requestId: string; timeoutMs: number }",
      "  | { kind: 'deleted'; ownerId: string; reason: string };",
      "declare namespace Effect {",
      "  export interface Effect<A, E = never, R = never> {}",
      "  export function runPromise<A>(program: Effect<A>): Promise<A>;",
      "  export function promise<A>(thunk: () => Promise<A>): Effect<A>;",
      "  export function acquireRelease<A>(acquire: Effect<A>, release: (a: A) => Effect<void>): Effect<A>;",
      "  export function scoped<A>(program: Effect<A>): Effect<A>;",
      "  export function all<A>(programs: Iterable<Effect<A>>, options?: { concurrency?: number }): Effect<A[]>;",
      "  export function withSpan<A>(name: string): (program: Effect<A>) => Effect<A>;",
      "  export function timeout<A>(duration: string): (program: Effect<A>) => Effect<A>;",
      "  export function Tag(name: string): any;",
      "}",
      "export interface OwnerService {",
      "  load(id: string): Effect.Effect<string, Error, OwnerRepo>;",
      "  save: (id: string) => Effect.Effect<void, never, never>;",
      "}",
      "export type OwnerNotifier = {",
      "  readonly notify: (message: string) => Effect.Effect<void, never, Notifications>",
      "};",
      "export class NotificationsTag extends Effect.Tag('Notifications')<",
      "  NotificationsTag,",
      "  { readonly notify: (message: string) => Effect.Effect<void> }",
      ">() {}",
      "export declare function fetchOwner(): Promise<string>;",
      "export declare function fetchOwnerEffect(): Effect.Effect<string, Error>;",
      "function runOwnerEffect(): Promise<string> {",
      "  return Effect.runPromise(fetchOwnerEffect());",
      "}",
      "declare const acquireOwner: Effect.Effect<string>;",
      "declare const releaseOwner: (owner: string) => Effect.Effect<void>;",
      "export const ownerResource = Effect.acquireRelease(acquireOwner, releaseOwner);",
      "export const scopedOwnerResource = Effect.scoped(",
      "  Effect.acquireRelease(acquireOwner, releaseOwner)",
      ");",
      "export const riskyOwnerEffect = Effect.promise(async () => 'owner');",
      "export const productionOwnerEffect = Effect.tryPromise({",
      "  try: async () => 'owner',",
      "  catch: (cause) => new Error('boom', { cause })",
      "}).pipe(",
      "  Effect.withSpan('owner.production'),",
      "  Effect.timeout('1 second')",
      ");",
      "export async function loadOwners(ids: string[]): Promise<string[]> {",
      "  return Promise.all(ids.map(() => fetchOwner()));",
      "}",
      "export async function loadOwnersSequential(ids: string[]): Promise<string[]> {",
      "  const owners: string[] = [];",
      "  for (const id of ids) {",
      "    owners.push(await fetchOwner());",
      "  }",
      "  return owners;",
      "}",
      "export const loadOwnerEffects = (programs: Effect.Effect<string>[]) => Effect.all(programs);",
      "export const loadOwnerEffectsWithBudget = (programs: Effect.Effect<string>[]) =>",
      "  Effect.all(programs, { concurrency: 2 });",
      "export function viewOwner(id: string): { readonly id: string; readonly state: string } {",
      "  return { id, state: 'ready', ...({ source: 'parser' }) };",
      "}",
      "export function configure(",
      "  id: string,",
      "  dryRun: boolean,",
      "  force: boolean,",
      "  point: [string, number]",
      "): [string, number] {",
      "  if (dryRun) {",
      "    return point;",
      "  }",
      "  return [id, force ? 1 : 0];",
      "}",
    ].join("\n"),
  );

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.deepEqual(
    report.publicFunctionParams
      .filter((param) => param.functionName === "configure")
      .map((param) => ({
        fn: param.functionName,
        name: param.paramName,
        type: param.typeText,
        primitive: param.primitiveContractType,
        flag: param.flagContractType,
      })),
    [
      { fn: "configure", name: "id", type: "string", primitive: "string", flag: undefined },
      { fn: "configure", name: "dryRun", type: "boolean", primitive: "boolean", flag: "boolean" },
      { fn: "configure", name: "force", type: "boolean", primitive: "boolean", flag: "boolean" },
      {
        fn: "configure",
        name: "point",
        type: "[string, number]",
        primitive: undefined,
        flag: undefined,
      },
    ],
  );
  assert.deepEqual(
    report.publicTupleApiSurfaces.map((surface) => ({
      fn: surface.functionName,
      surface: surface.surfaceName,
      elements: surface.elementContractTypes,
    })),
    [
      { fn: "configure", surface: "parameter `point`", elements: ["string", "number"] },
      { fn: "configure", surface: "return value", elements: ["string", "number"] },
    ],
  );
  assert.deepEqual(
    report.publicDataFields.map(
      (field) =>
        `${field.typeKind}:${field.typeName}.${field.fieldName}:${field.primitiveContractType}`,
    ),
    [
      "interface:ApiRecord.id:string",
      "interface:ApiRecord.revision:number",
      "interface:ApiRecord.enabled:boolean",
      "interface:ApiRecord.status:string",
      "type:Pair.left:string",
      "type:Pair.right:number",
    ],
  );
  assert.deepEqual(
    report.publicTypeAliases.map(
      (alias) => `${alias.aliasName}:${alias.targetTypeText}:${alias.primitiveContractType}`,
    ),
    ["OwnerId:string:string", "OwnerState:'draft' | 'published':string-literal"],
  );
  assert.deepEqual(
    report.publicDiscriminatedUnionVariantFields.map(
      (field) =>
        `${field.unionName}:${field.variantName}.${field.fieldName}:${field.primitiveContractType}`,
    ),
    [
      "OwnerEvent:created.ownerId:string",
      "OwnerEvent:created.requestId:string",
      "OwnerEvent:created.timeoutMs:number",
      "OwnerEvent:deleted.ownerId:string",
      "OwnerEvent:deleted.reason:string",
    ],
  );
  assert.deepEqual(
    report.publicFunctionControlFlows
      .filter((flow) => flow.functionName === "configure")
      .map((flow) => ({
        fn: flow.functionName,
        branches: flow.branchCount,
        statements: flow.statementCount,
      })),
    [{ fn: "configure", branches: 2, statements: 3 }],
  );
  assert.deepEqual(
    report.moduleResponsibilities
      .filter((responsibility) =>
        ["ApiRecord", "Pair", "OwnerEvent", "viewOwner", "configure"].includes(responsibility.name),
      )
      .map((responsibility) => `${responsibility.kind}:${responsibility.name}`),
    [
      "interface:ApiRecord",
      "type:Pair",
      "type:OwnerEvent",
      "function:viewOwner",
      "function:configure",
    ],
  );
  assert.deepEqual(
    report.publicReturnObjectShapes.map((shape) => ({
      fn: shape.functionName,
      fields: shape.fields,
      spreads: shape.spreads,
    })),
    [{ fn: "viewOwner", fields: ["id", "state", "source"], spreads: ["source"] }],
  );
  assert.deepEqual(
    report.publicAsyncEffectSurfaces
      .filter(
        (surface) =>
          surface.functionName === "fetchOwner" || surface.functionName === "fetchOwnerEffect",
      )
      .map((surface) => ({
        fn: surface.functionName,
        promise: surface.returnsPromise,
        effect: surface.returnsEffect,
        type: surface.returnTypeText,
        errorKind: surface.errorChannelKind,
      })),
    [
      {
        fn: "fetchOwner",
        promise: true,
        effect: false,
        type: "Promise<string>",
        errorKind: undefined,
      },
      {
        fn: "fetchOwnerEffect",
        promise: false,
        effect: true,
        type: "Effect.Effect<string, Error>",
        errorKind: "domain",
      },
    ],
  );
  assert.deepEqual(
    report.effectRuntimeCalls.map((call) => `${call.callee}:${call.callKind}`),
    ["Effect.runPromise:default-runtime"],
  );
  assert.deepEqual(
    report.effectPromiseInteropRisks.map(
      (risk) => `${risk.ownerName}:${risk.constructorName}:${risk.riskKinds.join("+")}`,
    ),
    ["riskyOwnerEffect:Effect.promise:async-callback"],
  );
  assert.deepEqual(
    report.effectResourceScopeRisks.map((risk) => `${risk.ownerName}:${risk.constructorName}`),
    ["ownerResource:Effect.acquireRelease"],
  );
  assert.deepEqual(
    report.effectConcurrencySignals.map(
      (signal) => `${signal.ownerName}:${signal.signalKind}:${signal.callee}`,
    ),
    [
      "loadOwners:promise-combinator:Promise.all",
      "loadOwnersSequential:sequential-await-loop:for-of-await",
      "loadOwnerEffects:effect-combinator-missing-concurrency:Effect.all",
    ],
  );
  assert.deepEqual(
    report.effectProductionBoundarySignals.map(
      (signal) =>
        `${signal.ownerName}:${signal.signalKind}:${signal.callee}:${signal.missingCapabilities.join(
          "+",
        )}`,
    ),
    ["riskyOwnerEffect:effect-promise-interop:Effect.promise:observability+resilience"],
  );
  assert.deepEqual(
    report.effectServiceMethods.map((method) => ({
      container: `${method.containerKind}:${method.containerName}.${method.methodName}`,
      success: method.successTypeText,
      error: method.errorTypeText,
      errorKind: method.errorChannelKind,
      requirements: method.requirementsTypeText,
    })),
    [
      {
        container: "interface:OwnerService.load",
        success: "string",
        error: "Error",
        errorKind: "domain",
        requirements: "OwnerRepo",
      },
      {
        container: "interface:OwnerService.save",
        success: "void",
        error: "never",
        errorKind: "none",
        requirements: "never",
      },
      {
        container: "type:OwnerNotifier.notify",
        success: "void",
        error: "never",
        errorKind: "none",
        requirements: "Notifications",
      },
      {
        container: "effect-tag:NotificationsTag.notify",
        success: "void",
        error: undefined,
        errorKind: undefined,
        requirements: undefined,
      },
    ],
  );
});

test("parser marks Effect runtime calls inside React Query callbacks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-react-query-"));
  const sourcePath = path.join(root, "component.tsx");
  fs.writeFileSync(
    sourcePath,
    [
      "declare namespace Effect {",
      "  export interface Effect<A, E = never, R = never> {}",
      "  export function runPromise<A>(program: Effect<A>): Promise<A>;",
      "}",
      "declare const ownerEffect: Effect.Effect<string, Error>;",
      "declare function useQuery(options: {",
      "  readonly queryKey: readonly string[];",
      "  readonly queryFn: () => Promise<string>;",
      "}): unknown;",
      "declare function useMutation(options: {",
      "  readonly mutationFn: () => Promise<string>;",
      "}): unknown;",
      "export function OwnerPanel() {",
      "  const outside = Effect.runPromise(ownerEffect);",
      "  useQuery({",
      "    queryKey: ['owner'],",
      "    queryFn: () => Effect.runPromise(ownerEffect),",
      "  });",
      "  useMutation({",
      "    mutationFn() {",
      "      return Effect.runPromise(ownerEffect);",
      "    },",
      "  });",
      "  return outside;",
      "}",
    ].join("\n"),
  );

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.deepEqual(
    report.effectRuntimeCalls.map((call) => ({
      callee: call.callee,
      kind: call.callKind,
      boundary: call.runtimeBoundaryKind,
    })),
    [
      { callee: "Effect.runPromise", kind: "default-runtime", boundary: undefined },
      {
        callee: "Effect.runPromise",
        kind: "default-runtime",
        boundary: "react-query-callback",
      },
      {
        callee: "Effect.runPromise",
        kind: "default-runtime",
        boundary: "react-query-callback",
      },
    ],
  );
});

test("parser reports TypeScript syntax diagnostics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-bad-"));
  const sourcePath = path.join(root, "bad.ts");
  fs.writeFileSync(sourcePath, "export const broken = ;\n");

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.equal(report.isValid, false);
  assert.equal(report.diagnostics.length, 1);
  assert.equal(report.diagnostics[0]?.code, 1109);
  assert.match(report.diagnostics[0]?.message ?? "", /Expression expected/);
});

test("parser classifies TSX script kind and module intent docs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-parser-tsx-"));
  const sourcePath = path.join(root, "view.tsx");
  fs.writeFileSync(
    sourcePath,
    ["/** Component owner for the parser fixture. */", "export const View = <main />;"].join("\n"),
  );

  const report = parseTypeScriptSourceFile(sourcePath);

  assert.equal(report.isValid, true);
  assert.equal(report.scriptKind, "tsx");
  assert.equal(report.hasIntentDoc, true);
});

test("project parser reads tsconfig compiler and package metadata facts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-harness-project-facts-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "generated"));
  fs.mkdirSync(path.join(root, "packages", "app"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "packages", "app", "package.json"),
    JSON.stringify({ name: "@example/app", type: "module" }),
  );
  fs.writeFileSync(
    path.join(root, "packages", "app", "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { composite: true, declaration: true },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "domain.ts"), "export const domain = 1;\n");
  fs.writeFileSync(path.join(root, "src", "types.ts"), "export interface Domain { id: string }\n");
  fs.writeFileSync(path.join(root, "generated", "generated.ts"), "export const generated = 1;\n");
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    [
      'import { domain } from "@facts/domain";',
      'import type { Domain } from "@facts/types";',
      'import "@facts/missing";',
      'import "#domain";',
      'import "#missing";',
      'import "./domain.js";',
      'import "./generated.js";',
      'import "react";',
      "export const value: Domain = { id: String(domain) };",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@example/facts",
      type: "module",
      main: "./dist/src/index.js",
      module: "./dist/src/index.mjs",
      types: "./dist/src/index.d.ts",
      exports: { ".": "./dist/src/index.js" },
      imports: { "#domain": "./src/domain.ts" },
      bin: { facts: "./dist/src/bin/facts.js" },
      scripts: { build: "tsc -p tsconfig.json", test: "node --test" },
      workspaces: ["packages/*"],
      dependencies: { effect: "^3.0.0" },
    }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      references: [{ path: "./packages/app" }],
      compilerOptions: {
        module: "NodeNext",
        baseUrl: ".",
        rootDir: ".",
        rootDirs: ["src", "generated"],
        outDir: "dist",
        paths: { "@facts/*": ["src/*"] },
        jsx: "react-jsx",
        target: "ES2022",
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        composite: true,
      },
      include: ["src/**/*.ts"],
    }),
  );

  const scope = readProjectResolution(root, defaultTypeScriptHarnessConfig());

  assert.equal(scope.packageJson.name, "@example/facts");
  assert.deepEqual(
    scope.packageJson.entrypoints.map(({ subpath, targets }) => ({ subpath, targets })),
    [
      { subpath: "main", targets: ["./dist/src/index.js"] },
      { subpath: "module", targets: ["./dist/src/index.mjs"] },
      { subpath: "types", targets: ["./dist/src/index.d.ts"] },
    ],
  );
  assert.deepEqual(
    scope.packageJson.scripts.map(({ name, command }) => ({ name, command })),
    [
      { name: "build", command: "tsc -p tsconfig.json" },
      { name: "test", command: "node --test" },
    ],
  );
  assert.deepEqual(scope.packageJson.scriptNames, ["build", "test"]);
  assert.deepEqual(
    scope.packageJson.packageExtensions.map((extension) => ({
      name: extension.name,
      activation: extension.activation,
      dependencySource: extension.dependencySource,
      capabilities: extension.capabilities,
    })),
    [
      {
        name: "effect",
        activation: "dependency",
        dependencySource: "dependencies",
        capabilities: ["typed-async", "domain-effects", "policy"],
      },
    ],
  );
  assert.deepEqual(
    scope.packageJson.workspaces.map(({ pattern }) => pattern),
    ["packages/*"],
  );
  assert.deepEqual(scope.packageJson.workspacePatterns, ["packages/*"]);
  assert.deepEqual(
    scope.packageJson.bins.map(({ subpath, targets }) => ({ subpath, targets })),
    [{ subpath: "facts", targets: ["./dist/src/bin/facts.js"] }],
  );
  assert.deepEqual(
    scope.config.projectReferencePackages.map((referencePackage) => ({
      name: referencePackage.name,
      packageType: referencePackage.packageType,
      path: relativePath(root, referencePackage.path),
      configPath: relativePath(root, referencePackage.configPath ?? ""),
    })),
    [
      {
        name: "@example/app",
        packageType: "module",
        path: "packages/app",
        configPath: "packages/app/tsconfig.json",
      },
    ],
  );
  assert.deepEqual(
    scope.config.pathAliases.map((alias) => alias.pattern),
    ["@facts/*"],
  );
  assert.equal(scope.config.compilerOptions.module, "NodeNext");
  assert.equal(scope.config.compilerOptions.moduleResolution, "NodeNext");
  assert.equal(scope.config.compilerOptions.target, "ES2022");
  assert.equal(scope.config.compilerOptions.jsx, "react-jsx");
  assert.equal(scope.config.compilerOptions.composite, true);
  assert.equal(scope.config.compilerOptions.declaration, true);
  assert.equal(scope.config.compilerOptions.declarationMap, true);
  assert.equal(scope.config.compilerOptions.sourceMap, true);
  assert.equal(relativePath(root, scope.config.compilerOptions.outDir ?? ""), "dist");
  assert.deepEqual(
    scope.config.compilerOptions.rootDirs.map((dir) => relativePath(root, dir)),
    ["generated", "src"],
  );
  assert.deepEqual(
    scope.config.projectReferences.map((dir) => relativePath(root, dir)),
    ["packages/app"],
  );

  const [moduleReport] = parseTypeScriptProjectFiles(scope, [path.join(root, "src", "index.ts")]);
  assert.ok(moduleReport !== undefined);
  assert.deepEqual(
    moduleReport.importResolutions.map((resolution) => ({
      moduleSpecifier: resolution.moduleSpecifier,
      isTypeOnly: resolution.isTypeOnly,
      resolution: resolution.resolution,
      resolvedPath:
        resolution.resolvedPath === undefined
          ? undefined
          : relativePath(root, resolution.resolvedPath),
    })),
    [
      {
        moduleSpecifier: "@facts/domain",
        isTypeOnly: false,
        resolution: "path-alias",
        resolvedPath: "src/domain.ts",
      },
      {
        moduleSpecifier: "@facts/types",
        isTypeOnly: true,
        resolution: "path-alias",
        resolvedPath: "src/types.ts",
      },
      {
        moduleSpecifier: "@facts/missing",
        isTypeOnly: false,
        resolution: "unresolved",
        resolvedPath: undefined,
      },
      {
        moduleSpecifier: "#domain",
        isTypeOnly: false,
        resolution: "package-import",
        resolvedPath: "src/domain.ts",
      },
      {
        moduleSpecifier: "#missing",
        isTypeOnly: false,
        resolution: "unresolved",
        resolvedPath: undefined,
      },
      {
        moduleSpecifier: "./domain.js",
        isTypeOnly: false,
        resolution: "relative",
        resolvedPath: "src/domain.ts",
      },
      {
        moduleSpecifier: "./generated.js",
        isTypeOnly: false,
        resolution: "relative",
        resolvedPath: "generated/generated.ts",
      },
      {
        moduleSpecifier: "react",
        isTypeOnly: false,
        resolution: "external",
        resolvedPath: undefined,
      },
    ],
  );
});
