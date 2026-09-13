/** Declarative native-parser facts and schema registration for ASP TypeScript. */

import {
  TYPE_SCRIPT_PROVIDER_DESCRIPTOR,
  TYPE_SCRIPT_PROVIDER_REGISTRATION,
} from "./provider-descriptor.js";

export const SEMANTIC_LANGUAGE_REGISTRY_ID =
  "agent.semantic-protocols.semantic-language-registry" as const;
export const SEMANTIC_LANGUAGE_REGISTRY_VERSION = "1" as const;
export const SEMANTIC_LANGUAGE_PROTOCOL_ID = "agent.semantic-protocols.semantic-language" as const;
export const SEMANTIC_LANGUAGE_PROTOCOL_VERSION = "1" as const;
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
export const SEMANTIC_FACT_GRAPH_SCHEMA_ID =
  "agent.semantic-protocols.semantic-fact-graph" as const;
export const SEMANTIC_FACT_ONTOLOGY_SCHEMA_ID =
  "agent.semantic-protocols.semantic-fact-ontology" as const;
export const SEMANTIC_AST_PATCH_SCHEMA_ID = "agent.semantic-protocols.semantic-ast-patch" as const;
export const SEMANTIC_AST_PATCH_RECEIPT_SCHEMA_ID =
  "agent.semantic-protocols.semantic-ast-patch-receipt" as const;

export const TYPE_SCRIPT_LANGUAGE_ID = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.languageId;
export const TYPE_SCRIPT_PROVIDER_ID = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.providerId;
export const TYPE_SCRIPT_BINARY = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.binary;
export const TYPE_SCRIPT_PROVIDER_NAMESPACE = TYPE_SCRIPT_PROVIDER_DESCRIPTOR.namespace;
export const TYPE_SCRIPT_CAPABILITIES_SCHEMA_ID = `${TYPE_SCRIPT_PROVIDER_NAMESPACE}.capabilities`;

export const TYPE_SCRIPT_QUERY_METHODS = ["query"] as const;
export const TYPE_SCRIPT_AST_PATCH_METHODS = ["ast-patch/dry-run"] as const;
export const TYPE_SCRIPT_AGENT_METHODS = ["agent/doctor", "agent/guide"] as const;

export type TypeScriptSemanticLanguageMethod =
  | (typeof TYPE_SCRIPT_QUERY_METHODS)[number]
  | (typeof TYPE_SCRIPT_AST_PATCH_METHODS)[number]
  | (typeof TYPE_SCRIPT_AGENT_METHODS)[number];
export type SemanticLanguageCommand = "query" | "ast-patch" | "agent";
export type SemanticLanguageOutputMode = "frontier" | "json" | "names";

export interface SemanticLanguageRegistryDocument {
  readonly registryId: typeof SEMANTIC_LANGUAGE_REGISTRY_ID;
  readonly registryVersion: typeof SEMANTIC_LANGUAGE_REGISTRY_VERSION;
  readonly protocolId: typeof SEMANTIC_LANGUAGE_PROTOCOL_ID;
  readonly protocolVersion: typeof SEMANTIC_LANGUAGE_PROTOCOL_VERSION;
  readonly languages: readonly SemanticLanguageRegistration[];
}

export interface SemanticLanguageRegistration {
  readonly languageId: typeof TYPE_SCRIPT_LANGUAGE_ID;
  readonly providerId: typeof TYPE_SCRIPT_PROVIDER_ID;
  readonly binary: typeof TYPE_SCRIPT_BINARY;
  readonly namespace: typeof TYPE_SCRIPT_PROVIDER_NAMESPACE;
  readonly displayName: "TypeScript";
  readonly methods: readonly string[];
  readonly methodDescriptors: readonly SemanticLanguageMethodDescriptor[];
  readonly queryPackDescriptor: ReturnType<typeof typeScriptQueryPackDescriptor>;
  readonly schemas: readonly SemanticLanguageSchemaRegistration[];
}

export interface SemanticLanguageSchemaRegistration {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly path: string;
}

export interface SemanticLanguageMethodDescriptor {
  readonly method: TypeScriptSemanticLanguageMethod;
  readonly command: SemanticLanguageCommand;
  readonly invocation: {
    readonly argv: readonly string[];
    readonly stdinMode: "none";
  };
  readonly outputSchemaIds?: readonly string[];
  readonly packetSchemas?: readonly string[];
  readonly queryInputForms?: readonly ("catalog-id" | "s-expression")[];
  readonly queryCatalogs?: readonly SemanticLanguageQueryCatalogDescriptor[];
  readonly grammarId?: string;
  readonly grammarProfileVersion?: string;
  readonly grammarProfileSchema?: string;
  readonly grammarProfilePath?: string;
  readonly adapterModes?: readonly ["native-projection"];
  readonly sourceAuthorities?: readonly ("native-parser" | "native-parser-adapter")[];
  readonly executionBackends?: readonly ["native-parser"];
  readonly renderProfiles?: readonly ["corpus-locator"];
  readonly supportedPredicates?: readonly string[];
  readonly unsupportedPredicates?: readonly string[];
  readonly cacheReplay?: boolean;
  readonly unsupportedPatternBehavior?: "diagnostic";
  readonly requiredOptions?: readonly string[];
  readonly input?: string;
  readonly outputModes?: readonly string[];
  readonly mutationAvailable?: boolean;
  readonly clients?: readonly string[];
  readonly supportsJson: boolean;
  readonly supportsCompact: boolean;
}

