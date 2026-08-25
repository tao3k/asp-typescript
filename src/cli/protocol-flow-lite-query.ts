/**
 * Flow-lite query catalog compatibility for the asp-typescript CLI.
 */

import path from "node:path";

import {
  evaluateTypeScriptFlowLiteQuery,
  type FlowLiteOccurrence,
  type FlowLiteResult,
  type FlowLiteWhere,
} from "../parser/flow-lite.js";
import { TYPE_SCRIPT_LANGUAGE_ID, TYPE_SCRIPT_PROVIDER_ID } from "./semantic-language.js";

export type { FlowLiteWhere } from "../parser/flow-lite.js";

const FLOW_LITE_CATALOG_ID = "flow-lite";
const FLOW_LITE_FLOW_KIND = "local-source-sink";

export interface FlowLiteQueryArgs {
  readonly kind: "flow-lite-query";
  readonly catalogId: string;
  readonly where: FlowLiteWhere;
  readonly projectRoot: string | undefined;
  readonly workspace: boolean;
  readonly json: boolean;
}

export type FlowLiteQueryParseResult =
  | FlowLiteQueryArgs
  | { readonly kind: "help" }
  | FlowLiteParseError;

type FlowLiteParseError = { readonly kind: "error"; readonly message: string };
type FlowLiteArgConsumeResult =
  | { readonly kind: "ok"; readonly nextIndex: number }
  | FlowLiteParseError;

interface FlowLiteQueryParseState {
  catalogId: string | undefined;
  whereExpr: string | undefined;
  workspace: boolean;
  workspaceRoot: string | undefined;
  json: boolean;
  positionals: string[];
}

export function isFlowLiteQueryArgs(argv: readonly string[]): boolean {
  return argv.some((arg, index) => {
    if (arg === "--catalog") return argv[index + 1] === FLOW_LITE_CATALOG_ID;
    return arg === `--catalog=${FLOW_LITE_CATALOG_ID}`;
  });
}

export function parseFlowLiteQueryArgs(argv: readonly string[]): FlowLiteQueryParseResult {
  if (argv[0] === "--help" || argv[0] === "-h") return { kind: "help" };
  const state: FlowLiteQueryParseState = {
    catalogId: undefined,
    whereExpr: undefined,
    workspace: false,
    workspaceRoot: undefined,
    json: false,
    positionals: [],
  };

  for (let index = 0; index < argv.length; index++) {
    const consumed = consumeFlowLiteArg(argv, index, state);
    if (consumed.kind === "error") return consumed;
    index = consumed.nextIndex;
  }

  if (state.catalogId !== FLOW_LITE_CATALOG_ID) {
    return { kind: "error", message: "query flow-lite dispatch requires --catalog flow-lite" };
  }
  const positionalWorkspace = positionalFlowLiteWorkspaceRoot(
    state.positionals,
    state.workspaceRoot,
  );
  if ("kind" in positionalWorkspace) return positionalWorkspace;
  const projectRoot = state.workspaceRoot ?? positionalWorkspace.value;
  if (state.positionals.length > 0 && state.workspaceRoot !== undefined) {
    return {
      kind: "error",
      message:
        "query --catalog flow-lite does not accept positional WORKSPACE; use --workspace <workspace-root>",
    };
  }
  if (state.whereExpr === undefined) {
    return { kind: "error", message: "query --catalog flow-lite requires --where" };
  }
  const where = parseFlowLiteWhere(state.whereExpr);
  if ("kind" in where) return where;
  return {
    kind: "flow-lite-query",
    catalogId: state.catalogId,
    where,
    projectRoot,
    workspace: state.workspace || projectRoot !== undefined,
    json: state.json,
  };
}

function positionalFlowLiteWorkspaceRoot(
  positionals: readonly string[],
  workspaceRoot: string | undefined,
): { readonly value: string | undefined } | FlowLiteParseError {
  if (positionals.length === 0) return { value: undefined };
  if (workspaceRoot !== undefined) {
    return {
      kind: "error",
      message:
        "query --catalog flow-lite does not accept positional WORKSPACE; use --workspace <workspace-root>",
    };
  }
  if (positionals.length === 1) return { value: positionals[0] };
  return {
    kind: "error",
    message: "query --catalog flow-lite accepts at most one positional WORKSPACE",
  };
}

function consumeFlowLiteArg(
  argv: readonly string[],
  index: number,
  state: FlowLiteQueryParseState,
): FlowLiteArgConsumeResult {
  const arg = argv[index]!;
  if (arg === "--catalog") {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("-")) {
      return { kind: "error", message: "--catalog requires a catalog id" };
    }
    state.catalogId = value;
    return { kind: "ok", nextIndex: index + 1 };
  }
  if (arg.startsWith("--catalog=")) {
    state.catalogId = arg.slice("--catalog=".length);
    return { kind: "ok", nextIndex: index };
  }
  if (arg === "--where") {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("-")) {
      return { kind: "error", message: "query --catalog flow-lite requires --where" };
    }
    state.whereExpr = value;
    return { kind: "ok", nextIndex: index + 1 };
  }
  if (arg.startsWith("--where=")) {
    state.whereExpr = arg.slice("--where=".length);
    return { kind: "ok", nextIndex: index };
  }
  if (arg === "--json") {
    state.json = true;
    return { kind: "ok", nextIndex: index };
  }
  if (arg === "--workspace") {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("-")) {
      return { kind: "error", message: "--workspace requires a workspace root" };
    }
    state.workspace = true;
    state.workspaceRoot = value;
    return { kind: "ok", nextIndex: index + 1 };
  }
  if (arg.startsWith("-")) {
    return { kind: "error", message: `unsupported flow-lite query option: ${arg}` };
  }
  state.positionals.push(arg);
  return { kind: "ok", nextIndex: index };
}

