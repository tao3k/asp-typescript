# Compact Agent Snapshot

The compact agent snapshot is the first reading surface for repair-oriented
agents. It follows the Rust harness shape: a low-noise owner summary, not a
JSON-like dump of every parser fact.

## Design Chain

```text
TypeScript parser facts -> reasoning tree facts -> agent owner snapshot
```

The single-package renderer consumes
`TypeScriptHarnessReport.reasoningTree.ownerBranches`, `ownerDependencies`,
package owner facts, and grouped findings. The project-level snapshot renderer
consumes package reports prepared by the runner from parser-owned
workspace/project-reference facts. Neither renderer inspects raw source files,
`tsconfig`, `package.json`, `report.modules`, `report.projectResolution`,
`report.rootPaths`, or raw import edges to rediscover owner structure.

## Format Shape

The output uses the same section grammar as the Rust harness agent snapshot:

```text
pkg <path>
Modules: source=<n> roots=<n> branches=<n> deps=<n> shadowed=<n> orphaned=<n> paths=<n> refs=<n> workspaces=<n> package-owners=<n> extensions=<n> build-tools=<n> findings=<n>
Extensions:
 - <extension> activation=<state> capabilities=<name,...> config=<source>
BuildTools:
 - <tool> capabilities=<name,...> packages=<name,...> configs=<file,...> scripts=<name,...>
OwnerBranches:
 - <path> [<roles>] owner=<owner> imports=<resolution:count,...> exports=<names> -> <edge-kind:path,...>
OwnerDependencies:
 - <path> --<resolution>/<import-kind>--> <path-or-specifier>
 - <path> --<resolution>/<import-kind>--> <path-or-specifier>, <path-or-specifier>
 - <path-or-specifier> <--<resolution>/<import-kind>-- <path>, <path>
 - package <kind>:<subpath> --<owner|unresolved|external>--> <path-or-target>
FindingGroups:
 - <severity> <rule-id> x<count> first=<path> <title>
```

`pkg <path>` headings are emitted only by project-level snapshots when multiple
package scopes are rendered. Single-package snapshots start directly at
`Modules:`. Only non-empty sections are emitted. Singleton and zero-value
boilerplate is omitted.

## Semantics

- `Modules:` summarizes parser-visible non-test modules.
- `Extensions:` lists known package extension activation facts such as Effect.
  It is emitted only when the parser has a known extension fact. Capability
  names are compact labels for agent orientation, not an installed package
  inventory.
- `BuildTools:` lists known parser-owned build-tool facts such as Rspack or
  Rsbuild. It is emitted only when package dependencies, package scripts,
  config files, or explicit harness config make that tool visible. It is not a
  bundler audit and does not replace `tsc` or framework build checks.
- `shadowed=` counts parser-visible TypeScript source owners that have more
  than one source shape for the same owner namespace, such as a file owner and
  an `index.*` directory owner, unless one shape explicitly re-exports the
  other as a local facade/proxy.
- `orphaned=` counts parser-visible `source` modules that are not reachable
  from entrypoint, facade, or package-entry roots through TypeScript-native
  owner dependencies.
- `pkg <path>` identifies the package scope relative to the requested snapshot
  root. Member packages are run from their own `package.json` anchor and local
  `tsconfig.json`; root package config is not inherited across package anchors.
- `OwnerBranches:` lists source owners that are roots, facades, entrypoints,
  configs, or modules with parser-owned re-export structure edges. Ordinary
  imports stay in `OwnerDependencies:`. The `->` child-edge suffix is emitted
  only when a branch has child edges.
- `OwnerDependencies:` lists import/export edges, package-name import owner
  facts, and package entry owner facts in one compact routing surface. Repeated
  owner dependencies are grouped by fan-out or fan-in when that lowers line
  count without losing parser-owned routing facts.
- External package imports stay as `imports=external:<n>` counters on owner
  branches. They are not expanded as owner-dependency rows because they are not
  parser-visible TypeScript owners.
- `FindingGroups:` groups deterministic rule findings by severity, rule id, and
  title instead of repeating full diagnostic cards.
- Agent-clean assertion failures use `RepairTasks:` instead of the snapshot's
  `FindingGroups:` summary. Each task starts with a Rust-style compact header:
  `[rule] severity x<count>: repair intent (problem; facts: parser evidence)`.
  The body only keeps concrete `fix:` steps and capped `@ path:line:column`
  target examples. JSON remains a tool surface, not an agent repair surface.
- `renderTypeScriptProjectHarnessAgentCompactText(report, options)` is the
  public agent text interface. It defaults to visible advice and can select
  `findings: "advice"`, `"blocking"`, or `"all"` when a caller wants a
  different compact repair surface.
- TypeScript test modules are omitted from owner-branch and owner-dependency
  orientation unless a future parser fact makes a test owner explicitly useful.

## Compactness Rules

- Do not render raw JSON.
- Do not render full package manifests.
- Do not render `dependencies`, `devDependencies`, `peerDependencies`, or
  `optionalDependencies`; those are package-manager policy, not TypeScript
  owner reasoning.
- Known extension facts may render compact activation state, such as
  `effect activation=dependency`, without rendering package dependency fields.
- Package-name imports may render as `--package-name/<kind>-->` owner
  dependencies when they resolve to a parser-visible TypeScript project
  reference or workspace package. That is import-owner dependency orientation,
  not manifest dependency governance.
- Keep diagnostic detail out of the snapshot. Full diagnostic cards stay in the
  default compact renderer; the snapshot only groups findings.
- Keep source-shape detail out of the snapshot. `shadowed=` and `orphaned=`
  are orientation counters from reasoning-tree facts, not style gates and not
  replacement rules for TypeScript, ESLint, or project-specific architecture
  policy.
- Compact renderers normalize project-root absolute path mentions in diagnostic
  summaries to relative paths before rendering.
- Branch lines are capped at 24 lines with a compact remainder line. Child
  edges are capped at 8 rendered labels with a compact remainder label.
- Do not render empty child-edge placeholders such as `-> -`.

## Golden Contract

The canonical fixture lives at:

```text
tests/fixtures/agent_snapshot_project
```

The expected compact text lives at:

```text
tests/snapshots/agent_snapshot_project.snap
tests/snapshots/agent_snapshot_workspace_project.snap
```

`tests/unit/agent_snapshot.test.ts` compares the single-package library
renderer against `agent_snapshot_project.snap` and the project-level
CLI/snapshot renderer against `agent_snapshot_workspace_project.snap`. Update
the fixture and golden files together only when the compact reasoning surface
intentionally changes.
