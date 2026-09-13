/** Native parser, fact, and exact-projection commands for the TypeScript provider. */

import fs from "node:fs";
import path from "node:path";

import { renderCodexAgentGuide } from "./agent-guide.js";
import { renderTypeScriptAstPatchDryRunReceiptJson } from "./ast-patch.js";
import {
  parseAgentArgs,
  renderAgentDoctor,
  renderAgentDoctorJson,
  type AgentArgs,
} from "./protocol-agent.js";
import {
  isFlowLiteQueryArgs,
  parseFlowLiteQueryArgs,
  renderTypeScriptFlowLiteQuery,
  type FlowLiteQueryArgs,
} from "./protocol-flow-lite-query.js";
import {
  isTreeSitterQueryArgs,
  parseTreeSitterQueryArgs,
  type TreeSitterQueryArgs,
} from "./protocol-tree-sitter-query.js";
import {
  buildOwnerItemSemanticReadPacket,
  renderOwnerItemSemanticReadPacket,
  renderOwnerItemSemanticReadPacketJson,
} from "./source-read.js";
import { renderTypeScriptTreeSitterQuery } from "../parser/native_syntax/tree-sitter-query.js";

export interface CliStreams {
  readonly stdout: { write(chunk: string): unknown };
  readonly stderr: { write(chunk: string): unknown };
  readonly stdin?: string;
}

export type ProtocolArgs =
  | DirectSourceReadArgs
  | TreeSitterQueryArgs
  | FlowLiteQueryArgs
  | AgentArgs
  | AstPatchArgs
  | ProtocolHelpArgs
  | ProtocolErrorArgs;

interface DirectSourceReadArgs {
  readonly kind: "direct-source-read";
  readonly projectRoot: string | undefined;
  readonly packagePath: string | undefined;
  readonly selector: string;
  readonly json: boolean;
}

interface AstPatchArgs {
  readonly kind: "ast-patch";
  readonly mode: "dry-run";
  readonly packetPath: string;
  readonly projectRoot: string | undefined;
}

interface ProtocolHelpArgs {
  readonly kind: "help";
}

interface ProtocolErrorArgs {
  readonly kind: "error";
  readonly message: string;
}

export function parseProtocolArgs(argv: readonly string[]): ProtocolArgs | undefined {
  const command = argv[0];
  if (command === undefined) return undefined;
  if (command === "--help" || command === "-h") return { kind: "help" };
  if (command === "query") {
    const queryArgs = argv.slice(1);
    return isFlowLiteQueryArgs(queryArgs)
      ? parseFlowLiteQueryArgs(queryArgs)
      : isTreeSitterQueryArgs(queryArgs)
        ? parseTreeSitterQueryArgs(queryArgs)
        : parseQueryArgs(queryArgs);
  }
  if (command === "ast-patch") return parseAstPatchArgs(argv.slice(1));
  if (command === "agent") return parseAgentArgs(argv.slice(1));
  return undefined;
}

