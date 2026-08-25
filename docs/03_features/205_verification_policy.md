# Verification Policy

Verification policy is the M5/M6/M7/M8 bridge between parser-owned TypeScript
structure and external validation skills. It drafts owner profiles, plans what
must be verified, and renders compact contracts and report artifacts; it does
not run the verifier.

## Authority Chain

The verification planner consumes `TypeScriptHarnessReport.reasoningTree`.
It does not inspect TypeScript ASTs, call `typescript`, call parser helpers, or
rebuild module resolution. Native parser facts first become reasoning tree
facts, then profile hints map those owners to verification tasks.

The planner uses parser-visible owner facts such as module path, role, layer,
exports, imports, owner dependencies, external import counts, and unresolved
import counts. That is enough to detect responsibility drift without letting
verification become a second semantic parser.

## Configuration

`TypeScriptHarnessConfig.verificationPolicy` contains:

- `profileHints`: owner responsibility declarations.
- `receipts`: completed verification results keyed by task fingerprint.
- `waivers`: explicit suppressions keyed by task fingerprint.
- `disabledTaskKinds`: task kinds suppressed by caller policy.
- `responsibilityTaskOverrides`: library-level responsibility-to-task mapping.
- `taskContractOverrides`: library-level task receipt contract overrides.
- `skillBindings`: mapping from task kind to external skill id/adapter.
- `skillDescriptors`: expandable command and receipt contracts for configured
  skills.
- `dependencySignals`: parser-owned import/package dependency classifiers used
  only for profile responsibility inference.

Use the package facade helpers instead of mutating config objects in place:

- `withTypeScriptVerificationProfileHint()`
- `withTypeScriptVerificationReceipt()`
- `withTypeScriptVerificationWaiver()`
- `withDisabledTypeScriptVerificationTaskKind()`
- `withDisabledTypeScriptVerificationTaskKinds()`
- `withTypeScriptVerificationTaskContract()`
- `withTypeScriptVerificationResponsibilityTaskKinds()`
- `withTypeScriptVerificationSkillBinding()`
- `withTypeScriptVerificationSkillDescriptor()`
- `withTypeScriptVerificationDependencySignal()`

## Task Mapping

The verification planner supports these task kinds:

- `stress`
- `performance`
- `chaos`
- `security`
- `regression`
- `responsibility_review`

Default profile mapping is intentionally small:

- `public_api` -> `stress`
- `latency_sensitive` -> `performance`
- `external_dependency`, `persistence`, `availability_critical` -> `chaos`
- `security_boundary` -> `security`
- `pure_domain_logic` -> no external task

`responsibility_review` is created when the profile itself needs repair. For
example, a `pure_domain_logic` owner with parser-visible external imports or
owner dependencies needs a profile review before external verification has a
meaningful contract.

## Receipts And Waivers

Every planned task has a stable `tsv:<hash>` fingerprint derived from task kind,
owner path, owner namespace, reason, required evidence, parser/reasoning facts,
and configured skill binding.

A matching passed receipt marks a task `satisfied`, and the compact renderer
hides it. A matching failed receipt keeps the task visible as `failed`.
Receipts may also carry `evidenceUri` and `observedAt`; task indexes and
performance indexes preserve those fields for artifact lookup and audit timing.
A waiver hides the task only when it has `owner`, `reason`, and `expiresAt`;
incomplete waivers remain visible with a `resolution` line.

## Rendering

`renderTypeScriptVerificationPlan(plan)` emits active pending or failed tasks:

```text
[verify] src/api.ts
   |owner: src/api
   |performance: pending phase=after_unit_tests_pass fingerprint=tsv:...
   |why: performance=profile declares latency-sensitive TypeScript owner
   |requires: performance=benchmark_command,baseline,regression_threshold,latency_or_throughput,allocation_profile,profile_artifact
   |fact: performance.module=role=source layer=harness
   |contract: performance=performance skill must report benchmark command, baseline, regression threshold, latency or throughput, allocation profile, and profiling artifact for this fingerprint
```

When a task kind has a configured skill binding, the first-read task line stays
quiet:

```text
[verify] src/api.ts
   |owner: src/api
   |performance: pending phase=after_unit_tests_pass fingerprint=tsv:... skill=typescript-performance@node contract_ref=typescript-performance@node
```

`renderTypeScriptVerificationSkillContracts(plan)` emits the expandable skill
contract surface:

```text
[skill-contract] typescript-performance@node
   |tool: node
   |run: npm run bench
   |standard: compare current owner against the checked-in baseline
   |inputs: ownerPath,fingerprint
   |pass: no regression above configured threshold
   |receipt: fingerprint,status,summary,evidence
```

Structured consumers can use `renderTypeScriptVerificationPlanJson(plan)`.
Agents should read the compact task output first and expand skill contracts only
when a task references a skill.

## Report Bundle And Writer

M7 adds report obligations to the verification plan. M8 extends them with a
Rust VAS-aligned writer and performance index. The planner adds
`verification_plan_json` whenever active pending or failed tasks remain, and it
adds `task_index_json` when any active task has a configured skill binding.
When any active `performance` task exists, it also adds
`performance_index_json`.
The compact renderer appends the required artifacts without expanding the JSON:

