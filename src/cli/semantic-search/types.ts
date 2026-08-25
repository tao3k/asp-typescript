/**
 * Public semantic-search packet model shared by TypeScript CLI views.
 *
 * The model mirrors the language-neutral JSON Schema while retaining
 * TypeScript literal unions for agent-visible states.
 */

export type SemanticSearchView =
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
  | "ingest";
export type SemanticSearchPipe = SemanticSearchView | "items";
export type SemanticSearchRenderMode = "graph" | "hits" | "both" | "seeds";
export type SemanticSearchInputSource =
  | "rg-n"
  | "vimgrep"
  | "rg-json"
  | "path-list"
  | "path-list-nul"
  | "diff-paths"
  | "unknown";

export interface SemanticSearchBuildOptions {
  readonly view: SemanticSearchView;
  readonly renderMode?: SemanticSearchRenderMode;
  readonly query?: string;
  readonly itemQuery?: string;
  readonly dependency?: string;
  readonly querySet?: readonly string[];
  readonly queryScope?: SemanticSearchQueryScope;
  readonly pipes?: readonly SemanticSearchPipe[];
  readonly stdin?: string;
  readonly runtimeCost?: SemanticSearchRuntimeCost;
}

export interface SemanticSearchPacket {
  readonly schemaId: "agent.semantic-protocols.semantic-search-packet";
  readonly schemaVersion: "1";
  readonly protocolId: "agent.semantic-protocols.semantic-language";
  readonly protocolVersion: "1";
  readonly languageId: string;
  readonly providerId: string;
  readonly binary: string;
  readonly namespace: string;
  readonly method: `search/${SemanticSearchView}`;
  readonly projectRoot: string;
  readonly packageName?: string;
  readonly view: SemanticSearchView;
  readonly renderMode: SemanticSearchRenderMode;
  readonly query?: string;
  readonly querySet?: readonly SemanticSearchQueryTerm[];
  readonly queryComposition?: SemanticSearchQueryComposition;
  readonly queryCoverage?: readonly SemanticSearchQueryCoverage[];
  readonly ownerResolution?: readonly SemanticSearchOwnerResolution[];
  readonly searchSynthesis?: SemanticSearchSynthesis;
  readonly avoidNextActions?: readonly SemanticSearchAvoidNextAction[];
  readonly runtimeCost?: SemanticSearchRuntimeCost;
  readonly cache?: SemanticSearchCache;
  readonly header: SemanticSearchHeader;
  readonly inputDetection?: SemanticSearchInputDetection;
  readonly packages?: readonly SemanticSearchFact[];
  readonly nodes: readonly SemanticSearchNode[];
  readonly edges: readonly SemanticSearchEdge[];
  readonly owners: readonly SemanticSearchOwner[];
  readonly items?: readonly SemanticSearchItem[];
  readonly typeSurfaces?: readonly SemanticSearchTypeSurface[];
  readonly semanticHandles?: readonly SemanticSearchHandle[];
  readonly reasoningProfiles?: readonly SemanticSearchReasoningProfile[];

  readonly hits: readonly SemanticSearchHit[];
  readonly findings: readonly SemanticSearchFinding[];
  readonly nextActions: readonly SemanticSearchNextAction[];
  readonly notes: readonly SemanticSearchNote[];
}

export interface SemanticSearchPacketPayload {
  readonly header: SemanticSearchHeader;
  readonly inputDetection?: SemanticSearchInputDetection;
  readonly packages?: readonly SemanticSearchFact[];
  readonly queryCoverage?: readonly SemanticSearchQueryCoverage[];
  readonly ownerResolution?: readonly SemanticSearchOwnerResolution[];
  readonly searchSynthesis?: SemanticSearchSynthesis;
  readonly avoidNextActions?: readonly SemanticSearchAvoidNextAction[];
  readonly runtimeCost?: SemanticSearchRuntimeCost;
  readonly cache?: SemanticSearchCache;
  readonly nodes: readonly SemanticSearchNode[];
  readonly edges: readonly SemanticSearchEdge[];
  readonly owners: readonly SemanticSearchOwner[];
  readonly items?: readonly SemanticSearchItem[];
  readonly typeSurfaces?: readonly SemanticSearchTypeSurface[];
  readonly semanticHandles?: readonly SemanticSearchHandle[];
  readonly hits: readonly SemanticSearchHit[];
  readonly findings: readonly SemanticSearchFinding[];
  readonly nextActions: readonly SemanticSearchNextAction[];
  readonly notes: readonly SemanticSearchNote[];
}

