/**
 * Semantic language registry metadata for the TypeScript provider.
 */

export const SEMANTIC_LANGUAGE_REGISTRY_ID =
  "agent.semantic-protocols.semantic-language-registry" as const;
export const SEMANTIC_LANGUAGE_REGISTRY_VERSION = "1" as const;
export const SEMANTIC_LANGUAGE_PROTOCOL_ID = "agent.semantic-protocols.semantic-language" as const;
export const SEMANTIC_LANGUAGE_PROTOCOL_VERSION = "1" as const;
export const SEMANTIC_SEARCH_PACKET_SCHEMA_ID =
  "agent.semantic-protocols.semantic-search-packet" as const;
export const SEMANTIC_QUERY_PACKET_SCHEMA_ID =
  "agent.semantic-protocols.semantic-query-packet" as const;
export const SEMANTIC_READ_PACKET_SCHEMA_ID =
  "agent.semantic-protocols.semantic-read-packet" as const;
export const SEMANTIC_SOURCE_LOCATION_SCHEMA_ID =
  "agent.semantic-protocols.semantic-source-location" as const;
export const SEMANTIC_TREE_SITTER_PROVENANCE_SCHEMA_ID =
  "agent.semantic-protocols.semantic-tree-sitter-provenance" as const;
export const SEMANTIC_TREE_SITTER_QUERY_SCHEMA_ID =
  "agent.semantic-protocols.semantic-tree-sitter-query" as const;
export const SEMANTIC_TREE_SITTER_GRAMMAR_PROFILE_SCHEMA_ID =
  "agent.semantic-protocols.semantic-tree-sitter-grammar-profile" as const;
export const SEMANTIC_GRAPH_SCHEMA_ID = "agent.semantic-protocols.semantic-graph" as const;
export const SEMANTIC_GRAPH_TURBO_REQUEST_SCHEMA_ID =
  "agent.semantic-protocols.semantic-graph-turbo-request" as const;
export const SEMANTIC_FACT_GRAPH_SCHEMA_ID =
  "agent.semantic-protocols.semantic-fact-graph" as const;
export const SEMANTIC_FACT_ONTOLOGY_SCHEMA_ID =
  "agent.semantic-protocols.semantic-fact-ontology" as const;
export const SEMANTIC_VERIFICATION_RECEIPT_SCHEMA_ID =
  "agent.semantic-protocols.semantic-verification-receipt" as const;
export const SEMANTIC_BEHAVIOR_SNAPSHOT_SCHEMA_ID =
  "agent.semantic-protocols.semantic-behavior-snapshot" as const;
export const SEMANTIC_DETERMINISM_READINESS_SCHEMA_ID =
  "agent.semantic-protocols.semantic-determinism-readiness" as const;
export const SEMANTIC_DEV_COMMAND_LOG_SCHEMA_ID =
  "agent.semantic-protocols.dev-command-log" as const;
export const SEMANTIC_FORMAL_PROOF_PILOT_SCHEMA_ID =
  "agent.semantic-protocols.semantic-formal-proof-pilot" as const;
export const SEMANTIC_REVIEW_PACKET_SCHEMA_ID =
  "agent.semantic-protocols.semantic-review-packet" as const;
export const SEMANTIC_EVIDENCE_GRAPH_SCHEMA_ID =
  "agent.semantic-protocols.semantic-evidence-graph" as const;
export const SEMANTIC_ASSURANCE_CASE_SCHEMA_ID =
  "agent.semantic-protocols.semantic-assurance-case" as const;
export const SEMANTIC_AST_PATCH_SCHEMA_ID = "agent.semantic-protocols.semantic-ast-patch" as const;
export const SEMANTIC_AST_PATCH_RECEIPT_SCHEMA_ID =
  "agent.semantic-protocols.semantic-ast-patch-receipt" as const;
import {
  TYPE_SCRIPT_PROVIDER_DESCRIPTOR,
  TYPE_SCRIPT_PROVIDER_REGISTRATION,
} from "./provider-descriptor.js";

export const TYPE_SCRIPT_CAPABILITIES_SCHEMA_ID = `${TYPE_SCRIPT_PROVIDER_DESCRIPTOR.namespace}.capabilities`;
const SEMANTIC_TYPE_SURFACE_SCHEMA_ID = "agent.semantic-protocols.semantic-type-surface" as const;
const SEMANTIC_HANDLE_SCHEMA_ID = "agent.semantic-protocols.semantic-handle" as const;
export const TYPE_SCRIPT_LANGUAGE_ID = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.languageId;
export const TYPE_SCRIPT_PROVIDER_ID = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.providerId;
export const TYPE_SCRIPT_BINARY = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.binary;
export const TYPE_SCRIPT_PROVIDER_NAMESPACE = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.namespace;

type TypeScriptSemanticSearchCoreView =
  | "workspace"
  | "prime"
  | "owner"
  | "dependency"
  | "deps"
  | "docs"
  | "api"
  | "public-external-types"
  | "policy"
  | "symbol"
  | "callsite"
  | "import"
  | "tests"
  | "lexical"
  | "reasoning"
  | "env"
  | "runtime-source"
  | "lang"
  | "std"
  | "capability"
  | "extension"
  | "pattern"
  | "compare"
  | "semantic-facts"
  | "ingest";
