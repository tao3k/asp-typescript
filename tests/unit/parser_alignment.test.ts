import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("parser-first alignment keeps TypeScript-native facts owned by the parser layer", () => {
  const sources = sourceFiles(path.join(projectRoot, "src"));
  const parserSources = sources.filter(isParserLayerSource);
  const parserText = readAll(parserSources);
  const nonParserSources = sources.filter((sourcePath) => !isParserLayerSource(sourcePath));

  assert.ok(parserSources.length > 0);
  assertIncludes(parserText, 'from "typescript"');
  assertIncludes(parserText, "parseJsonText");
  assertIncludes(parserText, "readConfigFile");
  assertIncludes(parserText, "parseJsonConfigFileContent");
  assertIncludes(parserText, "resolveModuleName");

  for (const sourcePath of nonParserSources) {
    const source = fs.readFileSync(sourcePath, "utf8");
    assertNoAny(
      source,
      [
        'from "typescript"',
        "createSourceFile",
        "parseJsonText",
        "readConfigFile",
        "parseJsonConfigFileContent",
        "resolveModuleName",
      ],
      sourcePath,
    );
  }
});

test("runner, rule, and render layers stay downstream of the reasoning tree", () => {
  const runner =
    readProjectFile("src/runner.ts") +
    readProjectFile("src/runner/run-project.ts") +
    readProjectFile("src/runner/run-paths.ts");
  assertIncludes(runner, "const reasoningTree = buildTypeScriptReasoningTree(scope, modules);");
  assertIncludes(runner, "const findings = evaluateDefaultRulePacks(reasoningTree, config);");
  assertIncludes(
    runner,
    "const reasoningTree = buildExplicitTypeScriptReasoningTree(roots, modules);",
  );

  const rules = readAll(sourceFiles(path.join(projectRoot, "src", "rules")));
  const rulesFacade = readProjectFile("src/rules.ts");
  const rulesEngine = readProjectFile("src/rules/engine.ts");
  assertIncludes(rulesFacade, 'export { evaluateDefaultRulePacks } from "./rules/engine.js";');
  assertIncludes(
    rulesEngine,
    "evaluateDefaultRulePacks(\n  reasoningTree: TypeScriptReasoningTree",
  );
  assertIncludes(rules, "reasoningTree.");
  assertNoAny(
    rules,
    [
      'from "./parser',
      'from "./reasoning',
      "TypeScriptProjectHarnessScope",
      "TypeScriptModuleReport",
      "moduleReport.diagnostics",
      "semanticDiagnostics",
      "packageJsonDiagnostics",
    ],
    "src/rules",
  );

  const render = readProjectFile("src/render.ts") + readProjectFile("src/render/agent-snapshot.ts");
  assertIncludes(render, "const tree = report.reasoningTree;");
  assertIncludes(render, "tree.ownerBranches.map");
  assertIncludes(render, "tree.ownerDependencies");
  assertIncludes(render, "tree.packageImportOwners");
  assertIncludes(render, "OwnerBranches:");
  assertIncludes(render, "OwnerDependencies:");
  assertIncludes(render, "FindingGroups:");
  assertNoAny(
    render,
    [
      'from "./parser',
      'from "./reasoning',
      "report.modules",
      "report.projectResolution",
      "report.rootPaths",
      "tree.edges",
      "[package deps]",
    ],
    "src/render.ts",
  );

  assertIncludes(rules, "reasoningTree.ownerDependencies");
  assertIncludes(rules, "reasoningTree.ownerBranches");
  assertNoAny(rules, ["reasoningTree.edges"], "src/rules");
});

test("source model keeps manifest dependency facts parser-owned", () => {
  const sourceText = readAll(sourceFiles(path.join(projectRoot, "src")));
  const goldenSnapshot = readProjectFile("tests/snapshots/agent_snapshot_project.snap");

  assertIncludes(sourceText, "packageImportOwners");
  assertIncludes(sourceText, "ownerBranches");
  assertIncludes(sourceText, "ownerDependencies");
  assertIncludes(sourceText, "TypeScriptPackageDependencyFact");
  assertIncludes(sourceText, "TypeScriptPackageDependencySource");
  assertIncludes(sourceText, "packageDependencyFacts");
  assertIncludes(sourceText, "packageDependencies");
  assertIncludes(goldenSnapshot, "OwnerDependencies:");
  assertIncludes(goldenSnapshot, "--package-name/type-import-->");
  assertIncludes(goldenSnapshot, "owner=workspace");
  assertNoAny(
    sourceText,
    [
      "PackageJsonDependency",
      "PackageManifestDependency",
      "packageManifestDependencies",
      "dependencyNames",
    ],
    "src",
  );
  assertIncludes(sourceText, "packageExtensions");
  assertIncludes(sourceText, "TypeScriptPackageExtensionFact");
  assertIncludes(sourceText, "packageBuildTools");
  assertIncludes(sourceText, "TypeScriptPackageBuildToolFact");
  assertNoAny(
    goldenSnapshot,
    [
      "[package deps]",
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ],
    "tests/snapshots/agent_snapshot_project.snap",
  );
});

test("compact snapshot design is the active documentation contract", () => {
  const compactDoc = readProjectFile("docs/03_features/204_compact_agent_snapshot.md");
  assertIncludes(compactDoc, "OwnerBranches");
  assertIncludes(compactDoc, "OwnerDependencies");
  assertIncludes(compactDoc, "FindingGroups");
  assertIncludes(compactDoc, "import-owner dependency");
  assertIncludes(compactDoc, "not manifest dependency");
  assertIncludes(compactDoc, "absolute path mentions");
  assertIncludes(compactDoc, "tests/snapshots/agent_snapshot_project.snap");
  assertNoAny(compactDoc, ["[package deps]"], "docs/03_features/204_compact_agent_snapshot.md");

  for (const docPath of ["development.md", "docs/index.md", "docs/03_features/203_cli.md"]) {
    const source = readProjectFile(docPath);
    assertIncludes(source, "204_compact_agent_snapshot.md", docPath);
  }
});

function assertIncludes(source: string, expected: string, label = expected): void {
  assert.ok(source.includes(expected), `${label} was not found`);
}

function assertNoAny(source: string, forbidden: readonly string[], label: string): void {
  for (const pattern of forbidden) {
    assert.equal(source.includes(pattern), false, `${label} contains ${pattern}`);
  }
}

function isParserLayerSource(sourcePath: string): boolean {
  const relativePath = path.relative(path.join(projectRoot, "src"), sourcePath);
  return (
    relativePath === "parser.ts" ||
    relativePath.startsWith(`parser${path.sep}`) ||
    relativePath.startsWith(`syntax${path.sep}`)
  );
}

function readAll(paths: readonly string[]): string {
  return paths.map((sourcePath) => fs.readFileSync(sourcePath, "utf8")).join("\n");
}

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}
