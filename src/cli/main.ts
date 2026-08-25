#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tryRunFastSearchCli } from "./fast-search-cli.js";

export interface CliStreams {
  readonly stdout: { write(chunk: string): unknown };
  readonly stderr: { write(chunk: string): unknown };
  readonly stdin?: string;
  readonly stdinBytes?: Uint8Array;
}

export const HELP_TEXT = `asp-typescript — TypeScript semantic search and project harness

Usage:
  asp-typescript search <view> ... [--json] [--package <path>] [--workspace <workspace-root>]
  asp typescript query --selector <exact-structural-selector> --projection <source|callable-skeleton> --workspace <workspace-root>
  asp-typescript query (--catalog <id> | --treesitter-query <s-expression>) [<workspace-root>] [--workspace <workspace-root>] [--selector <structural-selector>] [--json]
  asp-typescript query --catalog flow-lite --where 'source.call=NAME sink.constructs=TYPE scope.fn=FUNCTION' [<workspace-root>] [--json] [--workspace <workspace-root>]
  asp-typescript ast-patch dry-run --packet <semantic-ast-patch.json|->
  asp-typescript check [--changed | --full] [--json]
  asp-typescript evidence graph [--json] [PROJECT_ROOT]
  asp-typescript evidence analyze [--json] [PROJECT_ROOT]
  asp-typescript agent doctor [--json]
  asp-typescript agent guide

SEARCH VIEWS
  search workspace          Workspace package/router index
  search prime              Project semantic-search map
  search owner <path>       Owner graph slice
  search owner <path> items --query <symbol>
                             Parser-owned structural selector discovery
  search dependency <pkg>   NPM/external dependency usage
  search deps <pkg[/subpath][@ver][::api]>
                             Versioned dependency API usage
  search api <query>         Parser-owned exported/public API facts
  search public-external-types <pkg>
                             Public API types that expose a dependency
  search policy <rule-id-or-alias>
                             Provider-owned policy rule handles
  search symbol <name>      Exported symbol definitions
  search callsite <name>    Owner-level import/reexport sites
  search import <query>     Import/reexport owner edges
  search tests <owner>      Tests that import an owner
  search lexical <query>        Fuzzy lexical owner/source-text candidates
  search lexical <query> owner tests
                             Minimal final-only fuzzy -> owner -> tests pipe
  search lexical --query-set <q1> --query-set <q2> [owner tests] [--owner <path>]
                             Homogeneous fuzzy query-set with optional owner scope
  search semantic-facts <query>
                             Provider-owned field/type/collection facts for graph-turbo
  search ingest             Detect stdin shape and group hits by owner
  --package <path>          Run the selected search in a workspace package scope

QUERY
  asp typescript query --selector <exact-structural-selector> --projection source --workspace <workspace-root>
                             Exact source materialization through ASP authority
  asp typescript query --selector <exact-structural-selector> --projection callable-skeleton --workspace <workspace-root>
                             Typed callable skeleton materialization through ASP authority
  query --treesitter-query <s-expression> [--selector <structural-selector>]
                             Tree-sitter-compatible syntax locate and capture
  query --catalog declarations
                             Provider-embedded canonical tree-sitter query catalog
  query --catalog flow-lite --where 'source.call=NAME sink.constructs=TYPE scope.fn=FUNCTION'
                             Flow-lite ABI compatibility surface; TypeScript executor is not enabled yet

AST PATCH
  ast-patch dry-run --packet <path|->
                             Provider-native TypeScript AST dry-run receipt; never mutates files

CHECK
  check --changed           Fast lane alias; currently delegates to project check
  check --full              Full project harness check
  check --json              Structured TypeScriptHarnessReport JSON

EVIDENCE
  evidence graph --json     Portable semantic-evidence-graph packet
  evidence analyze --json   Graph-turbo request for evidence-quality ranking

AGENT
  agent doctor              Print semantic-language provider readiness
  agent doctor --json       Semantic language registry document
  agent guide
                            Print command-line search flow guide
  Hook install/runtime is owned by asp in the root toolchain.

GENERAL
  --help             This help

EXAMPLES
  asp-typescript search workspace --workspace .
  asp-typescript search prime --package packages/core --workspace .
  asp-typescript search prime --workspace .
  asp-typescript search dependency react --workspace .
  asp-typescript search deps react/jsx-runtime@19.0.0::jsx --workspace .
  asp-typescript search api OrderStatus --workspace .
  asp-typescript search public-external-types react --workspace .
  asp-typescript search policy TS-AGENT-POLICY-001 owner tests --workspace .
  asp-typescript search symbol OrderStatus --workspace .
  asp-typescript search callsite OrderStatus --workspace .
  asp-typescript search import ./order --workspace .
  asp-typescript search tests src/domain/order.ts --workspace .
  asp-typescript search lexical OrderStatus --workspace .
  asp-typescript search lexical --query-set OrderStatus --query-set findOrderStatus owner tests --workspace .
  asp typescript query --selector 'typescript://src/domain/order.ts#item/function/findOrderStatus' --projection source --workspace .
  asp-typescript query --treesitter-query '(function_declaration name: (identifier) @function.name)' --workspace .
  asp-typescript query --catalog declarations --selector src/domain/order.ts --workspace .
  asp-typescript query --catalog flow-lite --where 'source.call=payload sink.constructs=Action scope.fn=collect' --workspace .
  asp-typescript ast-patch dry-run --packet semantic-ast-patch.json
  asp-typescript evidence graph --json .
  asp-typescript evidence analyze --json .
  rg -n "OrderStatus" src tests | asp-typescript search ingest --workspace .
  asp-typescript check --changed
  asp-typescript agent guide

`;

