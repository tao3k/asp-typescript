import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  renderTypeScriptProjectHarnessAgentSnapshot,
  renderTypeScriptProjectHarness,
  renderTypeScriptReasoningTree,
  runTypeScriptProjectHarnessAgentSnapshot,
  runTypeScriptProjectHarness,
  type TypeScriptHarnessReport,
  type TypeScriptImportEdgeFact,
  type TypeScriptReasoningOwnerBranchFact,
  type TypeScriptReasoningOwnerDependencyFact,
} from "../../src/index.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const snapshotSectionOrder = [
  "Extensions:",
  "OwnerBranches:",
  "OwnerDependencies:",
  "FindingGroups:",
] as const;

test("agent snapshot matches the golden project reasoning surface", () => {
  const fixtureRoot = path.join(projectRoot, "tests", "fixtures", "agent_snapshot_project");
  const snapshotPath = path.join(projectRoot, "tests", "snapshots", "agent_snapshot_project.snap");
  const report = runTypeScriptProjectHarness(fixtureRoot);
  const rendered = `${renderTypeScriptReasoningTree(report)}\n`;

  assert.equal(fs.readFileSync(snapshotPath, "utf8"), rendered);
});

test("golden agent snapshot obeys the compact text design", () => {
  const fixtureRoot = path.join(projectRoot, "tests", "fixtures", "agent_snapshot_project");
  const snapshot = goldenSnapshot();
  const workspaceSnapshot = workspaceGoldenSnapshot();

  assertCompactSnapshotDesign(snapshot, [projectRoot, fixtureRoot]);
  assertCompactSnapshotDesign(workspaceSnapshot, [projectRoot, fixtureRoot]);
});

test("repository agent snapshot self-applies the compact text design", () => {
  const report = runTypeScriptProjectHarness(projectRoot);
  const snapshot = `${renderTypeScriptReasoningTree(report)}\n`;

  assertCompactSnapshotDesign(snapshot, [projectRoot]);
  assert.doesNotMatch(snapshot, /shadowed=/u);
  assert.match(snapshot, /orphaned=\d+/u);
});

test("project agent snapshot segments workspace package scopes", () => {
  const fixtureRoot = path.join(projectRoot, "tests", "fixtures", "agent_snapshot_project");
  const snapshot = runTypeScriptProjectHarnessAgentSnapshot(fixtureRoot);
  const rendered = `${renderTypeScriptProjectHarnessAgentSnapshot(snapshot)}\n`;

  assert.equal(rendered, workspaceGoldenSnapshot());
  assert.deepEqual(
    snapshot.packages.map((packageSnapshot) => packageSnapshot.packagePath),
    [".", "packages/core", "packages/util"],
  );
});

test("compact renderers normalize diagnostic messages to the reasoning root", () => {
  const diagnosticRoot = path.join(projectRoot, "tmp", "diagnostic-root");
  const sourcePath = path.join(diagnosticRoot, "src", "index.ts");
  const message = `Output file '${path.join(
    diagnosticRoot,
    "dist",
    "index.d.ts",
  )}' has not been built from source file '${sourcePath}'.`;
  const report = diagnosticReport(diagnosticRoot, sourcePath, message);

  const snapshot = renderTypeScriptReasoningTree(report);
  const compact = renderTypeScriptProjectHarness(report);

  assert.equal(snapshot.includes(diagnosticRoot), false);
  assert.match(snapshot, /FindingGroups:/u);
  assert.match(snapshot, /TS-SEM-R001/u);
  assert.equal(compact.includes(diagnosticRoot), false);
  assert.match(compact, /dist\/index\.d\.ts/u);
  assert.match(compact, /src\/index\.ts/u);
});

test("agent snapshot omits empty child-edge placeholders", () => {
  const root = path.join(projectRoot, "tmp", "empty-child-edge-root");
  const report = snapshotReport(root, [
    ownerBranch(root, "src/index.ts", {
      roles: ["root", "facade"],
      exportNames: ["value"],
    }),
  ]);

  const snapshot = renderTypeScriptReasoningTree(report);

  assert.match(snapshot, /OwnerBranches:/u);
  assert.match(snapshot, /src\/index\.ts \[root, facade\] owner=src/u);
  assert.doesNotMatch(snapshot, /-> -/u);
});