export type TypeScriptSemanticSearchView = TypeScriptSemanticSearchCoreView;

type TypeScriptSemanticSearchDeclaredPipe =
  | Exclude<TypeScriptSemanticSearchView, "semantic-facts">
  | "items";
export type TypeScriptSemanticSearchMethod = `search/${TypeScriptSemanticSearchView}`;
export type TypeScriptSemanticSearchPipe = TypeScriptSemanticSearchDeclaredPipe;

export type TypeScriptSemanticQueryMethod =
  | "query"
  | "query/owner-items"
  | "query/direct-source-read";

export const TYPE_SCRIPT_SEARCH_VIEW_DESCRIPTORS = [
  searchView("workspace", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [semanticCapability("workspace-router")],
  }),
  searchView("prime", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [semanticCapability("package-prime-map")],
  }),
  searchView("owner", {
    requiresQuery: true,
    acceptsStdin: false,
    acceptedPipes: ["items"],
    capabilities: [
      semanticCapability("reasoning-owner-search"),
      typeScriptCapability("parser-visible-module-owner-search"),
      typeScriptCapability("test-owner-search"),
      semanticCapability("path-owner-fallback"),
      typeScriptCapability("owner-item-query"),
      typeScriptCapability("owner-top-items-fallback"),
    ],
    fallbacks: [
      {
        name: "owner-top-items",
        trigger: "item-query-miss",
        appliesToPipes: ["items"],
        maxItems: 4,
      },
    ],
    packetSchemas: ["semantic-search-packet.v1", "semantic-tree-sitter-query.v1"],
    grammarId: "tree-sitter-typescript",
    outputModes: ["frontier", "json"],
    input: "search owner <path> [items] [--query <symbol-or-a|b|c>]",
    ingestRequiredFor: [typeScriptIngestSurface("non-parser-path")],
  }),
  searchView("dependency", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("dependency-manifest-search"),
      typeScriptCapability("dependency-local-usage-search"),
    ],
  }),
  searchView("deps", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("dependency-manifest-search"),
      typeScriptCapability("dependency-local-usage-search"),
      semanticCapability("dependency-version-scope"),
      typeScriptCapability("dependency-api-token-usage-search"),
    ],
  }),
  searchView("docs", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("local-docs-search"),
      semanticCapability("schema-contract-search"),
      typeScriptCapability("local-semantic-schema-search"),
    ],
    ingestRequiredFor: [typeScriptIngestSurface("external-docs")],
  }),
  searchView("api", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      typeScriptCapability("exported-api-shape-search"),
      typeScriptCapability("public-function-api-shape-search"),
      typeScriptCapability("public-data-api-shape-search"),
      semanticCapability("dependency-version-scope"),
    ],
    ingestRequiredFor: [typeScriptIngestSurface("external-api-docs")],
  }),
  searchView("public-external-types", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("dependency-manifest-search"),
      typeScriptCapability("public-external-type-search"),
      typeScriptCapability("public-api-type-text-search"),
    ],
  }),
  searchView("policy", {
    requiresQuery: true,
    acceptsStdin: false,
    acceptedPipes: ["owner", "tests"],
    capabilities: [
      semanticCapability("policy-rule-handle-search"),
      typeScriptCapability("typescript-project-policy-rule-handle-search"),
      typeScriptCapability("typescript-agent-policy-rule-handle-search"),
      typeScriptCapability("typescript-extension-policy-rule-handle-search"),
    ],
    input: "search policy <rule-id-or-alias> [owner tests]",
  }),
  searchView("symbol", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [typeScriptCapability("symbol-export-search")],
  }),
  searchView("callsite", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [typeScriptCapability("owner-callsite-search")],
  }),
  searchView("import", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [typeScriptCapability("import-edge-search")],
  }),
  searchView("tests", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [typeScriptCapability("test-owner-search")],
  }),
  searchView("lexical", {
    requiresQuery: true,
    acceptsStdin: false,
    acceptedPipes: ["owner", "tests"],
    supportsQuerySet: true,
    acceptedQuerySetSelectors: ["lexical-set"],
    querySetScopes: ["project", "owner"],
    clients: ["semantic-agent-hook"],
    capabilities: [
      semanticCapability("dynamic-lexical-overlay-search"),
      typeScriptCapability("parser-visible-module-owner-search"),
      typeScriptCapability("test-owner-search"),
    ],
    input: "search lexical <query> [owner|tests...] or --query-set TERM [--query-set TERM...]",
    ingestRequiredFor: [typeScriptIngestSurface("non-parser-path")],
  }),
  searchView("reasoning", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("reasoning-owner-search"),
      semanticCapability("dependency-manifest-search"),
      typeScriptCapability("owner-item-query"),
      typeScriptCapability("test-owner-search"),
      typeScriptCapability("dependency-local-usage-search"),
    ],
  }),
  searchView("env", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-project-environment-facts"),
    ],
  }),
  searchView("runtime-source", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-runtime-source-frontier"),
    ],
  }),
  searchView("lang", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-language-semantics-facts"),
    ],
  }),
  searchView("std", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-standard-api-facts"),
    ],
  }),
  searchView("capability", {
    requiresQuery: false,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-provider-capability-facts"),
    ],
  }),
  searchView("extension", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-ecosystem-extension-facts"),
    ],
  }),
  searchView("pattern", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-executable-pattern-facts"),
    ],
  }),
  searchView("compare", {
    requiresQuery: true,
    acceptsStdin: false,
    capabilities: [
      semanticCapability("provider-knowledge-axis"),
      typeScriptCapability("typescript-semantic-comparison-facts"),
    ],
  }),
  searchView("semantic-facts", {
    requiresQuery: true,
    acceptsStdin: true,
    clients: ["asp-graph-turbo"],
    input: "search semantic-facts <query>",
    packetSchemas: ["semantic-fact-graph.v1", "semantic-fact-ontology.v1"],
    outputModes: ["json"],
    capabilities: [
      semanticCapability("graph-turbo-provider-facts"),
      typeScriptCapability("typescript-ast-field-type-collection-facts"),
    ],
  }),
  searchView("ingest", {
    requiresQuery: false,
    acceptsStdin: true,
    acceptedPipes: ["items", "tests"],
    capabilities: [
      semanticCapability("external-candidate-ingest"),
      semanticCapability("stdin-shape-detection"),
      semanticCapability("owner-grouped-ingest"),
    ],
  }),
] as const;
export const TYPE_SCRIPT_SEARCH_METHODS = TYPE_SCRIPT_SEARCH_VIEW_DESCRIPTORS.map(
  (descriptor) => descriptor.method,
);