export function renderTypeScriptFlowLiteQuery(
  projectRoot: string,
  args: FlowLiteQueryArgs,
): string {
  const result = evaluateTypeScriptFlowLiteQuery(projectRoot, args.where);
  return args.json
    ? JSON.stringify(flowLitePacket(projectRoot, args, result))
    : flowLiteFrontier(projectRoot, args, result);
}

function parseFlowLiteWhere(
  value: string,
): FlowLiteWhere | { readonly kind: "error"; readonly message: string } {
  let sourceCall: string | undefined;
  let sinkConstructs: string | undefined;
  let scopeFn: string | undefined;

  for (const constraint of value.split(/\s+/u).filter(Boolean)) {
    const [key, rawValue, ...extra] = constraint.split("=");
    if (key === undefined || rawValue === undefined || extra.length > 0) {
      return { kind: "error", message: `invalid flow-lite --where constraint \`${constraint}\`` };
    }
    if (rawValue.trim() === "") {
      return { kind: "error", message: `flow-lite --where key \`${key}\` has an empty value` };
    }
    if (key === "source.call") {
      if (sourceCall !== undefined) return duplicateFlowLiteWhereKey(key);
      sourceCall = rawValue;
    } else if (key === "sink.constructs") {
      if (sinkConstructs !== undefined) return duplicateFlowLiteWhereKey(key);
      sinkConstructs = rawValue;
    } else if (key === "scope.fn") {
      if (scopeFn !== undefined) return duplicateFlowLiteWhereKey(key);
      scopeFn = rawValue;
    } else {
      return {
        kind: "error",
        message:
          `unsupported flow-lite --where key \`${key}\`; ` +
          "supported keys are source.call,sink.constructs,scope.fn",
      };
    }
  }

  if (sourceCall === undefined) {
    return { kind: "error", message: "flow-lite --where requires source.call" };
  }
  if (sinkConstructs === undefined) {
    return { kind: "error", message: "flow-lite --where requires sink.constructs" };
  }
  if (scopeFn === undefined) {
    return { kind: "error", message: "flow-lite --where requires scope.fn" };
  }
  return { sourceCall, sinkConstructs, scopeFn };
}

function duplicateFlowLiteWhereKey(key: string): {
  readonly kind: "error";
  readonly message: string;
} {
  return { kind: "error", message: `duplicate flow-lite --where key \`${key}\`` };
}

function flowLiteFrontier(
  projectRoot: string,
  args: FlowLiteQueryArgs,
  result: FlowLiteResult,
): string {
  const confidence = flowLiteConfidence(result);
  return [
    `[query-flow-lite] root=${projectRoot} lang=typescript catalog=flow-lite flow=${FLOW_LITE_FLOW_KIND} scope=fn(${args.where.scopeFn}) alg=native-flow-lite`,
    "legend: ID=kind:role(value)!next; edge SRC>{DST:rel}; frontier ID.next",
    "aliases=G:query,F:flow,S:source,K:sink,P:path",
    "",
    `F=flow:local-source-sink(fn:${args.where.scopeFn})!flow`,
    ...(result.source === undefined
      ? []
      : [
          `S=source:${result.source.kind}(${result.source.value})@${result.source.path}:${result.source.line}!code`,
        ]),
    ...(result.sink === undefined
      ? []
      : [
          `K=sink:${result.sink.kind}(${result.sink.value})@${result.sink.path}:${result.sink.line}!code`,
        ]),
    result.source !== undefined && result.sink !== undefined
      ? "P=path:bounded(S->K)!flow"
      : `P=path:unavailable(fn:${args.where.scopeFn})!flow`,
    "",
    "G>{F:selects}",
    flowLiteEdges(result),
    "",
    `confidence=${confidence} sourceAuthority=native-parser executionBackend=native-parser adapterMode=native-projection owner=${result.ownerPath} range=${result.functionStart}:${result.functionEnd} scannedFiles=${result.scannedFiles}`,
    `rank=${flowLiteRank(result)}`,
    `frontier=${flowLiteFrontierIds(result)}`,
    "omit=code,full-path-ast,raw-source",
    "avoid=raw-read,inline-code",
    ...(confidence === "bounded"
      ? []
      : [
          `note=${flowLiteOmissions(args.where, result)
            .map((omission) => omission.message)
            .join(";")}`,
        ]),
  ].join("\n");
}

