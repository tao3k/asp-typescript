/**
 * Tree-sitter query argument parsing for the asp-typescript CLI.
 */

import type {
  SyntaxQueryPlan,
  SyntaxQueryPredicate,
  SyntaxQueryPredicateOp,
  SyntaxQueryPredicateValue,
} from "../parser/native_syntax/tree-sitter-query.js";

export interface TreeSitterQueryArgs {
  readonly kind: "tree-sitter-query";
  readonly catalogId: string | undefined;
  readonly treeSitterQuery: string | undefined;
  readonly terms: readonly string[];
  readonly selector: string | undefined;
  readonly aspSyntaxQueryPlan: SyntaxQueryPlan | undefined;
  readonly projectRoot: string | undefined;
  readonly packagePath: string | undefined;
  readonly workspace: boolean;
  readonly json: boolean;
}

export type TreeSitterQueryParseResult =
  | TreeSitterQueryArgs
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

interface MutableSyntaxQueryPlan {
  captures: readonly string[];
  nodeTypes: readonly string[];
  fields: readonly string[];
  predicates: readonly SyntaxQueryPredicate[];
}

interface TreeSitterQueryParseState {
  catalogId: string | undefined;
  treeSitterQuery: string | undefined;
  selector: string | undefined;
  packagePath: string | undefined;
  workspace: boolean;
  workspaceRoot: string | undefined;
  aspSyntaxQueryPlan: MutableSyntaxQueryPlan | undefined;
  json: boolean;
  terms: string[];
  positionals: string[];
}

type TreeSitterQueryOptionParseResult =
  | TreeSitterQueryParseState
  | { readonly kind: "error"; readonly message: string };

export function parseTreeSitterQueryArgs(argv: readonly string[]): TreeSitterQueryParseResult {
  if (argv[0] === "--help" || argv[0] === "-h") return { kind: "help" };
  const parsed = parseTreeSitterQueryOptions(argv);
  if ("kind" in parsed) return parsed;
  return finalizeTreeSitterQueryArgs(parsed);
}

export function isTreeSitterQueryArgs(argv: readonly string[]): boolean {
  return argv.includes("--treesitter-query") || argv.includes("--catalog");
}

function parseTreeSitterQueryOptions(argv: readonly string[]): TreeSitterQueryOptionParseResult {
  const state = initialTreeSitterQueryParseState();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--catalog") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: "--catalog requires a catalog id" };
      }
      state.catalogId = value;
      index += 1;
    } else if (arg === "--treesitter-query") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: "--treesitter-query requires a query expression" };
      }
      state.treeSitterQuery = value;
      index += 1;
    } else if (arg === "--term" || arg === "--query") {
      const value = argv[index + 1];
      if (value === undefined) return { kind: "error", message: `${arg} requires a value` };
      state.terms.push(
        ...(arg === "--query"
          ? value
              .split("|")
              .map((term) => term.trim())
              .filter((term) => term.length > 0)
          : [value]),
      );
      index += 1;
    } else if (arg === "--selector") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: "--selector requires a selector" };
      }
      state.selector = value;
      index += 1;
    } else if (arg === "--package") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: "--package requires a package path" };
      }
      state.packagePath = value;
      index += 1;
    } else if (arg === "--workspace") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: "--workspace requires a workspace root" };
      }
      state.workspace = true;
      state.workspaceRoot = value;
      index += 1;
    } else if (isAspSyntaxQueryPlanOption(arg)) {
      const value = argv[index + 1];
      if (value === undefined) {
        return { kind: "error", message: `${arg} requires an ASP query plan value` };
      }
      const updated = updateAspSyntaxQueryPlan(state.aspSyntaxQueryPlan, arg, value);
      if ("kind" in updated) return updated;
      state.aspSyntaxQueryPlan = updated;
      index += 1;
    } else if (arg === "--json") {
      state.json = true;
    } else if (arg.startsWith("-")) {
      return { kind: "error", message: `unknown tree-sitter query option: ${arg}` };
    } else {
      state.positionals.push(arg);
    }
  }
  return state;
}

function initialTreeSitterQueryParseState(): TreeSitterQueryParseState {
  return {
    catalogId: undefined,
    treeSitterQuery: undefined,
    selector: undefined,
    packagePath: undefined,
    workspace: false,
    workspaceRoot: undefined,
    aspSyntaxQueryPlan: undefined,
    json: false,
    terms: [],
    positionals: [],
  };
}