export const TYPE_SCRIPT_CHECK_METHODS = ["check/changed", "check/full"] as const;
export const TYPE_SCRIPT_QUERY_METHODS = [
  "query",
  "query/owner-items",
  "query/direct-source-read",
] as const;
export const TYPE_SCRIPT_AST_PATCH_METHODS = ["ast-patch/dry-run"] as const;
export const TYPE_SCRIPT_EVIDENCE_METHODS = ["evidence/graph", "evidence/analyze"] as const;
export const TYPE_SCRIPT_AGENT_METHODS = ["agent/doctor", "agent/guide"] as const;

export type TypeScriptSemanticLanguageMethod =
  | TypeScriptSemanticSearchMethod
  | TypeScriptSemanticQueryMethod
  | (typeof TYPE_SCRIPT_CHECK_METHODS)[number]
  | (typeof TYPE_SCRIPT_AST_PATCH_METHODS)[number]
  | (typeof TYPE_SCRIPT_EVIDENCE_METHODS)[number]
  | (typeof TYPE_SCRIPT_AGENT_METHODS)[number];
export type SemanticLanguageCommand =
  | "search"
  | "query"
  | "check"
  | "ast-patch"
  | "evidence"
  | "agent";
export type SemanticLanguageOutputMode = "frontier" | "json" | "code" | "names" | "read-packet";
export type SemanticLanguageCapabilityNamespace = "semantic" | typeof TYPE_SCRIPT_LANGUAGE_ID;

export interface SemanticLanguageCapabilityDescriptor {
  readonly languageId: typeof TYPE_SCRIPT_LANGUAGE_ID;
  readonly namespace: SemanticLanguageCapabilityNamespace;
  readonly name: string;
}

export interface SemanticLanguageIngestSurfaceDescriptor {
  readonly languageId: typeof TYPE_SCRIPT_LANGUAGE_ID;
  readonly namespace: SemanticLanguageCapabilityNamespace;
  readonly name: string;
}

export interface SemanticLanguageRegistryDocument {
  readonly registryId: typeof SEMANTIC_LANGUAGE_REGISTRY_ID;
  readonly registryVersion: typeof SEMANTIC_LANGUAGE_REGISTRY_VERSION;
  readonly protocolId: typeof SEMANTIC_LANGUAGE_PROTOCOL_ID;
  readonly protocolVersion: typeof SEMANTIC_LANGUAGE_PROTOCOL_VERSION;
  readonly projectRoot?: string;
  readonly languages: readonly SemanticLanguageRegistration[];
}

export interface SemanticLanguageRegistration {
  readonly languageId: typeof TYPE_SCRIPT_LANGUAGE_ID;
  readonly providerId: typeof TYPE_SCRIPT_PROVIDER_ID;
  readonly binary: typeof TYPE_SCRIPT_BINARY;
  readonly namespace: typeof TYPE_SCRIPT_PROVIDER_NAMESPACE;
  readonly displayName: "TypeScript";
  readonly methods: readonly TypeScriptSemanticLanguageMethod[];
  readonly methodDescriptors: readonly SemanticLanguageMethodDescriptor[];
  readonly queryPackDescriptor: ReturnType<typeof typeScriptQueryPackDescriptor>;
  readonly schemas: readonly SemanticLanguageSchemaRegistration[];
}