function flowLitePacket(
  projectRoot: string,
  args: FlowLiteQueryArgs,
  result: FlowLiteResult,
): Record<string, unknown> {
  const sourceHandle = result.source?.handle ?? `call:${args.where.sourceCall}`;
  const sinkHandle = result.sink?.handle ?? `constructs:${args.where.sinkConstructs}`;
  const pathSteps: Record<string, unknown>[] = [];
  if (result.source !== undefined) {
    pathSteps.push(flowLitePathStep("step.1", result.source, "source"));
  }
  if (result.sink !== undefined) {
    pathSteps.push(flowLitePathStep("step.2", result.sink, "sink"));
  }
  if (result.source !== undefined && result.sink !== undefined) {
    pathSteps.push({
      id: "step.3",
      handle: result.sink.handle,
      relation: "flows-to",
      location: {
        path: result.sink.path,
        lineRange: lineRange(result.sink.line),
      },
      evidenceRefs: ["native-flow-lite.1"],
      fields: {
        from: result.source.handle,
        to: result.sink.handle,
        scopeFn: args.where.scopeFn,
      },
    });
  }
  return {
    schemaId: "agent.semantic-protocols.semantic-flow-lite",
    schemaVersion: "1",
    protocolId: "agent.semantic-protocols.semantic-language",
    protocolVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    projectRoot,
    packageName: path.basename(projectRoot),
    flowId: `flow-lite:${result.ownerPath}:${args.where.scopeFn}:${args.where.sourceCall}:${args.where.sinkConstructs}`,
    flowKind: FLOW_LITE_FLOW_KIND,
    scope: "function",
    ownerPath: result.ownerPath,
    sourceAuthority: "native-parser",
    executionBackend: "native-parser",
    adapterMode: "native-projection",
    sourceHandle,
    sinkHandle,
    path: pathSteps,
    guards: [],
    effects: [],
    artifacts: [],
    confidence: flowLiteConfidence(result),
    omissions: flowLiteOmissions(args.where, result),
    fields: {
      catalog: FLOW_LITE_CATALOG_ID,
      where: {
        "source.call": args.where.sourceCall,
        "sink.constructs": args.where.sinkConstructs,
        "scope.fn": args.where.scopeFn,
      },
      scannedFiles: result.scannedFiles,
      rawSourceStored: false,
    },
  };
}

function flowLitePathStep(
  id: string,
  occurrence: FlowLiteOccurrence,
  relation: "source" | "sink",
): Record<string, unknown> {
  return {
    id,
    handle: occurrence.handle,
    relation,
    location: {
      path: occurrence.path,
      lineRange: lineRange(occurrence.line),
    },
    evidenceRefs: ["native-flow-lite.1"],
    fields: {
      value: occurrence.value,
      kind: occurrence.kind,
    },
  };
}

function flowLiteEdges(result: FlowLiteResult): string {
  if (result.source !== undefined && result.sink !== undefined) {
    return "F>{S:source,K:sink,P:flows-to}\nS>{K:flows-to}";
  }
  if (result.source !== undefined) return "F>{S:source,P:unavailable}";
  if (result.sink !== undefined) return "F>{K:sink,P:unavailable}";
  return "F>{P:unavailable}";
}

function flowLiteRank(result: FlowLiteResult): string {
  const ids = [
    ...(result.source === undefined ? [] : ["S"]),
    ...(result.sink === undefined ? [] : ["K"]),
    "P",
  ];
  return ids.join(",");
}

function flowLiteFrontierIds(result: FlowLiteResult): string {
  const ids = [
    ...(result.source === undefined ? [] : ["S.code"]),
    ...(result.sink === undefined ? [] : ["K.code"]),
    "P.flow",
  ];
  return ids.join(",");
}

function flowLiteConfidence(result: FlowLiteResult): "bounded" | "partial" | "unavailable" {
  if (result.source !== undefined && result.sink !== undefined) return "bounded";
  if (result.ownerPath !== "." && (result.source !== undefined || result.sink !== undefined)) {
    return "partial";
  }
  return "unavailable";
}

function flowLiteOmissions(
  where: FlowLiteWhere,
  result: FlowLiteResult,
): readonly Record<string, unknown>[] {
  const omissions: Record<string, unknown>[] = [];
  if (result.ownerPath === ".") {
    return [
      {
        kind: "unavailable",
        message: `scope.fn \`${where.scopeFn}\` was not found`,
        target: "scope.fn",
      },
    ];
  }
  if (result.source === undefined) {
    omissions.push({
      kind: "unavailable",
      message: `source.call \`${where.sourceCall}\` was not found in scope.fn \`${where.scopeFn}\``,
      target: "source.call",
    });
  }
  if (result.sink === undefined) {
    omissions.push({
      kind: "unavailable",
      message: `sink.constructs \`${where.sinkConstructs}\` was not found in scope.fn \`${where.scopeFn}\``,
      target: "sink.constructs",
    });
  }
  return omissions;
}

function lineRange(line: number): Record<string, number> {
  return { start: line, end: line };
}
