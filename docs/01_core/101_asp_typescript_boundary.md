# ASP TypeScript Boundary

`asp-typescript` owns a standalone, library-first TypeScript
ASP TypeScript. It exists because `tsc`, ESLint, and Prettier do not provide a
compact project reasoning tree for repair-oriented agents.

## Ownership

This repository may:

1. parse TypeScript and TSX modules through the TypeScript Compiler API
2. parse `tsconfig.json` through TypeScript's config parsing APIs
3. parse package metadata through TypeScript's JSON parser
4. discover project files from `tsconfig` and conventional TypeScript roots
5. evaluate deterministic rule packs over parser-owned facts
6. render compact diagnostics for humans and repair-oriented agents
7. expose structured reports and JSON rendering for tooling
8. expose a thin CLI over the default project runner

This repository must not own:

1. application runtime orchestration
2. framework-specific build execution
3. CI-provider-specific policy
4. package-manager installation workflows
5. project-specific allowlists hidden inside the library
6. long-running daemon behavior

## Parser Boundary

The parser layer owns TypeScript-native facts. Standalone files are parsed with
`ts.createSourceFile`; project runs build a TypeScript `Program` and resolve
module specifiers with TypeScript's module resolver. `tsconfig.json` is read
with `ts.readConfigFile` and `ts.parseJsonConfigFileContent`. Parser reports
carry syntax diagnostics, `Program` semantic diagnostics, native diagnostic
codes, related diagnostic information, imports, type-only import/export
markers, import resolution facts, exports, namespace/star re-export facts,
script kind, declaration-file status, source-line data, and project config
facts.
Project runs respect TypeScript's native file selection, including JavaScript
and JSX files selected by `allowJs`; fallback discovery without `tsconfig.json`
remains TypeScript-file-only.
Parser-visible JavaScript modules use the same role vocabulary as TypeScript
modules: `entrypoint`, `facade`, `source`, `test`, `config`, `declaration`, and
`unknown`.
Type-only markers include declaration-level `import type` / `export type`,
specifier-level `import { type T }` / `export { type T }`, and `import("...")`
type queries. Declaration-file export facts include `export =` and
`export as namespace`.
Project facts include `compilerOptions.paths`, `baseUrl`, `rootDirs`,
module/effective moduleResolution/target, JSX/emit/declaration options, project
references, TypeScript JSON AST-backed package entry fields,
exports/imports/bin/scripts/workspaces, conditional exports/imports target
details, package metadata source locations, package metadata diagnostics,
referenced package metadata and referenced package compiler options from
TypeScript project references, workspace
package metadata from root `workspaces`, package-root anchored module roles,
module layers, module line counts, owner branches, owner dependencies, package
entry owners, parser-native public API/data/control-flow facts,
known package extension activation facts such as Effect,
shadowed/orphaned source-shape counters, and import edges.
Parser-visible package `bin` owners and TypeScript targets referenced by
`package.json` scripts feed the `entrypoint` module role. When a package-owned
entrypoint sits under `src/cli` or `src/bin`, that adapter tree is treated as
entrypoint surface so project-wide Effect advice stays aimed at reusable source
owners.
Effect package config only declares activation. It does not expose per-file
allowlists that can narrow project-wide coverage; parser-owned module roles are
the only structural mechanism that keeps entrypoint surfaces out of reusable
source-owner advice.
Effect async/concurrency advice also starts in parser-native facts: the parser
records Promise combinator fan-out, await-in-loop batch work, and Effect
collection calls that omit explicit concurrency options. Rule packs consume
those facts to produce low-noise agent instructions; they do not rescan source
text to infer concurrency policy.
Parser-visible `index.*`, `main.*`, config, and test file roles are matched by
explicit module suffix lists, not dynamic regular-expression construction.
Workspace package config facts are package-root local: a workspace package only
reports `configPath` when that package directory contains its own
`tsconfig.json`, never by inheriting the root project's config.