export interface SemanticLanguageMethodDescriptor {
  readonly invocation?: {
    readonly argv: readonly string[];
    readonly stdinMode?: "none" | "pipe-candidates" | "pipe-diff" | "unknown";
  };
  readonly method: TypeScriptSemanticLanguageMethod;
  readonly command: SemanticLanguageCommand;
  readonly view?: string;
  readonly outputSchemaIds?: readonly string[];
  readonly packetSchemas?: readonly string[];
  readonly queryInputForms?: readonly (
    | "selector"
    | "code-shaped"
    | "catalog-id"
    | "s-expression"
  )[];
  readonly queryCatalogs?: readonly SemanticLanguageQueryCatalogDescriptor[];
  readonly grammarId?: string;
  readonly grammarProfileVersion?: string;
  readonly grammarProfileSchema?: string;
  readonly grammarProfilePath?: string;
  readonly adapterModes?: readonly (
    | "native-projection"
    | "hybrid"
    | "tree-sitter-runtime"
    | "codeql-query"
    | "cached-replay"
  )[];
  readonly sourceAuthorities?: readonly (
    | "native-parser"
    | "native-parser-adapter"
    | "tree-sitter-runtime"
    | "codeql"
    | "hybrid"
    | "cached-provider-export"
  )[];
  readonly executionBackends?: readonly (
    | "native-parser"
    | "tree-sitter-runtime"
    | "codeql"
    | "hybrid"
    | "cached-replay"
  )[];
  readonly renderProfiles?: readonly (
    | "compact-graph-frontier"
    | "corpus-locator"
    | "flow-lite-frontier"
  )[];
  readonly supportedPredicates?: readonly string[];
  readonly unsupportedPredicates?: readonly string[];
  readonly cacheReplay?: boolean;
  readonly codeOutput?: {
    readonly mode: "pure-code";
    readonly multiMatch: "deny" | "allow" | "require-limit" | "first-only";
    readonly requires: readonly (
      | "exact-selector"
      | "unique-predicate"
      | "unique-match"
      | "--limit"
      | "--first"
    )[];
  };
  readonly unsupportedPatternBehavior?: "diagnostic" | "empty-frontier";
  readonly requiresQuery?: boolean;
  readonly acceptsStdin?: boolean;
  readonly supportsPackageScope?: boolean;
  readonly benchmarkInvocation?: SemanticLanguageBenchmarkInvocation;
  readonly supportsQuerySet?: boolean;
  readonly acceptedQuerySetSelectors?: readonly (
    | "exact-set"
    | "prefix-set"
    | "lexical-set"
    | "stdin-path-set"
  )[];
  readonly querySetScopes?: readonly ("project" | "package" | "owner")[];
  readonly acceptedPipes?: readonly TypeScriptSemanticSearchPipe[];
  readonly capabilities?: readonly SemanticLanguageCapabilityDescriptor[];
  readonly ingestRequiredFor?: readonly SemanticLanguageIngestSurfaceDescriptor[];
  readonly fallbacks?: readonly SemanticLanguageFallbackDescriptor[];
  readonly clients?: readonly string[];
  readonly requiredOptions?: readonly string[];
  readonly input?: string;
  readonly outputModes?: readonly SemanticLanguageOutputMode[];
  readonly mutationAvailable?: boolean;
  readonly supportsJson: boolean;
  readonly supportsCompact: boolean;
}

export interface SemanticLanguageBenchmarkInvocation {
  readonly args: readonly string[];
  readonly stdinTemplate?: string;
  readonly expectsJson: boolean;
  readonly maxElapsedMs: number;
}

export interface SemanticLanguageQueryCatalogDescriptor {
  readonly id: string;
  readonly path: string;
  readonly sourceDelivery: "provider-binary-embedded";
  readonly captures: readonly string[];
  readonly nodeTypes: readonly string[];
  readonly fields: readonly string[];
  readonly description?: string;
}

export interface SemanticLanguageFallbackDescriptor {
  readonly name: string;
  readonly trigger: "query-miss" | "item-query-miss" | "path-only-owner";
  readonly appliesToPipes?: readonly TypeScriptSemanticSearchPipe[];
  readonly maxItems?: number;
}

export interface TypeScriptSemanticSearchViewDescriptor {
  readonly method: TypeScriptSemanticSearchMethod;
  readonly command: "search";
  readonly view: TypeScriptSemanticSearchView;
  readonly requiresQuery: boolean;
  readonly acceptsStdin: boolean;
  readonly supportsPackageScope: true;
  readonly supportsQuerySet?: boolean;
  readonly acceptedQuerySetSelectors?: readonly (
    | "exact-set"
    | "prefix-set"
    | "lexical-set"
    | "stdin-path-set"
  )[];
  readonly querySetScopes?: readonly ("project" | "package" | "owner")[];
  readonly acceptedPipes?: readonly TypeScriptSemanticSearchPipe[];
  readonly packetSchemas?: readonly string[];
  readonly queryInputForms?: readonly (
    | "selector"
    | "code-shaped"
    | "catalog-id"
    | "s-expression"
  )[];
  readonly grammarId?: string;
  readonly grammarProfileVersion?: string;
  readonly grammarProfileSchema?: string;
  readonly grammarProfilePath?: string;
  readonly capabilities: readonly SemanticLanguageCapabilityDescriptor[];
  readonly ingestRequiredFor?: readonly SemanticLanguageIngestSurfaceDescriptor[];
  readonly fallbacks?: readonly SemanticLanguageFallbackDescriptor[];
  readonly clients?: readonly string[];
  readonly requiredOptions?: readonly string[];
  readonly input?: string;
  readonly outputModes?: readonly SemanticLanguageOutputMode[];
}

