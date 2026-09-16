# Rule Catalog

ASP TypeScript exposes deterministic rule metadata through compact library
functions:

- `typeScriptRulePackDescriptors()`
- `typeScriptSyntaxRules()`
- `typeScriptSemanticRules()`
- `typeScriptProjectPolicyRules()`
- `typeScriptModularityRules()`
- `typeScriptTestLayoutRules()`
- `typeScriptAgentPolicyRules()`
- `typeScriptExtensionPolicyRules()`
- `typeScriptRulePackRuleIds()`

## Default Rule Packs

Default project execution runs these packs:

1. `typescript.syntax`
2. `typescript.semantic`
3. `typescript.project_policy`
4. `typescript.modularity`
5. `typescript.test_layout`
6. `typescript.agent_policy`
7. `typescript.extension_policy`

The implementation enforces parser-native syntax and project rules, then
surfaces native semantic diagnostics, module-graph, test-layout, and
agent-repair advice from parser-owned facts. Extension policy is downstream of
package extension activation facts and parser-native source facts; it must not
read manifests or TypeScript ASTs directly. New rules should be added only
after the parser layer exposes the native facts they require.

## Policy Configuration

M4 exposes Rust-aligned policy configuration without exporting the rule engine.
Callers can use `TypeScriptRulePack` and the helper functions
`withDisabledTypeScriptRule()`, `withDisabledTypeScriptRules()`,
`withDisabledTypeScriptRulePack()`, `withTypeScriptRuleSeverity()`,
`withTypeScriptRulePackSeverity()`, and
`withTypeScriptBlockingSeverities()` from the package facade.

Policy is applied after all default packs evaluate over the reasoning tree.
The order is deterministic: disabled rules and disabled packs remove findings
first, rule-pack severity overrides apply next, and single-rule severity
overrides win last. `blockingRuleIds` remains a report-time promotion mechanism
for advisory rules; it does not mutate catalog severity.

## Blocking Rules

- `TS-SYN-R001`: TypeScript source must parse through the TypeScript Compiler
  API.
- `TS-AGENT-PROJECT-001`: TypeScript project runs should have a `tsconfig.json`.
- `TS-AGENT-PROJECT-002`: `tsconfig.json` must parse through TypeScript's native config
  parser.
- `TS-EXT-EFFECT-R001`: when `package.json` explicitly enables the Effect
  extension, the `effect` dependency must be declared so the configured policy
  can run against a real project dependency.
- `TS-EXT-REACT-R001`: when `package.json` explicitly enables the React
  extension, the `react` dependency must be declared so the configured policy
  can run against a real project dependency.
- `TS-EXT-REACT-R003`: when the React extension is active, Hooks must keep a
  stable top-level call order in exported components and custom Hooks. The
  parser reports conditionals, loops, nested functions, hooks after conditional
  returns, and `try`/`catch`/`finally` contexts. This is an error because the
  code can break React state preservation and render consistency.

## Agent Advice Rules

`TS-SEM-*`, `TS-AGENT-PROJECT-003`, `TS-AGENT-PROJECT-004`, `TS-AGENT-PROJECT-005`,
`TS-AGENT-PROJECT-006`, `TS-MOD-*`, `TS-TEST-*`, `TS-AGENT-*`, and
`TS-EXT-EFFECT-R002` through `TS-EXT-EFFECT-R010`, `TS-EXT-REACT-R002`, and
`TS-EXT-REACT-R004` rules are `info` findings. They are rendered by default for
repair agents but do not fail assertions unless a caller promotes them or uses
the agent test-gate helper `assertAspTypeScriptAgentClean()`.
The agent test-gate helper renders grouped compact advice text so large
projects keep a bounded first reading surface for agents.

- `TS-SEM-R001`: TypeScript `Program` semantic diagnostics should be visible
  from parser-native facts, including stable TypeScript diagnostic codes,
  without replacing `tsc`.
- `TS-AGENT-PROJECT-003`: root, project-reference, and workspace-package `package.json`
  files should parse so package entry fields, exports/imports/bin, script,
  workspace, referenced package, and workspace package facts are visible.
  Package diagnostics, entry locations, conditional exports/imports target
  details, script locations, and workspace locations come from TypeScript's JSON AST.
- `TS-AGENT-PROJECT-004`: TypeScript project references should point to package-local
  configs whose parser-owned compiler option facts show `composite` and
  `declaration` enabled. This stays non-blocking so agents can still inspect
  partial workspaces.
- `TS-AGENT-PROJECT-005`: projects using package `exports` or `imports` should have an
  effective TypeScript `moduleResolution` of `node16`, `nodenext`, or `bundler`.
  The value comes from TypeScript compiler-option facts, including defaults
  implied by `module`, not raw JSON string matching.