Project rule packs consume the reasoning tree assembled from those reports.
They must not re-parse TypeScript source or infer TypeScript semantics from raw
text. If a future rule needs project references, path aliases, package exports,
JSX mode, declaration emit, package import owner facts, or public surface facts,
the parser layer must expose those facts first and the reasoning tree must carry
the project-level projection.
Semantic diagnostics are a parser-owned fact from TypeScript's native
`Program`; rule packs may surface them as advice, including stable codes such
as `TS2322` and native related spans, but they must not call TypeScript parser
APIs directly.
Public API shape, exported primitive data fields, and public function
control-flow shape are also parser-owned native syntax facts. M9 projects those
facts into the reasoning tree and enables only low-noise public API and
algorithm-shape advice. Exported primitive data-field facts are available for
future policies and downstream tools, but they do not create a default style or
DTO gate.
M13 adds parser-owned public async API facts and package-owned Effect extension
activation facts. M14 adds parser-owned Effect runtime-call facts, public
Effect service method return-type facts, parser-classified weak Effect
error-channel facts, and parser-classified rejection-capable Promise interop
facts. M15 adds parser-classified `Effect.acquireRelease` resource-scope facts
and Effect concurrency/failure-policy signals. M17 adds parser-classified JSON
boundary facts for `JSON.parse` and `response.json()` plus local Effect Schema
decode evidence. M18 adds parser-classified production boundary facts for
public external IO owners that use `Effect.tryPromise`, `Effect.promise`,
`Effect.async`, or `fetch` without both observability and resilience evidence.
M21 keeps that parser-first boundary while recognizing React Query `queryFn` and
`mutationFn` callbacks as framework runtime integration points for
`Effect.run*`, based on native object-literal/call-expression structure rather
than package-config allowlists.
Extension rules consume those facts to advise on public async
domain-effect boundaries, runtime execution boundaries, service/layer
requirement boundaries, typed expected-error boundaries, `tryPromise`
interop/resource-scope boundaries, concurrency boundaries, and Schema
validation/production boundaries; they do not read package metadata or
TypeScript ASTs from the rule layer.

The reasoning tree consumes parser-owned import resolution and diagnostic facts,
including source syntax, TypeScript semantic, `tsconfig`, and package JSON
parser diagnostics. It may render or compact those facts for rule packs and
agent output, but it must not reimplement TypeScript's relative, `paths`,
`rootDirs`, package imports, or external module resolution.
Unresolved relative imports, unresolved configured path aliases, and unresolved
`#` package imports are rendered as `unresolved`; resolved `#` imports stay
`package-import`.

Rule evaluation starts after the reasoning tree exists. The rule layer consumes
the reasoning tree, including its `runMode`; it must not accept parser module
reports or project parser scopes as policy inputs. Reports expose this marker
as `runMode` so structured consumers can distinguish project-scoped policy from
explicit-path checks without reverse-engineering optional project fields. Every
ASP TypeScript report carries a reasoning tree: full project facts for project runs
and minimal parser-owned file facts for explicit-path runs.
Agent-facing modularity and repair rules use reasoning-tree owner facts such
as `ownerBranches` and `ownerDependencies` before falling back to lower-level
edge facts. Snapshot rendering filters test-context owner dependencies the same
way Rust's agent snapshot hides test-context dependency rows.
Rule execution is split into catalog, engine, and pack modules. Policy
configuration is applied after pack evaluation: disabled single rules and
disabled built-in packs remove findings, rule-pack severity overrides apply,
and single-rule severity overrides win last. This keeps project-local policy
configuration outside parser facts while preserving deterministic rule output.
Compact file and parsed counts are computed from reasoning-tree module
validity, not directly from parser module reports. Compact finding locations
are rendered relative to the reasoning tree root, so explicit-path output does
not fall back to absolute host paths.

Text reads remain acceptable for non-semantic surfaces: compact rendering can
show source lines, and tests can inspect source text to enforce the parser
boundary. Package metadata should still enter through `ts.parseJsonText` so
diagnostics and entry locations stay parser-owned. Text reads must not become
policy logic for TypeScript syntax, imports, exports, or ownership.

## Runner Modes

Use `runAspTypeScript()` when a caller has a project path. The
project runner first resolves the nearest parent `package.json` and uses that
directory as the package project anchor. It then reads `tsconfig.json` when
present and uses TypeScript's own config parser to select root file names.
Without a config file, it falls back to conventional recursive TypeScript file
discovery while emitting project-policy guidance from the reasoning tree's
missing `configPath` fact.

Use `runAspTypeScriptPaths()` for explicit files or directories. This runner
is useful for focused parser checks and editor integrations. It attaches a
minimal reasoning tree built from parser-owned file facts, so syntax diagnostics
still flow through reasoning-tree diagnostic facts before rule packs render
findings. Project-scoped policy stays quiet unless a project scope is available.

## Reasoning Tree

`renderTypeScriptReasoningTree()` turns a report into a compact agent snapshot.
It follows the ASP Rust agent snapshot shape: `Modules:`, `Extensions:`,
`BuildTools:`, `OwnerBranches:`, `OwnerDependencies:`, and `FindingGroups:`. It renders reasoning-tree
`ownerBranches` and `ownerDependencies` facts built from parser-owned module
roles, source exports, import specifiers, TypeScript-native
relative/path-alias/package/external import resolution, package-name import
owners, resolved workspace packages, project references, and package entry
owners. It also carries source-shape counters such as shadowed owner
namespaces and orphaned source files as compact orientation metrics, not
blocking policy. It groups findings by rule instead of rendering full
diagnostic cards.
Long branch surfaces and child-edge lists are capped. Empty child-edge
placeholders are omitted, and repeated owner dependencies can be rendered as
fan-out or fan-in groups.
This is the preferred first read when an agent needs to choose which TypeScript
owner, facade, entrypoint, or package surface to edit. Full diagnostic detail
stays in the default compact renderer and JSON output.