test("agent snapshot caps branch lines and child edges", () => {
  const root = path.join(projectRoot, "tmp", "branch-cap-root");
  const branchReport = snapshotReport(
    root,
    Array.from({ length: 26 }, (_, index) =>
      ownerBranch(root, `src/owner-${index}/index.ts`, { roles: ["root", "facade"] }),
    ),
  );
  const childEdgeReport = snapshotReport(root, [
    ownerBranch(root, "src/index.ts", {
      roles: ["root", "facade"],
      childEdges: Array.from({ length: 10 }, (_, index) =>
        importEdge(root, "src/index.ts", `src/child-${index}.ts`),
      ),
    }),
  ]);

  assert.match(renderTypeScriptReasoningTree(branchReport), / - \.\.\. \+2 owner branches/u);
  assert.match(renderTypeScriptReasoningTree(childEdgeReport), /\.\.\. \+2 children/u);
});

test("agent snapshot groups owner dependencies by fan-out or fan-in", () => {
  const fanOutRoot = path.join(projectRoot, "tmp", "fan-out-root");
  const fanOutReport = snapshotReport(
    fanOutRoot,
    [ownerBranch(fanOutRoot, "src/index.ts", { roles: ["root", "facade"] })],
    [
      ownerDependency(fanOutRoot, "src/index.ts", "src/a.ts"),
      ownerDependency(fanOutRoot, "src/index.ts", "src/b.ts"),
    ],
  );
  const fanInRoot = path.join(projectRoot, "tmp", "fan-in-root");
  const fanInReport = snapshotReport(
    fanInRoot,
    [
      ownerBranch(fanInRoot, "src/a.ts"),
      ownerBranch(fanInRoot, "src/b.ts"),
      ownerBranch(fanInRoot, "src/c.ts"),
    ],
    [
      ownerDependency(fanInRoot, "src/a.ts", "src/shared.ts"),
      ownerDependency(fanInRoot, "src/b.ts", "src/shared.ts"),
      ownerDependency(fanInRoot, "src/c.ts", "src/shared.ts"),
    ],
  );

  assert.match(
    renderTypeScriptReasoningTree(fanOutReport),
    /src\/index\.ts --relative\/import--> src\/a\.ts, src\/b\.ts/u,
  );
  assert.match(
    renderTypeScriptReasoningTree(fanInReport),
    /src\/shared\.ts <--relative\/import-- src\/a\.ts, src\/b\.ts, src\/c\.ts/u,
  );
});

function goldenSnapshot(): string {
  return fs.readFileSync(
    path.join(projectRoot, "tests", "snapshots", "agent_snapshot_project.snap"),
    "utf8",
  );
}

function snapshotReport(
  root: string,
  ownerBranches: readonly TypeScriptReasoningOwnerBranchFact[],
  ownerDependencies: readonly TypeScriptReasoningOwnerDependencyFact[] = [],
): TypeScriptHarnessReport {
  const modulePaths = [
    ...new Set(
      [
        ...ownerBranches.map((branch) => branch.path),
        ...ownerDependencies.flatMap((dependency) =>
          dependency.toPath === undefined
            ? [dependency.fromPath]
            : [dependency.fromPath, dependency.toPath],
        ),
      ].sort((left, right) => left.localeCompare(right)),
    ),
  ];
  return {
    runMode: "project",
    modules: [],
    findings: [],
    rootPaths: [root],
    blockingSeverities: ["warning", "error"],
    blockingRuleIds: [],
    reasoningTree: {
      runMode: "project",
      projectRoot: root,
      compilerOptions: {
        rootDirs: [],
        allowJs: false,
        checkJs: false,
        noEmit: false,
        composite: false,
        declaration: false,
        emitDeclarationOnly: false,
        declarationMap: false,
        sourceMap: false,
      },
      projectReferences: [],
      projectReferenceResolutions: [],
      sourceRoots: [path.join(root, "src")],
      testRoots: [],
      pathAliases: [],
      packageEntrypoints: [],
      packageExports: [],
      packageImports: [],
      packageBins: [],
      packageDependencies: [],
      packageScripts: [],
      packageWorkspaces: [],
      packageExtensions: [],
      packageBuildTools: [],
      workspacePackages: [],
      workspacePatterns: [],
      projectReferencePackages: [],
      packageImportOwners: [],
      packageEntryResolutions: [],
      diagnostics: [],
      modules: modulePaths.map((modulePath) => ({
        path: modulePath,
        role: "source",
        layer: "harness",
        isValid: true,
        hasIntentDoc: false,
        lineCount: 1,
        syntaxDiagnosticCount: 0,
        semanticDiagnosticCount: 0,
        exportNames: [],
        typeOnlyExportNames: [],
        importSpecifiers: [],
        publicFunctionParams: [],
        publicTupleApiSurfaces: [],
        publicDataFields: [],
        publicTypeAliases: [],
        publicDiscriminatedUnionVariantFields: [],
        publicFunctionControlFlows: [],
        publicReturnObjectShapes: [],
        moduleResponsibilities: [],
        publicAsyncEffectSurfaces: [],
        effectRuntimeCalls: [],
        effectPromiseInteropRisks: [],
        effectResourceScopeRisks: [],
        effectConcurrencySignals: [],
        effectServiceMethods: [],
        effectSchemaBoundarySignals: [],
        effectProductionBoundarySignals: [],
        reactRenderPuritySignals: [],
        reactHookCallSignals: [],
        reactStaticDefinitionSignals: [],
      })),
      ownerBranches,
      ownerDependencies,
      shadowedSourceOwners: [],
      orphanedSourceFiles: [],
      edges: [],
    },
  };
}