- `TS-AGENT-PROJECT-006`: projects with parser-visible Rspack package/config facts
  should expose that build surface through package scripts. This helps agents
  run `npm run build` or `npm run check` without adding ad-hoc local gate
  scripts, and it remains non-blocking advice.
- `TS-MOD-R001`: production source, facade, entrypoint, and config modules
  should not depend on parser-visible test owners.
- `TS-MOD-R002`: package project modules should stay below their layer line
  budgets and split by concern. The rule scans the whole package reasoning
  tree, not a single hard-coded file. Parser, reasoning, and model layers use
  the strictest budget; policy, ASP TypeScript, and render layers have explicit
  orchestration budgets instead of sharing one hard-coded threshold.
- `TS-TEST-R001`: when configured test roots exist, parser-visible test modules
  should live under those roots.

- `TS-AGENT-POLICY-001`: project imports, including relative imports, unresolved
  configured path aliases, and unresolved `#` package imports, should resolve
  to a parser-visible TypeScript owner or be documented as a non-TypeScript
  asset.
- `TS-AGENT-POLICY-002`: package exports/imports should resolve to parser-visible
  TypeScript owners or documented external artifacts.
- `TS-AGENT-POLICY-003`: facade `index.*` modules that re-export multiple owners
  should include a local intent doc.
- `TS-AGENT-POLICY-004`: public functions should avoid multiple boolean mode
  parameters when a named options object or discriminated union would preserve
  agent-visible intent.
- `TS-AGENT-POLICY-005`: public functions should avoid broad positional parameter
  surfaces when a named request/options object would preserve call semantics.
- `TS-AGENT-POLICY-006`: public tuple parameters and return values that bundle
  primitive semantic values should use named object, tuple alias, or domain
  types.
- `TS-AGENT-POLICY-007`: public functions with deeply nested or branch-heavy
  algorithm shape should expose guard clauses, discriminated dispatch, or small
  named steps.
- `TS-AGENT-POLICY-008`: broad linear public functions should split algorithm
  responsibilities into small named helpers or pipeline steps.
- `TS-AGENT-POLICY-009`: public source data surfaces should avoid clusters of
  semantic primitive fields such as identifiers, URLs, paths, byte/time units,
  or boolean mode fields unless the raw DTO boundary is explicit. ASP TypeScript
  model-layer modules, including nested `src/**/model.ts` schema modules, stay
  outside this advice surface.
- `TS-AGENT-POLICY-010`: public semantic type aliases such as `OwnerId = string`
  should use a branded type, opaque wrapper, or named domain object so agents
  do not treat the alias as a real type boundary. Literal-union catalog aliases
  such as `Status = "pending" | "done"` are accepted.
- `TS-AGENT-POLICY-011`: public data models should avoid raw string state, status,
  kind, mode, phase, type, tag, or category fields when a string-literal union,
  public enum, branded type, or typed catalog boundary would preserve the
  finite state space.
- `TS-AGENT-POLICY-012`: public discriminated-union variants should avoid broad
  primitive semantic payloads when named domain types or named payload objects
  would preserve event and command invariants.
- `TS-EXT-EFFECT-R002`: when the Effect extension is active, public source APIs
  that expose async domain work should prefer `Effect.Effect<A, E, R>` return
  types over raw `Promise` or implicit async Promise surfaces. Promise interop
  remains valid at adapters and runtime boundaries. Activation is project-wide:
  an `effect` dependency or explicit Effect config asks ASP TypeScript to guide
  agents toward `Effect.Effect<Success, DomainError, Requirements>`,
  `Effect.tryPromise({ try: () => promise, catch: (cause) => ... })`, and
  entrypoint/adapter-only `Effect.run*` execution. Explicit Effect config only
  enables the project-wide extension; it cannot provide per-file allowlists that
  suppress source-owner findings.
- `TS-EXT-EFFECT-R003`: when the Effect extension is active, source modules
  should return Effect descriptions and leave `Effect.run*` / `Runtime.run*`
  execution to entrypoint, framework adapter, or managed runtime integration
  boundaries. Runtime adapters are parser-visible facts, not allowlists: package
  `bin`/script targets and exported HTTP middleware factories with native server
  imports can be classified as entrypoints by the reasoning tree. React Query
  `queryFn` and `mutationFn` callbacks are also parser-owned runtime integration
  boundaries when the AST shows a real `useQuery`/`useMutation` options object;
  ordinary React component render code remains a source owner.
- `TS-EXT-EFFECT-R004`: when public Effect service method signatures expose a
  non-`never` requirements type, the service API should usually move that
  dependency into Layer/runtime construction so consumers do not inherit
  implementation wiring through every method.
- `TS-EXT-EFFECT-R005`: when public Effect APIs expose primitive, `any`,
  `unknown`, or `void` error channels, the API should use a tagged/domain error
  type so recovery intent remains visible to agents and `catchTag` style
  handling.