function finalizeTreeSitterQueryArgs(state: TreeSitterQueryParseState): TreeSitterQueryParseResult {
  const {
    catalogId,
    treeSitterQuery,
    terms,
    selector,
    aspSyntaxQueryPlan,
    positionals,
    packagePath,
    workspace,
    workspaceRoot,
    json,
  } = state;
  if ((catalogId === undefined) === (treeSitterQuery === undefined)) {
    return {
      kind: "error",
      message: "query requires exactly one of --catalog or --treesitter-query",
    };
  }
  const positionalWorkspace = positionalWorkspaceRoot(positionals, workspaceRoot);
  if ("kind" in positionalWorkspace) {
    return positionalWorkspace;
  }
  const projectRoot = workspaceRoot ?? positionalWorkspace.value;
  if (positionals.length > 0 && workspaceRoot !== undefined) {
    return {
      kind: "error",
      message: "query does not accept positional WORKSPACE; use --workspace <workspace-root>",
    };
  }
  return {
    kind: "tree-sitter-query",
    catalogId,
    treeSitterQuery,
    terms,
    selector,
    aspSyntaxQueryPlan,
    projectRoot,
    packagePath,
    workspace: workspace || projectRoot !== undefined,
    json,
  };
}

function positionalWorkspaceRoot(
  positionals: readonly string[],
  workspaceRoot: string | undefined,
): { readonly value: string | undefined } | { readonly kind: "error"; readonly message: string } {
  if (positionals.length === 0) return { value: undefined };
  if (workspaceRoot !== undefined) {
    return {
      kind: "error",
      message: "query does not accept positional WORKSPACE; use --workspace <workspace-root>",
    };
  }
  if (positionals.length === 1) return { value: positionals[0] };
  return {
    kind: "error",
    message: "query accepts at most one positional WORKSPACE",
  };
}

function isAspSyntaxQueryPlanOption(arg: string): boolean {
  return (
    arg === "--asp-syntax-query-captures" ||
    arg === "--asp-syntax-query-node-types" ||
    arg === "--asp-syntax-query-fields" ||
    arg === "--asp-syntax-query-predicates-json"
  );
}

function updateAspSyntaxQueryPlan(
  current: MutableSyntaxQueryPlan | undefined,
  arg: string,
  value: string,
): MutableSyntaxQueryPlan | { readonly kind: "error"; readonly message: string } {
  const plan = current ?? { captures: [], nodeTypes: [], fields: [], predicates: [] };
  if (arg === "--asp-syntax-query-captures") {
    return { ...plan, captures: splitAspSyntaxQueryPlanList(value) };
  }
  if (arg === "--asp-syntax-query-node-types") {
    return { ...plan, nodeTypes: splitAspSyntaxQueryPlanList(value) };
  }
  if (arg === "--asp-syntax-query-fields") {
    return { ...plan, fields: splitAspSyntaxQueryPlanList(value) };
  }
  try {
    return { ...plan, predicates: parseAspSyntaxQueryPredicatesJson(value) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "error", message: `invalid ASP syntax query predicates: ${message}` };
  }
}

function splitAspSyntaxQueryPlanList(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function parseAspSyntaxQueryPredicatesJson(value: string): readonly SyntaxQueryPredicate[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("expected predicate array");
  }
  return parsed.map((predicate, index) => parseAspSyntaxQueryPredicate(predicate, index));
}

function parseAspSyntaxQueryPredicate(value: unknown, index: number): SyntaxQueryPredicate {
  if (!isRecord(value)) {
    throw new Error(`predicate ${index} must be an object`);
  }
  const op = syntaxPredicateOp(value.op, index);
  const capture = stringField(value.capture, `predicate ${index}.capture`);
  const values = value.values;
  if (!Array.isArray(values)) {
    throw new Error(`predicate ${index}.values must be an array`);
  }
  return {
    op,
    capture,
    values: values.map((operand, operandIndex) =>
      parseAspSyntaxQueryPredicateValue(operand, index, operandIndex),
    ),
  };
}

function parseAspSyntaxQueryPredicateValue(
  value: unknown,
  predicateIndex: number,
  operandIndex: number,
): SyntaxQueryPredicateValue {
  if (!isRecord(value)) {
    throw new Error(`predicate ${predicateIndex}.values[${operandIndex}] must be an object`);
  }
  const kind = stringField(value.kind, `predicate ${predicateIndex}.values[${operandIndex}].kind`);
  if (kind !== "string" && kind !== "capture") {
    throw new Error(`predicate ${predicateIndex}.values[${operandIndex}].kind is unsupported`);
  }
  return {
    kind,
    value: stringField(value.value, `predicate ${predicateIndex}.values[${operandIndex}].value`),
  };
}

function syntaxPredicateOp(value: unknown, index: number): SyntaxQueryPredicateOp {
  const op = stringField(value, `predicate ${index}.op`);
  if (
    op === "eq" ||
    op === "any-eq" ||
    op === "any-of" ||
    op === "match" ||
    op === "any-match" ||
    op === "not-eq" ||
    op === "not-match"
  ) {
    return op;
  }
  throw new Error(`predicate ${index}.op is unsupported`);
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
