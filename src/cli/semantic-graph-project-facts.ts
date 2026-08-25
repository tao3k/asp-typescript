/**
 * Render package/build/test semantic graph facts for TypeScript projects.
 */
import {
  type TypeScriptSemanticGraphDependencyFact,
  type TypeScriptSemanticGraphProjectFact,
  type TypeScriptSemanticGraphTestFact,
} from "../parser/semantic_graph_project_facts.js";
import { type ProviderGraphEdge, type ProviderGraphNode } from "./semantic-graph-facts.js";
import {
  TYPE_SCRIPT_LANGUAGE_ID as LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID as PROVIDER_ID,
} from "./semantic-language.js";

const TEST_COMMAND = "npm test";

export function projectGraphPayload(project: TypeScriptSemanticGraphProjectFact | undefined): {
  readonly nodes: readonly ProviderGraphNode[];
  readonly edges: readonly ProviderGraphEdge[];
} {
  if (project === undefined) return { nodes: [], edges: [] };
  const nodes: ProviderGraphNode[] = [packageNode(project), buildNode(project)];
  const edges: ProviderGraphEdge[] = [
    {
      source: packageIdFor(project.packageName),
      target: buildIdFor(project.packageName),
      relation: "builds",
    },
  ];
  for (const dependency of project.dependencies) {
    const dependencyId = dependencyIdFor(project.packageName, dependency);
    nodes.push(dependencyNode(project, dependency, dependencyId));
    edges.push({
      source: packageIdFor(project.packageName),
      target: dependencyId,
      relation: "depends_on",
    });
  }
  for (const test of project.tests) {
    const testId = testIdFor(project.packageName, test);
    nodes.push(testNode(project, test, testId));
    edges.push({ source: buildIdFor(project.packageName), target: testId, relation: "tests" });
    edges.push({
      source: testId,
      target: packageIdFor(project.packageName),
      relation: "belongs_to",
    });
  }
  return { nodes, edges };
}

function packageNode(project: TypeScriptSemanticGraphProjectFact): ProviderGraphNode {
  return {
    id: packageIdFor(project.packageName),
    kind: "package",
    role: "npm-package",
    value: project.packageName,
    action: "package",
    path: project.manifestPath,
    ownerPath: project.manifestPath,
    startLine: 1,
    endLine: 1,
    locator: `${project.manifestPath}:1:1`,
    matchText: project.packageName,
    fields: {
      languageId: LANGUAGE_ID,
      providerId: PROVIDER_ID,
      semanticFactKind: "package",
      provenance: "parser",
      confidence: "exact",
      freshness: "fresh",
      packageName: project.packageName,
      manifestPath: project.manifestPath,
    },
  };
}

function buildNode(project: TypeScriptSemanticGraphProjectFact): ProviderGraphNode {
  return {
    id: buildIdFor(project.packageName),
    kind: "build",
    role: "npm-test",
    value: TEST_COMMAND,
    action: "build",
    path: project.manifestPath,
    ownerPath: project.manifestPath,
    startLine: 1,
    endLine: 1,
    locator: `${project.manifestPath}:1:1`,
    matchText: TEST_COMMAND,
    fields: {
      languageId: LANGUAGE_ID,
      providerId: PROVIDER_ID,
      semanticFactKind: "build",
      provenance: "build",
      confidence: "exact",
      freshness: "fresh",
      packageName: project.packageName,
      manifestPath: project.manifestPath,
      tool: "npm",
      command: TEST_COMMAND,
    },
  };
}

function dependencyNode(
  project: TypeScriptSemanticGraphProjectFact,
  dependency: TypeScriptSemanticGraphDependencyFact,
  dependencyId: string,
): ProviderGraphNode {
  return {
    id: dependencyId,
    kind: "dependency",
    role: dependency.dependencyKind,
    value: dependency.packageName,
    action: "deps",
    path: dependency.manifestPath,
    ownerPath: dependency.manifestPath,
    startLine: 1,
    endLine: 1,
    locator: `${dependency.manifestPath}:1:1`,
    matchText: dependency.packageName,
    fields: {
      languageId: LANGUAGE_ID,
      providerId: PROVIDER_ID,
      semanticFactKind: "dependency",
      provenance: "parser",
      confidence: "exact",
      freshness: "fresh",
      packageName: project.packageName,
      manifestPath: dependency.manifestPath,
      dependencyName: dependency.dependencyName,
      dependencyPackageName: dependency.packageName,
      dependencyKind: dependency.dependencyKind,
      versionReq: dependency.versionReq,
    },
  };
}

function testNode(
  project: TypeScriptSemanticGraphProjectFact,
  test: TypeScriptSemanticGraphTestFact,
  testId: string,
): ProviderGraphNode {
  return {
    id: testId,
    kind: "test",
    role: "node-test-target",
    value: test.name,
    action: "tests",
    path: test.path,
    ownerPath: test.path,
    startLine: 1,
    endLine: 1,
    locator: `${test.path}:1:1`,
    matchText: test.name,
    fields: {
      languageId: LANGUAGE_ID,
      providerId: PROVIDER_ID,
      semanticFactKind: "test",
      provenance: "test",
      confidence: "exact",
      freshness: "fresh",
      packageName: project.packageName,
      testName: test.name,
      testPath: test.path,
      functionCount: test.functionCount,
      command: TEST_COMMAND,
    },
  };
}

function packageIdFor(packageName: string): string {
  return stableId("package", packageName);
}

function buildIdFor(packageName: string): string {
  return stableId("build", `${TEST_COMMAND}:${packageName}`);
}

function dependencyIdFor(
  packageName: string,
  dependency: TypeScriptSemanticGraphDependencyFact,
): string {
  return stableId(
    "dependency",
    `${packageName}:${dependency.dependencyKind}:${dependency.packageName}`,
  );
}

function testIdFor(packageName: string, test: TypeScriptSemanticGraphTestFact): string {
  return stableId("test", `${packageName}:${test.path}`);
}

function stableId(kind: string, value: string): string {
  const rendered = [...value].map((character) => {
    if (/^[A-Za-z0-9]$/u.test(character)) return character.toLowerCase();
    if (["/", ".", "_", "-"].includes(character)) return character;
    return "-";
  });
  return `${kind}:${rendered.join("").replace(/^-+|-+$/gu, "")}`;
}