export interface SemanticLanguageSchemaRegistration {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly path: string;
}

export function semanticLanguageRegistryDocument(
  _projectRoot?: string,
): SemanticLanguageRegistryDocument {
  return {
    registryId: SEMANTIC_LANGUAGE_REGISTRY_ID,
    registryVersion: SEMANTIC_LANGUAGE_REGISTRY_VERSION,
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
    languages: [typeScriptSemanticLanguageRegistration()],
  };
}

function typeScriptQueryPackDescriptor() {
  return {
    descriptorId: "typescript.query-pack",
    descriptorVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    semanticFactsDescriptorId: "typescript.semantic-facts",
    termRoleOverrides: ["Effect", "Scope", "Queue", "Stream"].map((term) => ({
      term,
      role: "symbol" as const,
      caseSensitive: true,
    })),
    recipes: [
      {
        recipeId: "typescript.effect-runtime",
        trigger: { terms: ["Effect", "runtime", "scheduling"], match: "any" as const },
        clauses: [
          {
            terms: ["Effect", "runtime", "scheduling"],
            roles: ["symbol", "concept"] as const,
            intentAxes: ["concurrency"] as const,
          },
        ],
      },
      {
        recipeId: "typescript.scope-lifecycle",
        trigger: { terms: ["Scope", "lifecycle"], match: "any" as const },
        clauses: [
          {
            terms: ["Scope", "lifecycle"],
            roles: ["symbol", "concept"] as const,
            intentAxes: ["resource-lifecycle"] as const,
          },
        ],
      },
      {
        recipeId: "typescript.stream-queue-backpressure",
        trigger: { terms: ["Queue", "Stream", "backpressure"], match: "any" as const },
        clauses: [
          {
            terms: ["Queue", "Stream", "backpressure"],
            roles: ["symbol", "concept"] as const,
            intentAxes: ["collection", "stream"] as const,
          },
        ],
      },
    ],
  };
}

export function typeScriptSemanticLanguageRegistration(): SemanticLanguageRegistration {
  const registration = typeScriptSemanticLanguageRegistrationWithLegacyQueryDescriptors();
  const removedMethods = new Set(["query/owner-items", "query/direct-source-read"]);
  return {
    ...registration,
    methods: registration.methods.filter((method) => !removedMethods.has(method)),
    methodDescriptors: registration.methodDescriptors
      .filter((descriptor) => !removedMethods.has(descriptor.method))
      .map((descriptor) => {
        if (descriptor.method !== "query") {
          return descriptor;
        }
        const normalized = { ...descriptor };
        delete normalized.codeOutput;
        if (normalized.outputModes) {
          normalized.outputModes = normalized.outputModes.filter((mode) => mode !== "code");
        }
        return normalized;
      }),
  };
}

function typeScriptSemanticLanguageRegistrationWithLegacyQueryDescriptors(): SemanticLanguageRegistration {
  return {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    displayName: "TypeScript",
    methods: [
      ...TYPE_SCRIPT_SEARCH_METHODS,
      ...TYPE_SCRIPT_QUERY_METHODS,
      ...TYPE_SCRIPT_CHECK_METHODS,
      ...TYPE_SCRIPT_AST_PATCH_METHODS,
      ...TYPE_SCRIPT_EVIDENCE_METHODS,
      ...TYPE_SCRIPT_AGENT_METHODS,
    ],
    methodDescriptors: typeScriptSemanticLanguageMethodDescriptors(),
    queryPackDescriptor: typeScriptQueryPackDescriptor(),
    schemas: TYPE_SCRIPT_PROVIDER_REGISTRATION.schemas,
  };
}

export function typeScriptSemanticSearchViewDescriptor(
  view: string,
): TypeScriptSemanticSearchViewDescriptor | undefined {
  return TYPE_SCRIPT_SEARCH_VIEW_DESCRIPTORS.find((descriptor) => descriptor.view === view);
}

export function isTypeScriptSemanticSearchView(view: string): view is TypeScriptSemanticSearchView {
  return typeScriptSemanticSearchViewDescriptor(view) !== undefined;
}