export function runProtocolCli(
  args: ProtocolArgs,
  streams: CliStreams,
  cwd: string,
  helpText: string,
): number {
  if (args.kind === "help") {
    streams.stdout.write(helpText);
    return 0;
  }
  if (args.kind === "error") {
    streams.stderr.write(`${args.message}\n`);
    return 2;
  }
  if (args.kind === "agent") {
    const projectRoot = path.resolve(cwd, args.projectRoot ?? ".");
    if (args.action === "doctor") {
      streams.stdout.write(
        args.json ? renderAgentDoctorJson(projectRoot) : renderAgentDoctor(projectRoot),
      );
    } else {
      streams.stdout.write(renderCodexAgentGuide(projectRoot));
    }
    return 0;
  }

  try {
    if (args.kind === "ast-patch") {
      const projectRoot = path.resolve(cwd, args.projectRoot ?? ".");
      const packetText =
        args.packetPath === "-"
          ? (streams.stdin ?? "")
          : fs.readFileSync(path.resolve(cwd, args.packetPath), "utf8");
      streams.stdout.write(renderTypeScriptAstPatchDryRunReceiptJson(projectRoot, packetText));
      return 0;
    }
    if (args.kind === "direct-source-read") {
      const projectRoot = resolveProviderProjectRoot(cwd, args);
      const ownerPath = args.selector.replace(/^owner:/u, "").replace(/:\d+(?::\d+)?$/u, "");
      const packet = buildOwnerItemSemanticReadPacket(projectRoot, ownerPath, "", args.selector);
      streams.stdout.write(
        args.json
          ? renderOwnerItemSemanticReadPacketJson(packet)
          : renderOwnerItemSemanticReadPacket(packet),
      );
      return 0;
    }
    if (args.kind === "tree-sitter-query") {
      streams.stdout.write(
        renderTypeScriptTreeSitterQuery(resolveProviderProjectRoot(cwd, args), args),
      );
      return 0;
    }
    if (args.kind === "flow-lite-query") {
      streams.stdout.write(
        renderTypeScriptFlowLiteQuery(path.resolve(cwd, args.projectRoot ?? "."), args),
      );
      return 0;
    }
    const exhaustive: never = args;
    return exhaustive;
  } catch (error) {
    streams.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 3;
  }
}

function parseAstPatchArgs(argv: readonly string[]): ProtocolArgs {
  const mode = argv[0];
  if (mode === "--help" || mode === "-h") return { kind: "help" };
  if (mode === "apply") {
    return {
      kind: "error",
      message: "asp-typescript ast-patch apply is unavailable; use dry-run and Codex apply_patch",
    };
  }
  if (mode !== "dry-run") {
    return {
      kind: "error",
      message: "usage: asp-typescript ast-patch dry-run --packet <path-or-> [PROJECT_ROOT]",
    };
  }
  let packetPath: string | undefined;
  const positionals: string[] = [];
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--packet") {
      const value = argv[index + 1];
      if (value === undefined || (value.startsWith("-") && value !== "-")) {
        return { kind: "error", message: "--packet requires a path or -" };
      }
      packetPath = value;
      index += 1;
    } else if (arg.startsWith("-")) {
      return { kind: "error", message: `unknown ast-patch option: ${arg}` };
    } else {
      positionals.push(arg);
    }
  }
  if (packetPath === undefined) {
    return { kind: "error", message: "missing required --packet <path-or->" };
  }
  if (positionals.length > 1) {
    return { kind: "error", message: "expected at most one PROJECT_ROOT argument" };
  }
  return { kind: "ast-patch", mode, packetPath, projectRoot: positionals[0] };
}

function parseQueryArgs(argv: readonly string[]): ProtocolArgs {
  let fromHook: string | undefined;
  let projectRoot: string | undefined;
  let packagePath: string | undefined;
  let selector: string | undefined;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (["--from-hook", "--workspace", "--package", "--selector"].includes(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: `${arg} requires a value` };
      }
      if (arg === "--from-hook") fromHook = value;
      if (arg === "--workspace") projectRoot = value;
      if (arg === "--package") packagePath = value;
      if (arg === "--selector") selector = value;
      index += 1;
      continue;
    }
    return aspOwnedExactProjectionError();
  }
  if (fromHook === "direct-source-read") {
    if (selector === undefined) {
      return { kind: "error", message: "--from-hook requires --selector" };
    }
    return { kind: "direct-source-read", projectRoot, packagePath, selector, json };
  }
  return aspOwnedExactProjectionError();
}

function aspOwnedExactProjectionError(): ProtocolErrorArgs {
  return {
    kind: "error",
    message:
      "exact source projection is ASP-owned; use `asp query playbook --language typescript --selector <exact-structural-selector> --projection source|callable-skeleton --workspace <workspace-root>`",
  };
}

function resolveProviderProjectRoot(
  cwd: string,
  args: { readonly projectRoot: string | undefined; readonly packagePath?: string | undefined },
): string {
  const projectRoot = path.resolve(cwd, args.projectRoot ?? ".");
  return args.packagePath === undefined ? projectRoot : path.resolve(projectRoot, args.packagePath);
}