export interface SemanticLanguageQueryCatalogDescriptor {
  readonly id: string;
  readonly path: string;
  readonly sourceDelivery: "provider-binary-embedded";
  readonly captures: readonly string[];
  readonly nodeTypes: readonly string[];
  readonly fields: readonly string[];
}

export function semanticLanguageRegistryDocument(): SemanticLanguageRegistryDocument {
  return {
    registryId: SEMANTIC_LANGUAGE_REGISTRY_ID,
    registryVersion: SEMANTIC_LANGUAGE_REGISTRY_VERSION,
    protocolId: SEMANTIC_LANGUAGE_PROTOCOL_ID,
    protocolVersion: SEMANTIC_LANGUAGE_PROTOCOL_VERSION,
    languages: [typeScriptSemanticLanguageRegistration()],
  };
}

export function typeScriptSemanticLanguageRegistration(): SemanticLanguageRegistration {
  return {
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    displayName: "TypeScript",
    methods: [
      ...TYPE_SCRIPT_QUERY_METHODS,
      ...TYPE_SCRIPT_AST_PATCH_METHODS,
      ...TYPE_SCRIPT_AGENT_METHODS,
    ],
    methodDescriptors: typeScriptSemanticLanguageMethodDescriptors(),
    queryPackDescriptor: typeScriptQueryPackDescriptor(),
    schemas: TYPE_SCRIPT_PROVIDER_REGISTRATION.schemas.map(({ schemaId, schemaVersion, path }) => ({
      schemaId,
      schemaVersion,
      path,
    })),
  };
}

function typeScriptSemanticLanguageMethodDescriptors(): readonly SemanticLanguageMethodDescriptor[] {
  return [
    {
      method: "query",
      command: "query",
      invocation: {
        argv: [TYPE_SCRIPT_BINARY, "query", "--catalog", "{query}", "--workspace", "{workspace}"],
        stdinMode: "none",
      },
      input: "tree-sitter-compatible syntax query",
      requiredOptions: ["--catalog|--treesitter-query"],
      outputSchemaIds: [SEMANTIC_TREE_SITTER_QUERY_SCHEMA_ID],
      packetSchemas: ["semantic-tree-sitter-query.v1"],
      queryInputForms: ["catalog-id", "s-expression"],
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
      adapterModes: ["native-projection"],
      sourceAuthorities: ["native-parser-adapter", "native-parser"],
      executionBackends: ["native-parser"],
      renderProfiles: ["corpus-locator"],
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
      unsupportedPatternBehavior: "diagnostic",
      supportsCompact: true,
      supportsJson: true,
      outputModes: ["frontier", "json"],
    },
    {
      method: "ast-patch/dry-run",
      command: "ast-patch",
      invocation: {
        argv: [TYPE_SCRIPT_BINARY, "ast-patch", "dry-run", "--packet", "{packet}"],
        stdinMode: "none",
      },
      input: "semantic-ast-patch packet",
      requiredOptions: ["--packet"],
      outputSchemaIds: [SEMANTIC_AST_PATCH_RECEIPT_SCHEMA_ID],
      mutationAvailable: false,
      supportsJson: true,
      supportsCompact: false,
    },
    {
      method: "agent/doctor",
      command: "agent",
      invocation: { argv: [TYPE_SCRIPT_BINARY, "agent", "doctor", "--json"], stdinMode: "none" },
      outputSchemaIds: ["agent.semantic-protocols.semantic-provider-doctor"],
      supportsCompact: true,
      supportsJson: true,
    },
    {
      method: "agent/guide",
      command: "agent",
      invocation: { argv: [TYPE_SCRIPT_BINARY, "agent", "guide"], stdinMode: "none" },
      supportsCompact: true,
      supportsJson: false,
    },
  ];
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
      queryPackRecipe(
        "typescript.effect-runtime",
        ["Effect", "runtime", "scheduling"],
        ["concurrency"],
      ),
      queryPackRecipe("typescript.scope-lifecycle", ["Scope", "lifecycle"], ["resource-lifecycle"]),
      queryPackRecipe(
        "typescript.stream-queue-backpressure",
        ["Queue", "Stream", "backpressure"],
        ["collection", "stream"],
      ),
    ],
  };
}

function queryPackRecipe(
  recipeId: string,
  terms: readonly string[],
  intentAxes: readonly string[],
) {
  return {
    recipeId,
    trigger: { terms, match: "any" as const },
    clauses: [{ terms, roles: ["symbol", "concept"] as const, intentAxes }],
  };
}

function queryCatalog(
  id: string,
  path: string,
  captures: readonly string[],
  nodeTypes: readonly string[],
  fields: readonly string[],
): SemanticLanguageQueryCatalogDescriptor {
  return { id, path, sourceDelivery: "provider-binary-embedded", captures, nodeTypes, fields };
}
