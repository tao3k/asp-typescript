/**
 * Agent subcommand parsing and doctor rendering for the asp-typescript protocol CLI.
 *
 * This module keeps agent-specific argument handling out of the main protocol
 * dispatcher while preserving the CLI response shape consumed by Codex hooks.
 */
import {
  SEMANTIC_LANGUAGE_PROTOCOL_ID,
  SEMANTIC_LANGUAGE_REGISTRY_VERSION,
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
  typeScriptSemanticLanguageRegistration,
} from "./semantic-language.js";
import { semanticProviderDoctorDocument } from "./semantic-provider-doctor.js";

export type AgentArgs = AgentDoctorArgs | AgentGuideArgs;

interface AgentDoctorArgs {
  readonly kind: "agent";
  readonly action: "doctor";
  readonly projectRoot: string | undefined;
  readonly json: boolean;
}

interface AgentGuideArgs {
  readonly kind: "agent";
  readonly action: "guide";
  readonly projectRoot: string | undefined;
}

export function parseAgentArgs(argv: readonly string[]): AgentArgs | ProtocolAgentErrorArgs {
  const action = argv[0] ?? "doctor";
  if (action === "install" || action === "hook") {
    const replacement =
      action === "install" ? "asp hook install --client codex" : "asp hook <event> --client codex";
    return {
      kind: "error",
      message: `asp-typescript agent ${action} moved to asp; use ${replacement}`,
    };
  }
  if (action === "guide") return parseAgentGuideArgs(argv.slice(1));
  if (action !== "doctor") return { kind: "error", message: `unknown agent action: ${action}` };
  let json = false;
  const positionals: string[] = [];
  for (const arg of argv.slice(1)) {
    if (arg === "--json") {
      json = true;
    } else if (arg === "--help" || arg === "-h") {
      continue;
    } else if (arg.startsWith("-")) {
      return { kind: "error", message: `unknown agent option: ${arg}` };
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length > 1) {
    return { kind: "error", message: "expected at most one PROJECT_ROOT argument" };
  }
  return { kind: "agent", action: "doctor", projectRoot: positionals[0], json };
}

export function renderAgentDoctor(projectRoot: string): string {
  const registration = typeScriptSemanticLanguageRegistration();
  return (
    [
      `[agent-doctor] status=ok protocol=${SEMANTIC_LANGUAGE_PROTOCOL_ID} registry=semantic-language-registry.v${SEMANTIC_LANGUAGE_REGISTRY_VERSION}`,
      `|project ${projectRoot}`,
      `|language id=${TYPE_SCRIPT_LANGUAGE_ID} provider=${TYPE_SCRIPT_PROVIDER_ID} binary=${TYPE_SCRIPT_BINARY}`,
      `|namespace ${TYPE_SCRIPT_PROVIDER_NAMESPACE}`,
      `|method ${registration.methods.join(",")}`,
      "|schema semantic-search-packet.v1",
    ].join("\n") + "\n"
  );
}

export function renderAgentDoctorJson(projectRoot: string): string {
  void projectRoot;
  return `${JSON.stringify(semanticProviderDoctorDocument())}\n`;
}

interface ProtocolAgentErrorArgs {
  readonly kind: "error";
  readonly message: string;
}

function parseAgentGuideArgs(argv: readonly string[]): AgentArgs | ProtocolAgentErrorArgs {
  const parsed = parseAgentGuidePositionals(argv);
  if (parsed.error !== undefined) return { kind: "error", message: parsed.error };
  if (parsed.positionals.length > 1) {
    return { kind: "error", message: "expected at most one PROJECT_ROOT argument" };
  }
  return {
    kind: "agent",
    action: "guide",
    projectRoot: parsed.positionals[0],
  };
}

function parseAgentGuidePositionals(argv: readonly string[]): {
  readonly positionals: readonly string[];
  readonly error?: string;
} {
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--client") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { positionals, error: "--client requires a client name" };
      }
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      continue;
    } else if (arg.startsWith("-")) {
      return { positionals, error: `unknown agent option: ${arg}` };
    } else {
      positionals.push(arg);
    }
  }
  return { positionals };
}