export async function runCliFromEnv(): Promise<number> {
  const argv = process.argv.slice(2);
  const cwd = process.cwd();
  const log = startDevCommandLog(argv, cwd);
  try {
    if (argv.length === 1 && argv[0] === "serve") {
      const { serveProviderRuntime } = await import("./provider-runtime.js");
      const exitCode = await serveProviderRuntime(process.stdout, cwd);
      finishDevCommandLog(log, exitCode);
      return exitCode;
    }
    const stdinBytes = await readStdin();
    const exitCode = await runCli(
      argv,
      {
        stdout: process.stdout,
        stderr: process.stderr,
        stdin: Buffer.from(stdinBytes).toString("utf8"),
        stdinBytes,
      },
      cwd,
    );
    finishDevCommandLog(log, exitCode);
    return exitCode;
  } catch (error) {
    finishDevCommandLog(log, 2);
    throw error;
  }
}

async function readStdin(): Promise<Uint8Array> {
  if (process.stdin.isTTY) return new Uint8Array();
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function runCli(
  argv: readonly string[],
  streams: CliStreams,
  cwd: string,
): Promise<number> {
  if (argv[0] === "project-resolution") {
    const { runProjectResolutionCommand } = await import("./project-resolution.js");
    return runProjectResolutionCommand(argv.slice(1), streams, cwd);
  }
  if (argv[0] === "search" && argv[1] === "dependency-topology") {
    const { runDependencyTopologyCommand } = await import("./dependency-topology.js");
    return runDependencyTopologyCommand(argv.slice(2), streams, cwd);
  }
  const fastSearchStatus = tryRunFastSearchCli(argv, streams, cwd);
  if (fastSearchStatus !== undefined) return fastSearchStatus;
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    streams.stdout.write(HELP_TEXT);
    return 0;
  }
  const { parseProtocolArgs, runProtocolCli } = await import("./protocol.js");
  const protocolArgs = parseProtocolArgs(argv);
  if (protocolArgs !== undefined) {
    return runProtocolCli(protocolArgs, streams, cwd, HELP_TEXT);
  }

  const command = argv[0]!;
  if (command.startsWith("-")) {
    streams.stderr.write(`unknown option: ${command}. Use --help.\n`);
  } else {
    streams.stderr.write(`unknown command: ${command}. Use --help.\n`);
  }
  return 2;
}

if (isDirectCliEntry(process.argv[1])) {
  void runCliFromEnv().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 2;
    },
  );
}

function isDirectCliEntry(argvPath: string | undefined): boolean {
  if (argvPath === undefined) return false;
  const currentPath = fileURLToPath(import.meta.url);
  try {
    return fs.realpathSync(currentPath) === fs.realpathSync(argvPath);
  } catch {
    return currentPath === path.resolve(argvPath);
  }
}
import { finishDevCommandLog, startDevCommandLog } from "./dev-command-log.js";
