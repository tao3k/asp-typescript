/** Phase 3: Parser-Naive MVP — Core Model Types */

// ── Source kinds ──────────────────────────────────────────

export type TsSourceKind = "ts" | "tsx" | "mts" | "cts";

// ── Import facts ──────────────────────────────────────────

export interface TsImportFact {
  readonly moduleSpecifier: string;
  /** Named bindings (may include default) */
  readonly names: readonly string[];
  /** "default" | "named" | "namespace" | "side-effect" */
  readonly importKind: "default" | "named" | "namespace" | "side-effect";
  /** true when `import type { ... }` */
  readonly isTypeOnly: boolean;
  readonly line: number;
}

// ── Export facts ──────────────────────────────────────────

export interface TsExportFact {
  readonly name: string;
  /** "function" | "class" | "interface" | "type" | "enum" | "variable" | "namespace" | "reexport" | "star" | "default" */
  readonly exportKind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "variable"
    | "namespace"
    | "reexport"
    | "star"
    | "default";
  readonly isTypeOnly: boolean;
  readonly line: number;
  /** Source module specifier for re-exports */
  readonly reexportSource?: string;
}

// ── Public item facts ─────────────────────────────────────

export interface TsPublicItemFact {
  readonly name: string;
  /** "function" | "class" | "interface" | "type" | "enum" | "variable" | "namespace" */
  readonly itemKind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "variable"
    | "namespace";
  readonly exported: boolean;
  readonly line: number;
}

// ── Function shape facts ──────────────────────────────────

export interface TsFunctionShapeFact {
  readonly name: string;
  readonly exported: boolean;
  readonly async: boolean;
  readonly line: number;
  /** Number of lines the function body spans */
  readonly lineSpan: number;
  /** Total statement count in function body */
  readonly statementCount: number;
  /** Maximum nesting depth (blocks / if / for / while / try) */
  readonly maxNestingDepth: number;
  /** Branch count: if/else if/else/switch-case/ternary */
  readonly branchCount: number;
  /** Loop count: for/for-of/for-in/while/do-while */
  readonly loopCount: number;
  /** Number of `await` expressions */
  readonly awaitCount: number;
  /** Number of try-catch / try-finally blocks */
  readonly tryCatchCount: number;
  /** Count of boolean-typed parameters */
  readonly booleanParamCount: number;
  /** Count of positional (non-destructured, non-rest) parameters */
  readonly positionalParamCount: number;
  /** Function body or return type uses `any` */
  readonly usesAny: boolean;
  /** Function body or return type uses `unknown` */
  readonly usesUnknown: boolean;
  /** Return type is an anonymous tuple e.g. `[string, number]` */
  readonly returnsAnonymousTuple: boolean;
}

// ── React facts ───────────────────────────────────────────

export type TsReactFact = TsReactComponentFact | TsReactHookFact | TsReactEffectFact;

export interface TsReactComponentFact {
  readonly factKind: "component";
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /** true when component starts with uppercase */
  readonly isComponent: boolean;
  /** Hook calls found in body */
  readonly hookCalls: readonly string[];
  /** useEffect / useLayoutEffect calls found */
  readonly effectCalls: readonly string[];
}

export interface TsReactHookFact {
  readonly factKind: "hook";
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /** Hook dependencies (names referenced in body) */
  readonly dependencies: readonly string[];
}

export interface TsReactEffectFact {
  readonly factKind: "effect-call";
  /** The containing function name */
  readonly ownerName: string;
  /** "useEffect" | "useLayoutEffect" | "useInsertionEffect" */
  readonly effectName: string;
  readonly line: number;
}

// ── Effect-TS facts ───────────────────────────────────────

export type TsEffectFact =
  | TsEffectRuntimeFact
  | TsEffectLayerFact
  | TsEffectContextFact
  | TsEffectTagFact
  | TsEffectSchemaFact;

export interface TsEffectRuntimeFact {
  readonly factKind: "runtime";
  /** "Effect.runPromise" | "Effect.runSync" | "Runtime.runPromise" etc. */
  readonly callee: string;
  readonly line: number;
}

export interface TsEffectLayerFact {
  readonly factKind: "layer";
  /** Variable/function name of the layer builder */
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
}

export interface TsEffectContextFact {
  readonly factKind: "context";
  /** Variable/function name of the context tag */
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
}

export interface TsEffectTagFact {
  readonly factKind: "tag";
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
}

export interface TsEffectSchemaFact {
  readonly factKind: "schema";
  /** Schema variable/function name */
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  /** Schema struct field names */
  readonly fields: readonly string[];
}

// ── Parsed module ─────────────────────────────────────────

export interface TsParsedModule {
  readonly path: string;
  readonly isValid: boolean;
  readonly parseError?: string;

  readonly sourceKind: TsSourceKind;

  /** Full source text — populated by parser for rule reuse. */
  readonly sourceText?: string;

  readonly imports: readonly TsImportFact[];
  readonly exports: readonly TsExportFact[];
  readonly publicItems: readonly TsPublicItemFact[];
  readonly functions: readonly TsFunctionShapeFact[];

  readonly reactFacts: readonly TsReactFact[];
  readonly effectFacts: readonly TsEffectFact[];
}

// ── Module role ────────────────────────────────────────────

export type TsModuleRole =
  | "facade"
  | "entrypoint"
  | "test-entrypoint"
  | "branch"
  | "leaf"
  | "react-component"
  | "react-hook"
  | "effect-service"
  | "effect-layer"
  | "config"
  | "internal";

// ── Owner branch ───────────────────────────────────────────

export interface TsOwnerBranch {
  /** Primary source path for this owner */
  readonly path: string;
  /** Owner namespace (e.g. "parser", "react/panel") */
  readonly owner: string;
  readonly role: TsModuleRole;
  /** All module paths grouped under this owner */
  readonly modules: readonly string[];
  /** Whether this owner is a project root (no inbound structural deps) */
  readonly isRoot: boolean;
}

// ── Owner dependency ───────────────────────────────────────

export interface TsOwnerDependency {
  readonly fromOwner: string;
  readonly toOwner: string;
  /** "owner" = structural module dependency, "layer" = effect layer dep */
  readonly edgeKind: "owner" | "layer";
  /** Number of import edges backing this dependency */
  readonly weight: number;
}

// ── Finding group ──────────────────────────────────────────

export interface TsFindingGroup {
  readonly ruleId: string;
  readonly severity: "error" | "info";
  readonly count: number;
  readonly firstTarget: string;
  readonly message: string;
}

// ── Agent snapshot ─────────────────────────────────────────

export interface TsAgentSnapshot {
  readonly projectRoot: string;
  readonly moduleCount: number;
  readonly rootCount: number;
  readonly branchCount: number;
  readonly dependencyCount: number;
  readonly ownerBranches: readonly TsOwnerBranch[];
  readonly ownerDependencies: readonly TsOwnerDependency[];
  readonly findingGroups: readonly TsFindingGroup[];
}

// ── Compact finding (rust-ASP TypeScript contract) ────────────────

export interface TsCompactFinding {
  readonly ruleId: string;
  readonly severity: "Error" | "Info";
  readonly title: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  /** Short repair command */
  readonly fix: string;
  /** The source line text */
  readonly sourceLine: string;
  /** Concrete parser fact */
  readonly help: string;
  /** Stable rule requirement */
  readonly contract: string;
}

export type TsCompactOutput = string;

// ── Project-level aggregate ────────────────────────────────

export interface TsParsedProject {
  readonly projectRoot: string;
  readonly modules: readonly TsParsedModule[];
}