function ownerBranch(
  root: string,
  relativePath: string,
  options: Partial<TypeScriptReasoningOwnerBranchFact> = {},
): TypeScriptReasoningOwnerBranchFact {
  const absolutePath = path.join(root, relativePath);
  return {
    path: absolutePath,
    ownerNamespace: ownerNamespace(relativePath),
    roles: ["source"],
    hasIntentDoc: false,
    importSummary: {
      totalImports: 0,
      relativeImports: 0,
      pathAliasImports: 0,
      packageImportImports: 0,
      externalImports: 0,
      unresolvedImports: 0,
    },
    exportNames: [],
    typeOnlyExportNames: [],
    childEdges: [],
    ...options,
  };
}

function importEdge(
  root: string,
  fromRelativePath: string,
  toRelativePath: string,
): TypeScriptImportEdgeFact {
  return {
    fromPath: path.join(root, fromRelativePath),
    moduleSpecifier: `./${path.basename(toRelativePath)}`,
    kind: "import",
    isTypeOnly: false,
    location: { path: path.join(root, fromRelativePath), line: 1, column: 0 },
    resolution: "relative",
    toPath: path.join(root, toRelativePath),
  };
}

function ownerDependency(
  root: string,
  fromRelativePath: string,
  toRelativePath: string,
): TypeScriptReasoningOwnerDependencyFact {
  return {
    fromPath: path.join(root, fromRelativePath),
    fromRole: "source",
    moduleSpecifier: `./${path.basename(toRelativePath)}`,
    kind: "import",
    isTypeOnly: false,
    isTestContext: false,
    location: { path: path.join(root, fromRelativePath), line: 1, column: 0 },
    resolution: "relative",
    toPath: path.join(root, toRelativePath),
    toRole: "source",
  };
}

function ownerNamespace(relativePath: string): string {
  if (relativePath.endsWith("/index.ts")) {
    return relativePath.slice(0, -"/index.ts".length);
  }
  return relativePath.endsWith(".ts") ? relativePath.slice(0, -".ts".length) : relativePath;
}

function workspaceGoldenSnapshot(): string {
  return fs.readFileSync(
    path.join(projectRoot, "tests", "snapshots", "agent_snapshot_workspace_project.snap"),
    "utf8",
  );
}