export interface SemanticSearchHeader {
  readonly kind: `search-${SemanticSearchView}`;
  readonly fields: SemanticSearchFields;
}

export interface SemanticSearchInputDetection {
  readonly source: SemanticSearchInputSource;
  readonly lineCount: number;
  readonly byteCount: number;
  readonly sample?: string;
}

export interface SemanticSearchQueryTerm {
  readonly value: string;
  readonly kind:
    | "dependency"
    | "owner"
    | "path"
    | "symbol"
    | "text"
    | "feature"
    | "cfg"
    | "api"
    | "custom";
  readonly selector: "exact" | "prefix" | "fuzzy" | "stdin-path";
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchQueryComposition {
  readonly mode: "single" | "query-set";
  readonly view: string;
  readonly selector: "single" | "exact-set" | "prefix-set" | "lexical-set" | "stdin-path-set";
  readonly scope?: SemanticSearchQueryScope;
  readonly merge: readonly (
    | "packages"
    | "nodes"
    | "edges"
    | "owners"
    | "items"
    | "hits"
    | "findings"
    | "nextActions"
    | "notes"
  )[];
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchQueryScope {
  readonly projectRoot?: string;
  readonly packageName?: string;
  readonly ownerPath?: string;
  readonly roots?: readonly string[];
}

export type SemanticSearchSurfaceKind =
  | "real-source"
  | "test-source"
  | "test-fixture-string"
  | "generated-source"
  | "external-source"
  | "unknown";

export interface SemanticSearchQueryCoverage {
  readonly value: string;
  readonly kind: SemanticSearchQueryTerm["kind"];
  readonly selector?: SemanticSearchQueryTerm["selector"];
  readonly status: "hit" | "miss" | "partial" | "error";
  readonly hitCount: number;
  readonly surfaces?: readonly SemanticSearchSurfaceKind[];
  readonly ownerPaths?: readonly string[];
  readonly fixturePaths?: readonly string[];
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchOwnerResolution {
  readonly target: string;
  readonly status:
    | "workspace-owner"
    | "fixture-path"
    | "missing"
    | "ambiguous"
    | "external"
    | "unknown";
  readonly realOwner: boolean;
  readonly ownerPath?: string;
  readonly fixturePath?: string;
  readonly fixtureOwner?: string;
  readonly reason?: string;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchSynthesis {
  readonly algorithm: string;
  readonly scope:
    | "workspace"
    | "prime"
    | "owner"
    | "dependency"
    | "policy"
    | "query"
    | "query-set"
    | "ingest"
    | "custom";
  readonly summary?: string;
  readonly ownerPath?: string;
  readonly selectedOwners?: number;
  readonly selectedEdges?: number;
  readonly incomingOwners?: number;
  readonly outgoingOwners?: number;
  readonly highImpactOwners?: readonly string[];
  readonly frontierOwners?: readonly string[];
  readonly editFrontier?: readonly string[];
  readonly testFrontier?: readonly string[];
  readonly windowSet?: readonly SemanticSearchWindowTarget[];
  readonly findingOwners?: readonly string[];
  readonly seeds?: readonly SemanticSearchNextAction[];
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchWindowTarget {
  readonly kind: "owner" | "tests" | "read";
  readonly target: string;
  readonly query?: string;
  readonly reason?: string;
  readonly ownerPath?: string;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchAvoidNextAction {
  readonly kind: string;
  readonly target: string;
  readonly reason: string;
  readonly ownerPath?: string;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchRuntimeCost {
  readonly cacheStatus: "cold" | "warm" | "reused" | "disabled" | "unknown";
  readonly elapsedMs?: number;
  readonly parseMs?: number;
  readonly sourceFilesParsed?: number;
  readonly packagesScanned?: number;
  readonly parserFactsReused?: boolean;
  readonly indexId?: string;
  readonly reason?: string;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchCache {
  readonly fileHashes: readonly SemanticSearchFileHash[];
  readonly rawSourceStored?: false;
}

export interface SemanticSearchFileHash {
  readonly path: string;
  readonly sha256: string;
}

export type SemanticSearchFieldValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[];
export type SemanticSearchFields = Readonly<Record<string, SemanticSearchFieldValue>>;

export interface SemanticSearchFact {
  readonly id: string;
  readonly fields: SemanticSearchFields;
}

export interface SemanticSearchNode {
  readonly id: string;
  readonly kind:
    | "package"
    | "owner"
    | "dependency"
    | "test"
    | "finding"
    | "symbol"
    | "tsconfig"
    | "extension"
    | "build_tool"
    | "test_surface";
  readonly path?: string;
  readonly fields: SemanticSearchFields;
}

export type SemanticSearchEdgeKind =
  | "import"
  | "unresolved-import"
  | "dependency"
  | "workspace"
  | "test";

export interface SemanticSearchEdge {
  readonly from: string;
  readonly kind: SemanticSearchEdgeKind;
  readonly to: string;
  readonly label?: string;
  readonly location?: SemanticSearchLocation;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchOwner {
  readonly path: string;
  readonly namespace?: string;
  readonly role: string;
  readonly public: boolean;
  readonly exports?: readonly string[];
  readonly nextActions?: readonly SemanticSearchNextAction[];
  readonly fields: SemanticSearchFields;
}

export type SemanticSearchItemKind =
  | "symbol"
  | "path"
  | "export"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "namespace"
  | "dependency"
  | "test"
  | "finding";

export interface SemanticSearchItem {
  readonly name: string;
  readonly kind: SemanticSearchItemKind;
  readonly ownerPath: string;
  readonly location?: SemanticSearchLocation;
  readonly fields: SemanticSearchFields;
}

export interface SemanticSearchTypeRef {
  readonly name?: string;
  readonly languageName?: string;
  readonly qualifiedName?: string;
  readonly carrier: string;
  readonly package?: string;
  readonly module?: string;
  readonly symbol?: string;
  readonly versionScope?: "current" | "external" | "unknown";
  readonly external?: boolean;
  readonly typeArguments?: readonly SemanticSearchTypeRef[];
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchTypeMember {
  readonly name: string;
  readonly role: string;
  readonly type: SemanticSearchTypeRef;
  readonly visibility?: "public" | "private" | "protected" | "internal" | "unknown";
  readonly optional?: boolean;
  readonly readonly?: boolean;
  readonly mutable?: boolean;
  readonly location?: SemanticSearchLocation;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchTypeSurface {
  readonly id: string;
  readonly name: string;
  readonly languageName?: string;
  readonly qualifiedName?: string;
  readonly kind: string;
  readonly role: string;
  readonly ownerPath: string;
  readonly location?: SemanticSearchLocation;
  readonly visibility: "public" | "private" | "protected" | "internal" | "unknown";
  readonly external: boolean;
  readonly source?: "native-parser" | "metadata" | "docs" | "ingest" | "unknown";
  readonly package?: string;
  readonly module?: string;
  readonly symbol?: string;
  readonly versionScope?: "current" | "external" | "unknown";
  readonly carrier?: SemanticSearchTypeRef;
  readonly members?: readonly SemanticSearchTypeMember[];
  readonly relatedTypes?: readonly SemanticSearchTypeRef[];
  readonly fields: SemanticSearchFields;
}

export type SemanticSearchHandleKind =
  | "policy-rule"
  | "schema-fixture"
  | "test-case"
  | "config-key"
  | "command"
  | "capability"
  | "dependency-api"
  | "public-api"
  | "owner"
  | "item"
  | "build-target"
  | "runtime-receipt"
  | "custom";

export type SemanticSearchHandleSource =
  | "native-parser"
  | "provider-policy"
  | "schema"
  | "manifest"
  | "test-index"
  | "runtime"
  | "registry"
  | "custom";

declare const semanticSearchHandleIdBrand: unique symbol;

declare const semanticSearchHandlePathBrand: unique symbol;

export type SemanticSearchHandleId = string & {
  readonly [semanticSearchHandleIdBrand]: "SemanticSearchHandleId";
};

export type SemanticSearchHandlePath = string & {
  readonly [semanticSearchHandlePathBrand]: "SemanticSearchHandlePath";
};

export function semanticSearchHandleId(value: string): SemanticSearchHandleId {
  return value as SemanticSearchHandleId;
}

export function semanticSearchHandlePath(value: string): SemanticSearchHandlePath {
  return value as SemanticSearchHandlePath;
}

export interface SemanticSearchHandle {
  readonly id: SemanticSearchHandleId;
  readonly kind: SemanticSearchHandleKind;
  readonly source: SemanticSearchHandleSource;
  readonly title: string;
  readonly languageName?: string;
  readonly qualifiedName?: string;
  readonly aliases?: readonly string[];
  readonly labels?: readonly string[];
  readonly status?: "active" | "advisory" | "deprecated" | "blocked" | "unknown";
  readonly ownerPath?: SemanticSearchHandlePath;
  readonly implementationOwnerPath?: SemanticSearchHandlePath;
  readonly testPaths?: readonly SemanticSearchHandlePath[];
  readonly locations?: readonly SemanticSearchLocation[];
  readonly queryTerms?: readonly string[];
  readonly fields?: SemanticSearchFields;
}
export interface SemanticSearchReasoningProfileSelector {
  readonly kind:
    | "owner"
    | "query"
    | "dependency"
    | "test"
    | "finding"
    | "import"
    | "feature"
    | "custom";
  readonly alias: string;
  readonly target?: string;
  readonly targetRole?: string;
  readonly required?: boolean;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchReasoningProfile {
  readonly profile: string;
  readonly description?: string;
  readonly selectors: readonly SemanticSearchReasoningProfileSelector[];
  readonly returns: readonly string[];
  readonly frontier?: readonly string[];
  readonly fields?: SemanticSearchFields;
}

export type SemanticSearchHitKind =
  | "path"
  | "export"
  | "symbol"
  | "callsite"
  | "import"
  | "dependency"
  | "api"
  | "test"
  | "text";

export interface SemanticSearchHit {
  readonly kind: SemanticSearchHitKind;
  readonly ownerPath: string;
  readonly symbol?: string;
  readonly location: SemanticSearchLocation;
  readonly score: number;
  readonly reason: string;
  readonly snippet?: string;
  readonly surface?: SemanticSearchSurfaceKind;
  readonly realOwner?: boolean;
  readonly fixturePath?: string;
  readonly fixtureOwner?: string;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchFinding {
  readonly ruleId: string;
  readonly severity: "info" | "warning" | "error";
  readonly count: number;
  readonly title?: string;
  readonly location: SemanticSearchLocation;
  readonly fields?: SemanticSearchFields;
}

export type SemanticSearchNextActionKind =
  | "workspace"
  | "prime"
  | "owner"
  | "dependency"
  | "deps"
  | "api"
  | "public-external-types"
  | "symbol"
  | "callsite"
  | "import"
  | "tests"
  | "lexical"
  | "ingest";

export interface SemanticSearchNextAction {
  readonly kind: SemanticSearchNextActionKind;
  readonly target: string;
  readonly scope?: string;
  readonly ownerPath?: string;
  readonly fields?: SemanticSearchFields;
}

export type SemanticSearchNoteKind =
  | "not-found"
  | "empty-query"
  | "fact-scope"
  | "owner-level"
  | "owner-not-found"
  | "runtime-prefilter"
  | "unrecognized-input";

export interface SemanticSearchNote {
  readonly kind: SemanticSearchNoteKind;
  readonly message: string;
  readonly fields?: SemanticSearchFields;
}

export interface SemanticSearchLocation {
  readonly path: string;
  readonly lineRange?: string;
}

export const MAX_PRIME_OWNERS = 8;
export const MAX_PRIME_EDGES = 24;
export const MAX_FINDINGS = 8;
export const MAX_WORKSPACE_PACKAGES = 24;
export const MAX_WORKSPACE_EDGES = 8;
export const MAX_LEXICAL_HITS = 12;
export const MAX_SYMBOL_HITS = 20;
export const MAX_IMPORT_HITS = 30;
