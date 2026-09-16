#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { finishDevCommandLog, startDevCommandLog } from "./dev-command-log.js";

export interface CliStreams {
  readonly stdout: { write(chunk: string): unknown };
  readonly stderr: { write(chunk: string): unknown };
  readonly stdin?: string;
  readonly stdinBytes?: Uint8Array;
}

export const HELP_TEXT = `asp-typescript — TypeScript native-syntax provider

Usage:
  asp search playbook --language typescript --rg -n -e <query> . --tantivy 'title:<query>^2 OR body:<query>'
  asp query playbook --language typescript --selector <exact-structural-selector> --projection <source|callable-skeleton> --workspace <root>
  asp-typescript query (--catalog <id> | --treesitter-query <s-expression>) [--workspace <root>] [--selector <structural-selector>] [--json]
  asp-typescript ast-patch dry-run --packet <semantic-ast-patch.json|->
  asp-typescript agent doctor [--json]
  asp-typescript agent guide

SEARCH
  Public discovery is owned by the ASP Client and Runtime. The provider binary
  exposes no provider-local search views. The playbook composes candidate
  acquisition, TypeScript native syntax, Tantivy lexical ranking, and Python
  Graph correlation into one version-1 receipt.

QUERY
  query --treesitter-query <s-expression> [--selector <structural-selector>]
  query --catalog declarations
  query --catalog flow-lite --where 'source.call=NAME sink.constructs=TYPE scope.fn=FUNCTION'

GENERAL
  --help             This help
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
  streams.stderr.write(
    command.startsWith("-")
      ? `unknown option: ${command}. Use --help.\n`
      : `unknown command: ${command}. Use --help.\n`,
  );
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