- `TS-EXT-EFFECT-R006`: when public Effect APIs wrap `async`, `throw`, or
  `Promise.reject` callbacks with `Effect.promise`, they should use
  `Effect.tryPromise` with explicit domain error mapping.
- `TS-EXT-EFFECT-R007`: when public Effect APIs construct resources with
  `Effect.acquireRelease` without a local `Effect.scoped` boundary, they should
  make scope closure explicit or document the exported resource boundary.
- `TS-EXT-EFFECT-R008`: when Effect projects own async batch work, they should
  declare concurrency and failure policy through Effect collection combinators.
  Parser-native facts detect `Promise.all` / `Promise.race` style fan-out,
  await-in-loop batch work, and Effect collection combinators such as
  `Effect.forEach` / `Effect.all` that omit `{ concurrency: ... }`. Compact
  advice points agents toward `Effect.forEach(items, item => workEffect(item),
{ concurrency: n })`, `Effect.all(effects, { concurrency: n })`, named
  project concurrency budgets, and explicit fail-fast, validation, partition,
  or `Effect.allSuccesses` semantics.
- `TS-EXT-EFFECT-R009`: when Effect projects parse untrusted JSON at public
  source owners, they should decode the boundary with Effect Schema instead of
  returning raw `unknown` payloads. Parser-native facts detect `JSON.parse` and
  `response.json()` calls and suppress the advice when the same owner already
  uses local `Schema.decode*`, `Schema.validate*`, `Schema.parseJson`,
  `Schema.is`, or `Schema.asserts` evidence. Compact advice points agents
  toward `Schema.decodeUnknown`, `Schema.decodeUnknownEither`, or
  `Schema.parseJson` plus typed domain parse errors.
- `TS-EXT-EFFECT-R010`: when Effect projects construct public external IO
  boundaries, the boundary should expose production observability and
  resilience policy. Parser-native facts detect `Effect.tryPromise`,
  `Effect.promise`, `Effect.async`, and `fetch` calls, then suppress the advice
  when the same owner already shows both observability evidence
  (`Effect.withSpan`, Effect logging/annotations, or `Metric.*`) and
  resilience evidence (`Effect.retry*` or `Effect.timeout*`). Compact advice
  points agents toward stable span names, log/span attributes, duration or
  counter metrics, retries with `Schedule`, and timeouts.
- `TS-EXT-REACT-R002`: when the React extension is active, exported React
  components and hooks should keep render paths idempotent and free of browser
  writes. Parser-native facts classify public PascalCase components and
  `use*` hooks, then records obvious render-purity signals such as `new Date`,
  `Date.now`, `Math.random`, and `document`/`window` assignment. Compact advice
  tells agents to move non-idempotent work to lazy state, event handlers,
  server/domain inputs, or Effect/domain boundaries, and to move browser writes
  into `useEffect` or event handlers. This is React extension policy, not a
  replacement for eslint-plugin-react-hooks or React Compiler diagnostics.
- `TS-EXT-REACT-R004`: when the React extension is active, components and
  custom hooks should be static module-level definitions. Parser-native facts
  detect nested PascalCase components and `use*` hook definitions inside public
  component/hook render owners. Compact advice tells agents to hoist the
  definitions, pass render-local values through props or explicit hook
  parameters, and select between existing component references instead of
  constructing new component types during render.

## Reasoning Tree Policy