function assertCompactSnapshotDesign(snapshot: string, hiddenPaths: readonly string[]): void {
  const lines = snapshot.trimEnd().split("\n");
  const segments = snapshotSegments(lines);
  assert.ok(segments.length > 0, "snapshot should include at least one package segment");
  for (const line of lines.filter((line) => line.startsWith("pkg "))) {
    assert.match(line, /^pkg (\.|[^\s]+)$/u);
  }
  for (const segment of segments) {
    assert.match(segment[0] ?? "", /^Modules: source=\d+/u);
    assertOrderedSections(segment);
  }
  assert.doesNotMatch(snapshot, /^\{/u);
  assert.doesNotMatch(snapshot, /"modules"|"projectResolution"|"rootPaths"/u);
  assert.doesNotMatch(
    snapshot,
    /\bdependencies\b|\bdevDependencies\b|\bpeerDependencies\b|\boptionalDependencies\b/u,
  );
  for (const hiddenPath of hiddenPaths) {
    assert.equal(
      snapshot.includes(hiddenPath),
      false,
      `snapshot leaked absolute path: ${hiddenPath}`,
    );
  }
}

function snapshotSegments(lines: readonly string[]): readonly (readonly string[])[] {
  const segments: string[][] = [];
  let currentSegment: string[] = [];
  for (const line of lines) {
    if (line.startsWith("pkg ")) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      continue;
    }
    currentSegment.push(line);
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  return segments;
}

function assertOrderedSections(lines: readonly string[]): void {
  const sectionIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) =>
      snapshotSectionOrder.includes(line as (typeof snapshotSectionOrder)[number]),
    );
  const orderBySection: ReadonlyMap<string, number> = new Map(
    snapshotSectionOrder.map((section, order) => [section, order]),
  );
  let previousOrder = -1;
  for (const { line } of sectionIndexes) {
    const order = orderBySection.get(line);
    if (order === undefined) {
      assert.fail(`unexpected agent snapshot section: ${line}`);
    }
    assert.ok(order > previousOrder, `snapshot section out of order: ${line}`);
    previousOrder = order;
  }
}

function diagnosticReport(
  root: string,
  sourcePath: string,
  message: string,
): TypeScriptHarnessReport {
  return {
    runMode: "project",
    modules: [],
    findings: [
      {
        ruleId: "TS-SEM-R001",
        packId: "typescript.semantic",
        severity: "info",
        title: "TypeScript semantic diagnostics should be visible",
        summary: `TS6305: ${message}`,
        location: { path: sourcePath, line: 1, column: 0 },
        requirement:
          "TypeScript Program semantic diagnostics should be visible from parser-native facts without replacing tsc.",
        label: "TypeScript semantic diagnostic",
        labels: { parser: "typescript-program", surface: "source" },
      },
    ],
    rootPaths: [root],
    blockingSeverities: ["warning", "error"],
    blockingRuleIds: [],
    reasoningTree: {
      runMode: "project",
      projectRoot: root,
      compilerOptions: {
        rootDirs: [],
        allowJs: false,
        checkJs: false,
        noEmit: false,
        composite: false,
        declaration: false,
        emitDeclarationOnly: false,
        declarationMap: false,
        sourceMap: false,
      },
      projectReferences: [],
      projectReferenceResolutions: [],
      sourceRoots: [path.join(root, "src")],
      testRoots: [],
      pathAliases: [],
      packageEntrypoints: [],
      packageExports: [],
      packageImports: [],
      packageBins: [],
      packageDependencies: [],
      packageScripts: [],
      packageWorkspaces: [],
      packageExtensions: [],
      packageBuildTools: [],
      workspacePackages: [],
      workspacePatterns: [],
      projectReferencePackages: [],
      packageImportOwners: [],
      packageEntryResolutions: [],
      diagnostics: [
        {
          ownerPath: sourcePath,
          phase: "semantic",
          code: 6305,
          category: "error",
          message,
          location: { path: sourcePath, line: 1, column: 0 },
          relatedInformation: [],
        },
      ],
      modules: [
        {
          path: sourcePath,
          role: "source",
          layer: "harness",
          isValid: true,
          hasIntentDoc: false,
          lineCount: 1,
          syntaxDiagnosticCount: 0,
          semanticDiagnosticCount: 1,
          exportNames: [],
          typeOnlyExportNames: [],
          importSpecifiers: [],
          publicFunctionParams: [],
          publicTupleApiSurfaces: [],
          publicDataFields: [],
          publicTypeAliases: [],
          publicDiscriminatedUnionVariantFields: [],
          publicFunctionControlFlows: [],
          publicReturnObjectShapes: [],
          moduleResponsibilities: [],
          publicAsyncEffectSurfaces: [],
          effectRuntimeCalls: [],
          effectPromiseInteropRisks: [],
          effectResourceScopeRisks: [],
          effectConcurrencySignals: [],
          effectServiceMethods: [],
          effectSchemaBoundarySignals: [],
          effectProductionBoundarySignals: [],
          reactRenderPuritySignals: [],
          reactHookCallSignals: [],
          reactStaticDefinitionSignals: [],
        },
      ],
      ownerBranches: [],
      ownerDependencies: [],
      shadowedSourceOwners: [],
      orphanedSourceFiles: [],
      edges: [],
    },
  };
}