```text
[verify-report]
   |bundle: renderer=renderTypeScriptVerificationReportBundleJson artifact=verification_report_bundle.json artifacts=3
   |required: verification_plan_json renderer=renderTypeScriptVerificationPlanJson artifact=verification_plan.json tasks=1 kinds=performance
   |required: task_index_json renderer=buildTypeScriptVerificationTaskIndex + renderTypeScriptVerificationTaskIndexJson artifact=task_index.json tasks=1 kinds=performance
   |required: performance_index_json renderer=buildTypeScriptVerificationPerformanceIndex + renderTypeScriptVerificationPerformanceIndexJson artifact=performance_index.json tasks=1 kinds=performance
```

The task index is a compact structured artifact for configured external skills,
and the performance index is a compact `[perf-state]` retrieval surface for
active performance tasks:

```ts
import {
  buildTypeScriptVerificationPerformanceIndex,
  buildTypeScriptVerificationTaskIndex,
  buildTypeScriptVerificationReportBundle,
  renderTypeScriptVerificationReportArtifactJson,
  writeTypeScriptVerificationReports,
} from "typescript-lang-project-harness";

const index = buildTypeScriptVerificationTaskIndex(plan);
const perf = buildTypeScriptVerificationPerformanceIndex(plan);
const bundle = buildTypeScriptVerificationReportBundle(plan);
const taskIndexJson = renderTypeScriptVerificationReportArtifactJson(plan, "task_index_json");
const receipt = writeTypeScriptVerificationReports(plan, {
  projectRoot: process.cwd(),
  sourceBaselineDir: ".verification/source",
  runtimeCacheDir: ".cache/asp-typescript/verification",
});
```

Task-index records include task kind, state, phase, owner path, skill label,
contract reference, required evidence keys, task evidence, receipt evidence,
and missing receipt evidence keys. Failed receipts remain visible and preserve
their receipt evidence so a caller can compare the failed artifact against the
required evidence contract.

Performance-index records include task state, phase, owner, skill contract,
required evidence keys, task evidence, receipt summary, receipt evidence URI,
receipt observed timestamp, and structured receipt evidence. The compact
renderer starts each record with `[perf-state]` and prints missing evidence keys
for active records.

The report bundle is a manifest, not an executor. It names artifact renderers,
persistence intent, templates, trace defaults, task kinds, and task
fingerprints. The default persistence is `runtime_cache` for
`verification_plan_json` and `source_baseline` for `task_index_json` and
`performance_index_json`. `writeTypeScriptVerificationReports()` writes
`verification_report_manifest.json` to both caller-provided directories: the
source-baseline manifest contains source-controlled artifacts only, while the
runtime-cache manifest contains the full bundle. Artifact JSON replaces the
absolute project root with `$PROJECT_ROOT` by default. M8 does not add CLI
flags, start subprocesses, or manage external skill lifecycle.

## Profile Index

M6 adds a profile index that helps Agents draft `profileHints` before external
verification tasks are planned:

```ts
import {
  activeTypeScriptVerificationProfileHints,
  buildTypeScriptVerificationProfileIndex,
  renderTypeScriptVerificationProfileIndex,
} from "typescript-lang-project-harness";

const index = buildTypeScriptVerificationProfileIndex(".");
console.log(renderTypeScriptVerificationProfileIndex(index));
const suggestedHints = activeTypeScriptVerificationProfileHints(index);
```

The profile index is not a project audit. It renders only missing or drifting
profile candidates, and it goes quiet once matching hints cover the suggested
responsibilities.
For drifting profiles, `activeTypeScriptVerificationProfileHints()` preserves
already configured responsibilities while adding parser-suggested ones.
When active candidates exist, the compact renderer appends a
`[verify-profile] profile_hints` reminder naming
`TypeScriptVerificationProfileHint` as the config surface.

```text
[verify-profile] src/index.ts
   |owner: src
   |state: missing_profile
   |suggest: external_dependency,public_api
   |tasks: chaos,stress
   |fact: module=role=facade layer=harness
   |fact: imports=external=1 package_import=0 unresolved=0
[verify-profile] profile_hints
   |state: missing_profile_config
   |action: configure TypeScriptVerificationProfileHint entries
   |candidates: 1
```

Profile candidates are derived from reasoning-tree facts:

- module role and layer
- parser-visible export count
- owner dependency count
- owner-module and child-module counts for branch aggregates
- TypeScript-native import-resolution counts
- external and package-import roots
- configured and unconfigured dependency roots from parser-owned import/package
  facts
- package entry targets that resolve to parser-visible owners

M8 keeps responsibility inference project-controlled. It suggests `public_api`
for entrypoints, facades, exported owners, and parser-visible package entry
owners. It suggests `external_dependency` when parser facts show external or
`#` package-import boundaries, or broad owner fan-out. Callers may add
`TypeScriptVerificationDependencySignal` entries to classify a parser-visible
dependency root as `persistence`, `security_boundary`, `latency_sensitive`, or
`availability_critical`. Those signals only enrich profile evidence and
suggested responsibilities; they do not create dependency findings or manifest
dependency gates.
