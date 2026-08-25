# Development

## Format, Typecheck, Test

```shell
direnv exec . npm install
direnv exec . npm run check:implementation
direnv exec . npm run check:policy
direnv exec . npm run lint
direnv exec . npm run format:check
direnv exec . npm run test:implementation
direnv exec . npm run test:policy
direnv exec . npm run harness
direnv exec . git diff --check
```

## Global CLI Install

Install the local checkout as the global `asp-typescript` binary before testing
agent hook flows from other repositories:

```shell
direnv exec . npm install -g --prefix /opt/homebrew .
asp-typescript agent doctor .
asp-typescript search prime --workspace . --view seeds
asp-typescript agent install --client codex .
asp-typescript agent guide --client codex .
```

The explicit prefix avoids the devenv/Nix global npm prefix, which may be
read-only. On Linux, use the writable global prefix that is already on
`PATH`, for example `--prefix ~/.local`.
Run the install command from the repository that should own the active Codex
session; it writes `.codex/config.toml` delegating hook events to the global
`asp-typescript` binary. Existing config is merged, not overwritten, so
Rust+TypeScript repositories can keep both harness hook blocks. For a Codex
session rooted at a Rust harness repo while editing a TypeScript harness repo,
install into the Rust session root as well; that root config is the one Codex
loads for the current conversation.

## Native Parser Boundary

This package is parser-first. TypeScript source semantics must be extracted
through the TypeScript Compiler API and `tsconfig` parsing APIs in
the `src/parser.ts` facade and `src/parser/` parser layer. Rule packs consume parser-owned facts; they must not scan
TypeScript source text to infer imports, exports, syntax validity, project
references, or module ownership.
When a rule needs a new TypeScript concept, add a parser fact first, then
consume that fact from reasoning/render/rules.
M9 parser-native source facts live under `src/parser/native_syntax/`: public
API shape, public primitive data-field shape, and public function control-flow
shape. Keep new TypeScript AST walking in that parser sublayer, project the
facts into the reasoning tree, and make rule packs consume only those projected
facts.
Project semantic diagnostics must come from the parser-owned TypeScript
`Program`; rule packs and renderers may only consume the reported
`semanticDiagnostics` facts. Preserve TypeScript diagnostic codes such as
`TS2322` and related diagnostic spans in rendered output; they are stable
repair anchors for agents.
Reasoning tree diagnostics are a compact aggregation of parser-owned module
diagnostics. Do not make renderers walk TypeScript ASTs or call TypeScript
`Program` APIs to recover diagnostics.
Project-level rule packs should consume reasoning tree facts once the project
or explicit-path runner has built them. The explicit-path runner has no project
scope, but it still attaches a minimal reasoning tree so file-local diagnostics
flow through the same policy surface. Rule evaluators should not accept parser
module reports or project parser scopes as policy inputs. Use
`TypeScriptReasoningTree.runMode` when policy needs to distinguish project runs
from explicit-path checks. Keep `TypeScriptHarnessReport.reasoningTree`
required so new output modes cannot bypass the reasoning surface. Compact file
and parsed counts should come from reasoning-tree module validity, not from raw
parser module reports. Compact finding locations should be relative to
`TypeScriptHarnessReport.reasoningTree.projectRoot`. Compact renderers should
not read `report.modules`, `report.projectResolution`, or `report.rootPaths`; those
remain structured report fields rather than the agent output authority surface.
Project runs resolve the nearest parent `package.json` first and treat that
directory as the package project anchor; `tsconfig`, package metadata, roots,
module layers, and compact locations are interpreted relative to that anchor.

Text reads are allowed for non-semantic surfaces such as rendering source lines
and docs/tests that enforce this boundary. Package metadata should enter facts
through TypeScript's JSON parser, not `JSON.parse`, so diagnostics and package
entry locations remain parser-owned.
Malformed `package.json` must be captured as a package fact diagnostic instead
of crashing the project runner. This applies to the project root package and to
package metadata read from TypeScript project references and workspace package
roots.
Package entry fields such as `main`, `module`, `types`, `typings`, and
`browser` belong in parser-owned package facts before reasoning or rule packs
consume them.
Conditional package `exports` and `imports` targets should preserve condition
paths and target source locations from TypeScript's JSON AST before they enter
the reasoning tree.
Package scripts, workspace patterns, and resolved workspace package metadata
should also stay parser-owned orientation facts; do not turn them into
package-manager policy inside this harness.
Known extension activation facts are the narrow exception to the no-manifest
policy rule: the parser may read package dependency fields only to derive a
typed `packageExtensions` fact such as Effect activation. Rule packs must
consume that fact instead of reading package metadata directly.
Known build-tool visibility is also parser-owned: the parser may derive
`packageBuildTools` from known dependency names, scripts, config files, and
explicit harness config, while rule packs consume only that typed fact.
JavaScript files should enter reports only through TypeScript's native project
selection, such as `allowJs`; do not widen fallback discovery with ad hoc JS
scanning.
Module-role classification should use explicit parser-visible suffix lists for
supported module script kinds instead of dynamic regular-expression helpers.
The whole package project is modularity-governed: large parser, reasoning,
policy, render, model, and harness modules should be split by concern before
they exceed their layer line budgets. Parser, reasoning, and model stay at the
strict 500-line budget; policy and harness orchestration files may be larger
while still capped, and render files use a narrower orchestration budget.
Rule packs should stay in the `src/rules/` pack structure: catalog metadata,
the engine, and individual pack modules are separate concerns. `src/rules.ts`
is a facade, not the policy implementation body.
Extension policies belong in `src/rules/extension_policy/`. They may inspect
reasoning-tree extension facts and parser-native Effect facts such as public
async API surfaces, runtime execution calls, and public service method return
types, including parser-classified Effect error-channel strength and
rejection-capable Promise interop risks, plus resource scope risks from
`Effect.acquireRelease`, but they must not import `typescript`, parse package
files, or implement general package-manager checks.