## Verification Policy

M5 adds a verification planner downstream of the same reasoning tree. It maps
configured owner profile hints to external task contracts such as `stress`,
`performance`, `chaos`, `security`, `regression`, and
`responsibility_review`. M6 adds a profile index that drafts missing or drifting
profile hints from parser-owned owner facts. M7 adds report obligations,
configured-skill task indexes, and report-bundle JSON renderers. M8 adds
performance indexes, report writing, receipt artifact metadata, complete waiver
checks, disabled task-kind controls, and dependency signals for profile
responsibility inference. These surfaces consume parser-owned module roles,
layers, import summaries, owner dependencies, package/import owner facts,
receipts, waivers, configured skill descriptors, and planned task facts; none
calls TypeScript parser APIs or parser helper functions.

Verification output is a compact reminder surface for agents. It hides tasks
with matching passed receipts or complete waivers, keeps failed receipts and
incomplete waivers visible, and renders expandable skill contracts separately
from first-read task lines. When active tasks require artifacts, it adds a
compact `[verify-report]` block naming the report bundle and required JSON
artifacts. Profile-index output renders only missing or drifting profile
candidates and goes quiet once config covers the suggested responsibilities.
Dependency signals remain profile inference only; they never become manifest
dependency checks.

## Blocking And Advice

`warning` and `error` findings block assertions by default. `info` findings are
advisory. TypeScript semantic diagnostics are reported as `TS-SEM-R001` advice
because they should be visible to agents without turning ASP TypeScript into a
replacement for `tsc`. Malformed `package.json` metadata is reported as
`TS-AGENT-PROJECT-003` advice, including malformed package metadata in TypeScript
project references, so the ASP TypeScript can still produce a repair surface.
Project-reference config shape and package-entry module-resolution shape are
reported as `TS-AGENT-PROJECT-004`/`TS-AGENT-PROJECT-005` advice from parser-owned
compiler-option facts, not package-manager or style policy. Rspack build-tool
visibility is reported as `TS-AGENT-PROJECT-006` advice from parser-owned package
dependency/script facts and config-file presence; it does not become a manifest
dependency gate. Modularity findings are `TS-MOD-*` ownership advice over the
parser-owned reasoning tree, and test layout findings are `TS-TEST-*` advice
over parser-owned module roles and configured test roots. M9
`TS-AGENT-POLICY-004` through `TS-AGENT-POLICY-008` surface
parser-native public API and algorithm-shape advice as `info`, and M11
`TS-AGENT-POLICY-009` surfaces conservative public data-shape advice from the same
parser-native fact chain. M12 adds parser-owned public type alias and
discriminated-union payload facts for `TS-AGENT-POLICY-010` through `TS-AGENT-POLICY-012`,
covering primitive semantic aliases, stringly state fields, and broad primitive
union payloads without promoting them to blocking policy. M13 adds
`TS-EXT-EFFECT-R001` as an `error` when package config explicitly enables the
Effect extension but the `effect` dependency is missing, and
`TS-EXT-EFFECT-R002` as project-wide `info` advice for active Effect projects
whose public async domain APIs still expose raw Promise surfaces.
`TS-EXT-EFFECT-R003` through `TS-EXT-EFFECT-R010` remain non-blocking Effect
capability advice over parser-owned runtime, service, error-channel,
Promise-interop, resource, concurrency, Schema, and production-observability
facts. M19 adds the same package-owned extension shape for React:
`TS-EXT-REACT-R001` is an `error` when explicit React extension config lacks a
`react` dependency, while `TS-EXT-REACT-R002` stays `info` advice over
parser-native component/hook owner facts and render-purity signals. M20 adds
`TS-EXT-REACT-R003` as an error-level Rules of Hooks structure finding and
`TS-EXT-REACT-R004` as static component/hook definition advice. Future
`TS-MOD-*`, `TS-TEST-*`, and `TS-AGENT-*` rules should remain non-blocking
unless a caller explicitly promotes them.

## Non-Goals

The first standalone version does not replace `tsc`, ESLint, Prettier,
framework compilers, bundlers, or package-manager audits. ASP TypeScript should
avoid rules those tools already own and focus on project facts that help agents
choose the correct owner, entrypoint, facade, and edit surface.
M8 does not implement the full Rust verification execution subsystem. It plans
verification tasks, drafts profile candidates, renders report bundle contracts,
and writes caller-requested JSON artifacts only. Running external skills and
managing long-lived verification receipts remain future work. Dependency facts
and package metadata stay orientation inputs unless a later project-owned
policy explicitly promotes them.
M9 also does not add a broad TypeScript style gate. It imports Rust's
parser-native agent-policy idea only where TypeScript-native syntax facts can
produce low-noise repair advice.