function invocationForMethodDescriptor(descriptor: {
  readonly method: string;
  readonly benchmarkInvocation?: SemanticLanguageBenchmarkInvocation;
}): NonNullable<SemanticLanguageMethodDescriptor["invocation"]> {
  if (descriptor.benchmarkInvocation !== undefined) {
    return {
      argv: [TYPE_SCRIPT_BINARY, ...descriptor.benchmarkInvocation.args],
      stdinMode:
        descriptor.benchmarkInvocation.stdinTemplate === undefined ? "none" : "pipe-candidates",
    };
  }
  const invocations: Readonly<Record<string, readonly string[]>> = {
    query: [TYPE_SCRIPT_BINARY, "query", "--catalog", "{query}", "--workspace", "{workspace}"],
    "query/owner-items": [
      TYPE_SCRIPT_BINARY,
      "query",
      "{owner}",
      "--term",
      "{query}",
      "--workspace",
      "{workspace}",
    ],
    "query/direct-source-read": [
      TYPE_SCRIPT_BINARY,
      "query",
      "--from-hook",
      "direct-source-read",
      "--selector",
      "{selector}",
      "--workspace",
      "{workspace}",
    ],
    "check/changed": [TYPE_SCRIPT_BINARY, "check", "--changed", "{workspace}"],
    "check/full": [TYPE_SCRIPT_BINARY, "check", "--full", "{workspace}"],
    "ast-patch/dry-run": [TYPE_SCRIPT_BINARY, "ast-patch", "dry-run", "--packet", "{packet}"],
    "evidence/graph": [TYPE_SCRIPT_BINARY, "evidence", "graph", "--json", "{workspace}"],
    "evidence/analyze": [TYPE_SCRIPT_BINARY, "evidence", "analyze", "--json", "{workspace}"],
    "agent/doctor": [TYPE_SCRIPT_BINARY, "agent", "doctor", "--json"],
    "agent/guide": [TYPE_SCRIPT_BINARY, "agent", "guide"],
  };
  const argv = invocations[descriptor.method];
  if (argv === undefined) {
    throw new Error(`missing invocation descriptor for ${descriptor.method}`);
  }
  return { argv, stdinMode: "none" };
}

function typeScriptSemanticLanguageMethodDescriptors(): readonly SemanticLanguageMethodDescriptor[] {
  const descriptors: readonly SemanticLanguageMethodDescriptor[] = [
    ...TYPE_SCRIPT_SEARCH_VIEW_DESCRIPTORS.map((descriptor) => ({
      ...descriptor,
      benchmarkInvocation: searchBenchmarkInvocation(descriptor.view),
      outputSchemaIds: searchOutputSchemaIds(descriptor.view),
      supportsJson: true,
      supportsCompact: descriptor.view === "semantic-facts" ? false : true,
    })),
    {
      method: "query" as const,
      command: "query" as const,
      input: "tree-sitter-compatible syntax query",
      requiredOptions: ["--catalog|--treesitter-query"],
      outputSchemaIds: [SEMANTIC_TREE_SITTER_QUERY_SCHEMA_ID],
      packetSchemas: ["semantic-tree-sitter-query.v1"],
      queryInputForms: ["catalog-id", "s-expression"],
      adapterModes: ["native-projection"],
      sourceAuthorities: ["native-parser-adapter", "native-parser"],
      executionBackends: ["native-parser"],
      renderProfiles: ["corpus-locator"],
      queryCatalogs: [
        queryCatalog(
          "declarations",
          "tree-sitter/tree-sitter-typescript/queries/declarations.scm",
          [
            "function.definition",
            "function.name",
            "class.definition",
            "class.name",
            "interface.definition",
            "interface.name",
            "type.definition",
            "type.name",
            "enum.definition",
            "enum.name",
            "variable.definition",
            "variable.name",
            "import.declaration",
            "import.source",
            "export.declaration",
          ],
          [
            "function_declaration",
            "class_declaration",
            "interface_declaration",
            "type_alias_declaration",
            "enum_declaration",
            "lexical_declaration",
            "variable_declarator",
            "import_statement",
            "export_statement",
          ],
          ["name", "source"],
        ),
        queryCatalog(
          "imports",
          "tree-sitter/tree-sitter-typescript/queries/imports.scm",
          ["import.declaration", "import.source", "export.declaration", "export.source"],
          ["import_statement", "export_statement"],
          ["source"],
        ),
        queryCatalog(
          "calls",
          "tree-sitter/tree-sitter-typescript/queries/calls.scm",
          ["call.expression", "call.target"],
          ["call_expression"],
          ["function"],
        ),
      ],
      grammarId: "tree-sitter-typescript",
      grammarProfileVersion: "2026-06-05.v1",
      grammarProfileSchema: "semantic-tree-sitter-grammar-profile.v1",
      grammarProfilePath: "tree-sitter/tree-sitter-typescript/grammar-profile.json",
      supportedPredicates: [
        "#eq?",
        "#any-eq?",
        "#any-of?",
        "#match?",
        "#any-match?",
        "#not-eq?",
        "#not-match?",
      ],
      unsupportedPredicates: [],
      cacheReplay: true,
      codeOutput: {
        mode: "pure-code",
        multiMatch: "deny",
        requires: ["exact-selector", "unique-predicate"],
      },
      unsupportedPatternBehavior: "diagnostic",
      supportsCompact: true,
      supportsJson: true,
      outputModes: ["frontier", "json", "code"],
    },
    {
      method: "query/owner-items" as const,
      command: "query" as const,
      input: "owner-path",
      requiredOptions: ["--term"],
      outputSchemaIds: [SEMANTIC_QUERY_PACKET_SCHEMA_ID],
      packetSchemas: ["semantic-query-packet.v1", "semantic-tree-sitter-query.v1"],
      grammarId: "tree-sitter-typescript",
      grammarProfileVersion: "2026-06-05.v1",
      grammarProfileSchema: "semantic-tree-sitter-grammar-profile.v1",
      grammarProfilePath: "tree-sitter/tree-sitter-typescript/grammar-profile.json",
      queryInputForms: ["selector", "code-shaped"],
      adapterModes: ["native-projection"],
      sourceAuthorities: ["native-parser"],
      executionBackends: ["native-parser"],
      renderProfiles: ["compact-graph-frontier"],
      cacheReplay: true,
      codeOutput: {
        mode: "pure-code",
        multiMatch: "deny",
        requires: ["exact-selector", "unique-match"],
      },
      unsupportedPatternBehavior: "diagnostic",
      supportsCompact: true,
      supportsJson: true,
      supportsQuerySet: true,
      acceptedQuerySetSelectors: ["exact-set"],
      querySetScopes: ["owner"],
      outputModes: ["frontier", "json", "code", "names"],
    },
    {
      method: "query/direct-source-read" as const,
      command: "query" as const,
      input: "owner-path",
      requiredOptions: ["--from-hook", "--selector"],
      outputSchemaIds: [SEMANTIC_QUERY_PACKET_SCHEMA_ID, SEMANTIC_READ_PACKET_SCHEMA_ID],
      packetSchemas: [
        "semantic-query-packet.v1",
        "semantic-read-packet.v1",
        "semantic-tree-sitter-query.v1",
      ],
      queryInputForms: ["selector"],
      grammarId: "tree-sitter-typescript",
      grammarProfileVersion: "2026-06-05.v1",
      grammarProfileSchema: "semantic-tree-sitter-grammar-profile.v1",
      grammarProfilePath: "tree-sitter/tree-sitter-typescript/grammar-profile.json",
      adapterModes: ["native-projection"],
      sourceAuthorities: ["native-parser"],
      executionBackends: ["native-parser"],
      renderProfiles: ["corpus-locator"],
      cacheReplay: true,
      codeOutput: {
        mode: "pure-code",
        multiMatch: "deny",
        requires: ["exact-selector"],
      },
      unsupportedPatternBehavior: "diagnostic",
      supportsCompact: true,
      supportsJson: true,
      outputModes: ["frontier", "json", "code", "names", "read-packet"],
    },
    ...TYPE_SCRIPT_CHECK_METHODS.map((method) => ({
      method,
      command: "check" as const,
      supportsJson: true,
      supportsCompact: true,
    })),
    ...TYPE_SCRIPT_AST_PATCH_METHODS.map((method) => ({
      method,
      command: "ast-patch" as const,
      input: "semantic-ast-patch packet",
      requiredOptions: ["--packet"],
      outputSchemaIds: [SEMANTIC_AST_PATCH_RECEIPT_SCHEMA_ID],
      supportsJson: true,
      supportsCompact: false,
      mutationAvailable: false,
    })),
    {
      method: "evidence/graph" as const,
      command: "evidence" as const,
      input: "provider project root",
      outputSchemaIds: [SEMANTIC_EVIDENCE_GRAPH_SCHEMA_ID],
      supportsJson: true,
      supportsCompact: true,
    },
    {
      method: "evidence/analyze" as const,
      command: "evidence" as const,
      input: "provider project root",
      outputSchemaIds: [SEMANTIC_GRAPH_TURBO_REQUEST_SCHEMA_ID],
      packetSchemas: ["semantic-graph-turbo-request.v1"],
      clients: ["asp-graph-turbo"],
      supportsJson: true,
      supportsCompact: true,
    },
    {
      method: "agent/doctor" as const,
      command: "agent" as const,
      outputSchemaIds: ["agent.semantic-protocols.semantic-provider-doctor"],
      supportsCompact: true,
      supportsJson: true,
    },
    {
      method: "agent/guide" as const,
      command: "agent" as const,
      supportsCompact: true,
      supportsJson: false,
    },
  ];
  return descriptors.map((descriptor) => ({
    ...descriptor,
    invocation: invocationForMethodDescriptor(descriptor),
  }));
}