## Verification Policy Boundary

The M5/M6/M7/M8 verification surface is downstream of the harness report. It may
consume `TypeScriptHarnessReport.reasoningTree`, profile hints, receipts,
waivers, configured skill contracts, profile-index candidates, task indexes,
performance indexes, report-bundle manifests, and written report artifacts, but
it must not import parser helpers, import `typescript`, or reconstruct
TypeScript module resolution. If verification needs a new owner fact, add it to
the parser/reasoning chain first.

Verification policy is a planner and artifact-surface owner, not an executor.
Keep subprocess execution and external skill lifecycle outside M8 unless a
later milestone explicitly owns them. M8 may describe report obligations,
render plan/task-index/performance-index/bundle JSON, and write those JSON
artifacts to caller-provided source-baseline/runtime-cache directories, but it
must not run the verifier. Compact
verification output should stay a reminder surface: active pending or failed
tasks first, report obligations only when artifacts are required, expanded
skill contracts only when a task references a configured skill, and
profile-index blocks only while profile hints are missing or drifting.
Report artifact indexes cover active obligations only. Do not re-expand them to
include satisfied or waived tasks without a new milestone decision.
Dependency signals may enrich responsibility inference from parser-owned
package/import facts, but they must not become manifest dependency gates or
package-manager policy.

## Self-Applied Policy

The repository runs its own harness through `tests/unit/self_policy.test.ts`.
Those tests call the project runner against the repository root, so the package
must stay clean under the same default policy downstream TypeScript projects
will consume. Implementation self-apply means zero blocking findings. Policy
self-apply additionally requires zero TypeScript modularity findings and keeps
remaining advisory output bounded and visible until its dedicated cleanup lane.
Use `assertTypeScriptProjectHarnessAgentClean()` for test-gate self-apply paths
that should expose advice as repair feedback. Keep
`assertTypeScriptProjectHarnessClean()` blocking-only so library callers can
choose when advisory output should fail their tests.
Use `assertTypeScriptProjectHarnessEmbeddedClean()` for downstream npm
test/check integration. Its default pass skips semantic diagnostic collection
for speed and expects `tsc --noEmit` to own type-check failure; pass
`collectSemanticDiagnostics: true` only when a test needs semantic advice from
the harness itself.
Agent-clean failures must stay compact: group advice by rule and cap
first-finding detail instead of dumping every advisory card or raw JSON.
M6 semantic diagnostics, test-layout advice, package metadata diagnostics, and
agent advice are rendered by default but remain `info`; do not promote advisory
findings to blocking without an explicit policy decision. Modularity advice is
also `info` for downstream projects, but this repository's policy self-apply
test requires it to be empty.
Policy config helpers may disable rules, disable built-in packs, override
severities, or adjust blocking severities for callers.

## Renderer Contract

Compact text is the default output for repair-oriented agents. JSON is available
for tools through `renderTypeScriptProjectHarnessJson()`. Keep compact output
finding-first and low-noise; do not turn it into a broad audit report.
The agent snapshot compact format follows
`docs/03_features/204_compact_agent_snapshot.md`; design the line shape there
before changing renderer output.
Compact renderers must normalize diagnostic message path mentions under the
reasoning-tree project root, because TypeScript diagnostic text can include
host absolute paths even when diagnostic locations are already structured.
Snapshot rendering should stay Rust-aligned: cap long branch and child-edge
surfaces, group owner dependency fan-in/fan-out when useful, render compact
`Extensions:` and `BuildTools:` lines only when present, and do not render
empty child-edge placeholders.

## Public API Contract

The package root is the supported M13 import surface. Tests in
`tests/unit/public_api.test.ts` lock the runtime facade, type exports, and public
agent snapshot behavior. Do not export internal reasoning builders, rule-pack
evaluators, or verification internals unless they become an intentional library
contract.
The agent snapshot compact format is also locked by the golden fixture in
`tests/fixtures/agent_snapshot_project` and
`tests/snapshots/agent_snapshot_project.snap`; update them together only when
the reasoning surface intentionally changes.