ASP TypeScript treats a TypeScript package as an agent reasoning tree: the nearest
parent `package.json` anchors the package project, `tsconfig.json` selects the
TypeScript source set, `package.json` declares public package subpaths, source
files expose parser-owned imports/exports, and import edges show whether a
dependency is relative, path-alias backed, package-import backed, external, or
unresolved. Package entry resolution maps exports/imports bin targets, and
package fields such as `main`, `module`, `types`, `typings`, and `browser` back
to parser-visible owners when possible, including common `outDir` to
source-root mappings. Package entry advice points at the JSON AST location for
the exact `exports`, `imports`, or `bin` target when available, including
conditional package target branches.
Parser-visible `bin` targets and TypeScript targets referenced by package
scripts also mark the owner module as an `entrypoint`; when those targets live
under `src/cli` or `src/bin`, sibling adapter modules in that tree inherit the
entrypoint role. Package scripts, workspace patterns, and resolved workspace
package metadata are rendered as orientation facts; they remain non-blocking
and do not become package-manager policy.
Package-name dependency rows include whether the package owner came from a
TypeScript project reference or a workspace package fact, so agents can edit the
right owner boundary without guessing.
M9 also carries parser-native public API/data/control-flow facts in each
reasoning module. Active agent policy uses those facts for public API and
algorithm-shape repair hints. M11 adds the first data-shape hint from those
facts: it reports only source data surfaces with at least three semantic
primitive fields, and skips the `model` layer so schema/fact definitions do not
become generic DTO style findings. M12 extends the same parser-owned surface
with public primitive type alias facts and discriminated-union variant payload
facts, then keeps the resulting type-boundary advice low-noise and `info` by
default. It does not replace `tsc` exhaustiveness checks or ESLint naming
policy.
M13 adds known extension activation facts. The parser may read package
dependency fields only to derive `packageExtensions` for a known extension such
as Effect. That fact can activate extension policy and snapshot capability
lines, but it does not expose a generic manifest dependency model and it does
not create package-manager gates.
M16 adds parser-owned build-tool facts for Rspack/Rsbuild-family projects. The
parser may read known package dependency names, package scripts, config-file
presence, and optional `asp-typescript.buildTools` config to produce
`packageBuildTools` facts. Policy consumes only those typed facts and keeps the
result as agent orientation/advice.
M17 starts Effect capability-boundary coverage for Schema validation. The
parser owns JSON-boundary and Schema-decode evidence; extension policy consumes
only the reasoning-tree facts and keeps the result as low-noise agent advice.
M18 adds Effect production-observability coverage for external IO boundaries.
The parser owns interop/fetch and telemetry/resilience evidence; extension
policy consumes only those facts and keeps the result as non-blocking repair
guidance.
When TypeScript selects JavaScript through `allowJs`, parser-visible `.js`,
`.jsx`, `.mjs`, and `.cjs` files participate in the same module-role policy as
TypeScript files.
Shadowed owner namespaces and orphaned source files are reasoning-tree
orientation metrics. They may appear as `shadowed=` and `orphaned=` counters in
agent snapshots, but they do not create default rule findings in M3.

`renderTypeScriptReasoningTree()` exposes those facts as Rust-style agent
snapshot text: `Modules:`, `Extensions:`, `BuildTools:`, `OwnerBranches:`,
`OwnerDependencies:`, and `FindingGroups:`. It groups diagnostics by rule id and owner path instead of
rendering full diagnostic cards. Full TypeScript diagnostic codes, source
lines, and related information remain available in the default compact finding
renderer and JSON output. The snapshot is not a style report and it does not
replace JSON for tools; it is the low-noise orientation surface agents should
inspect before editing.

## Future Agent Advice

`TS-PROJ-*` advice beyond the structural blocking rules, `TS-MOD-*`,
`TS-TEST-*`, and `TS-AGENT-*` rules should be `info` findings. They are intended
as repair hints for LLMs and should not block by default. Candidate future rules
include:

- source paths should avoid generic buckets such as `utils` and `shared`
- owner dependency graphs should avoid local cycles and leaf-module reach-ins

Each candidate depends on parser-owned TypeScript facts. Do not implement these
rules with regular expressions over source text.

## Rendered Diagnostic Policy

Compact text is the primary repair surface:

1. stable rule id
2. source location
3. highlighted source line when available
4. short pointer label
5. one `Help:` line from the concrete finding summary, including TypeScript
   diagnostic code when available
6. one `Contract:` line from the stable rule requirement

Agent snapshots may also render TypeScript related diagnostic information as
indented `related` lines under the primary diagnostic.

Structured consumers should use `renderAspTypeScriptJson()` or the
serializable report shape instead of parsing compact text.

## Parser-First Policy

TypeScript semantic policy is parser-first. Project rule packs consume
reasoning-tree facts instead of opening TypeScript files and guessing from raw
text. The parser layer owns TypeScript Compiler API facts, `Program` semantic
diagnostics, diagnostic codes, related diagnostic information, `tsconfig`
facts, source-line capture, imports, exports, script kind, declaration-file
status, top-of-file intent docs, granular type-only import/export facts,
`import("...")` type query imports, declaration export assignments,
package entry metadata, package metadata diagnostics and package metadata source
locations for root, project-reference, and workspace packages, compiler-option
facts, effective module resolution, referenced package compiler-option facts,
module line counts, package-root anchored module layers, parser-native public
API/data/control-flow facts, and project/module-level diagnostic facts consumed
by the reasoning tree. The reasoning layer owns
source-shape projections such as shadowed owner namespaces and orphaned source
files after native parser facts and TypeScript import resolution are available.
ASP TypeScript layer
owns rule catalogs, project/test layout policy, reporting, and assertion
behavior. Rule evaluation consumes the reasoning tree, including its typed
`runMode`, not parser module reports or project parser scopes. The
explicit-path runner attaches a minimal reasoning tree so file-local syntax
findings also flow through reasoning-tree diagnostic facts. Compact output
counts use reasoning-tree module validity, and compact finding locations are
relative to the reasoning tree root.