function searchBenchmarkInvocation(
  view: TypeScriptSemanticSearchView,
): SemanticLanguageBenchmarkInvocation {
  const workspace = ["--workspace", "{workspace}"] as const;
  const seeds = [...workspace, "--view", "seeds"] as const;
  const invocation = (args: readonly string[]): SemanticLanguageBenchmarkInvocation => ({
    args,
    expectsJson: false,
    maxElapsedMs: 15_000,
  });

  switch (view) {
    case "owner":
      return invocation(["search", "owner", "{owner}", "items", "--query", "{query}", ...seeds]);
    case "lexical":
      return invocation([
        "search",
        "lexical",
        "--query",
        "{query}",
        "--query",
        "{dependency}",
        ...seeds,
      ]);
    case "dependency":
    case "deps":
      return invocation(["search", view, "{dependency}", ...seeds]);
    case "tests":
      return invocation(["search", "tests", "{owner}", ...seeds]);
    case "reasoning":
      return invocation([
        "search",
        "reasoning",
        "query-deps",
        "--query",
        "{query}",
        "--dependency",
        "{dependency}",
        ...seeds,
      ]);
    case "ingest":
      return {
        args: ["search", "ingest", ...seeds],
        stdinTemplate: "{owner}:1:{query}\\n",
        expectsJson: false,
        maxElapsedMs: 15_000,
      };
    case "semantic-facts":
      return {
        args: ["search", "semantic-facts", "{query}", ...workspace, "--json"],
        stdinTemplate: "{owner}:1:{query}\n",
        expectsJson: true,
        maxElapsedMs: 15_000,
      };
    case "extension":
      return invocation(["search", "extension", "{dependency}", ...seeds]);
    case "public-external-types":
      return invocation(["search", view, "{dependency}", ...seeds]);
    case "api":
    case "callsite":
    case "compare":
    case "docs":
    case "import":
    case "pattern":
    case "policy":
    case "symbol":
      return invocation(["search", view, "{query}", ...seeds]);
    default:
      return invocation(["search", view, ...seeds]);
  }
}

