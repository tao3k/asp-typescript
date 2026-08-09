import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { packageDependencyFacts } from "../parser/package_dependencies.js";
import { parsePackageJsonDocument } from "../parser/package_document.js";

interface WritableStream {
  write(chunk: string): unknown;
}

interface DependencyTopologyStreams {
  readonly stdout: WritableStream;
  readonly stderr: WritableStream;
}

interface DependencyTopologyNode {
  readonly id: string;
  readonly kind: "dependency" | "dependency-version";
  readonly value: string;
  readonly path?: string;
  readonly fields: Readonly<Record<string, string>>;
}

interface DependencyTopologyEdge {
  readonly source: string;
  readonly target: string;
  readonly relation: "version_locked";
}

interface DependencyTopologyPacket {
  readonly packetKind: "dependency-topology";
  readonly fingerprint: string;
  readonly graph: {
    readonly nodes: readonly DependencyTopologyNode[];
    readonly edges: readonly DependencyTopologyEdge[];
  };
}

function workspaceArgument(argv: readonly string[], cwd: string): string {
  const workspaceIndex = argv.indexOf("--workspace");
  if (workspaceIndex === -1) {
    return cwd;
  }
  const workspace = argv[workspaceIndex + 1];
  if (workspace === undefined || workspace.startsWith("-")) {
    throw new Error("search dependency-topology requires a value after --workspace");
  }
  return resolve(cwd, workspace);
}

export function buildDependencyTopologyPacket(workspaceRoot: string): DependencyTopologyPacket {
  const manifestPath = "package.json";
  const absoluteManifestPath = resolve(workspaceRoot, manifestPath);
  const sourceText = readFileSync(absoluteManifestPath, "utf8");
  const document = parsePackageJsonDocument(manifestPath, sourceText);
  const dependencies = new Map(
    packageDependencyFacts(document).map((dependency) => [dependency.name, dependency]),
  );
  const nodes: DependencyTopologyNode[] = [];
  const edges: DependencyTopologyEdge[] = [];

  for (const dependency of [...dependencies.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const dependencyId = `dependency:${dependency.name}`;
    const versionId = `dependency-version:${dependency.name}`;
    nodes.push({
      id: dependencyId,
      kind: "dependency",
      value: dependency.name,
      path: manifestPath,
      fields: {
        dependencyName: dependency.name,
        manifestPath,
        dependencySource: dependency.source,
      },
    });
    nodes.push({
      id: versionId,
      kind: "dependency-version",
      value: dependency.versionRange,
      fields: {
        version: dependency.versionRange,
      },
    });
    edges.push({
      source: dependencyId,
      target: versionId,
      relation: "version_locked",
    });
  }

  const graph = { nodes, edges };
  const fingerprint = `sha256:${createHash("sha256").update(JSON.stringify(graph)).digest("hex")}`;
  return {
    packetKind: "dependency-topology",
    fingerprint,
    graph,
  };
}

export function runDependencyTopologyCommand(
  argv: readonly string[],
  streams: DependencyTopologyStreams,
  cwd: string,
): number {
  try {
    const workspaceRoot = workspaceArgument(argv, cwd);
    const packet = buildDependencyTopologyPacket(workspaceRoot);
    streams.stdout.write(`${JSON.stringify(packet)}\n`);
    return 0;
  } catch (error) {
    streams.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}