function searchOutputSchemaIds(view: TypeScriptSemanticSearchView): readonly string[] {
  return view === "semantic-facts"
    ? [SEMANTIC_FACT_GRAPH_SCHEMA_ID]
    : view === "public-external-types"
      ? [SEMANTIC_SEARCH_PACKET_SCHEMA_ID, SEMANTIC_TYPE_SURFACE_SCHEMA_ID]
      : view === "policy"
        ? [SEMANTIC_SEARCH_PACKET_SCHEMA_ID, SEMANTIC_HANDLE_SCHEMA_ID]
        : [SEMANTIC_SEARCH_PACKET_SCHEMA_ID];
}

function queryCatalog(
  id: string,
  path: string,
  captures: readonly string[],
  nodeTypes: readonly string[],
  fields: readonly string[],
): SemanticLanguageQueryCatalogDescriptor {
  return {
    id,
    path,
    sourceDelivery: "provider-binary-embedded",
    captures,
    nodeTypes,
    fields,
  };
}

function searchView<const View extends string>(
  view: View,
  options: {
    readonly requiresQuery: boolean;
    readonly acceptsStdin: boolean;
    readonly acceptedPipes?: readonly TypeScriptSemanticSearchPipe[];
    readonly supportsQuerySet?: boolean;
    readonly acceptedQuerySetSelectors?: readonly (
      | "exact-set"
      | "prefix-set"
      | "lexical-set"
      | "stdin-path-set"
    )[];
    readonly querySetScopes?: readonly ("project" | "package" | "owner")[];
    readonly capabilities: readonly SemanticLanguageCapabilityDescriptor[];
    readonly ingestRequiredFor?: readonly SemanticLanguageIngestSurfaceDescriptor[];
    readonly fallbacks?: readonly SemanticLanguageFallbackDescriptor[];
    readonly clients?: readonly string[];
    readonly requiredOptions?: readonly string[];
    readonly input?: string;
    readonly packetSchemas?: readonly string[];
    readonly queryInputForms?: readonly (
      | "selector"
      | "code-shaped"
      | "catalog-id"
      | "s-expression"
    )[];
    readonly grammarId?: string;
    readonly grammarProfileVersion?: string;
    readonly grammarProfileSchema?: string;
    readonly grammarProfilePath?: string;
    readonly outputModes?: readonly SemanticLanguageOutputMode[];
  },
): {
  readonly method: `search/${View}`;
  readonly command: "search";
  readonly view: View;
  readonly requiresQuery: boolean;
  readonly acceptsStdin: boolean;
  readonly supportsPackageScope: true;
  readonly supportsQuerySet?: boolean;
  readonly acceptedQuerySetSelectors?: readonly (
    | "exact-set"
    | "prefix-set"
    | "lexical-set"
    | "stdin-path-set"
  )[];
  readonly querySetScopes?: readonly ("project" | "package" | "owner")[];
  readonly acceptedPipes?: readonly TypeScriptSemanticSearchPipe[];
  readonly capabilities: readonly SemanticLanguageCapabilityDescriptor[];
  readonly ingestRequiredFor?: readonly SemanticLanguageIngestSurfaceDescriptor[];
  readonly fallbacks?: readonly SemanticLanguageFallbackDescriptor[];
  readonly clients?: readonly string[];
  readonly requiredOptions?: readonly string[];
  readonly input?: string;
  readonly packetSchemas?: readonly string[];
  readonly queryInputForms?: readonly (
    | "selector"
    | "code-shaped"
    | "catalog-id"
    | "s-expression"
  )[];
  readonly grammarId?: string;
  readonly grammarProfileVersion?: string;
  readonly grammarProfileSchema?: string;
  readonly grammarProfilePath?: string;
  readonly outputModes?: readonly SemanticLanguageOutputMode[];
} {
  return {
    method: semanticSearchMethod(view),
    command: "search",
    view,
    ...options,
    supportsPackageScope: true,
  };
}

export function semanticSearchMethod<const View extends string>(view: View): `search/${View}` {
  return `search/${view}`;
}

function semanticCapability(name: string): SemanticLanguageCapabilityDescriptor {
  return capability("semantic", name);
}

function typeScriptCapability(name: string): SemanticLanguageCapabilityDescriptor {
  return capability(TYPE_SCRIPT_LANGUAGE_ID, name);
}

function typeScriptIngestSurface(name: string): SemanticLanguageIngestSurfaceDescriptor {
  return capability(TYPE_SCRIPT_LANGUAGE_ID, name);
}

function capability(
  namespace: SemanticLanguageCapabilityNamespace,
  name: string,
): SemanticLanguageCapabilityDescriptor {
  return {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    namespace,
    name,
  };
}
