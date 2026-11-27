# Verification Report Bundle M7 Plan

M7 continues the stacked verification lane after M6. It aligns ASP TypeScript
with the ASP Rust report-artifact contract without adding external
execution. The milestone stays downstream of native parser facts:

```text
TypeScript parser facts
-> reasoning tree facts
-> configured verification plan
-> task index
-> report bundle manifest and artifact JSON renderers
```

## Scope

- Add `reportObligations` to `TypeScriptVerificationPlan`.
- Preserve receipt evidence on planned tasks so report artifacts can explain
  failed receipts without re-running a verifier.
- Add a compact configured-skill task index for active verification tasks.
- Add a report bundle manifest that names required artifacts, renderers,
  persistence intent, templates, trace defaults, task kinds, and task
  fingerprints.
- Render a low-noise `[verify-report]` section from the compact verification
  plan when active tasks require artifacts.
- Export task-index and report-bundle builders/renderers from the package root.

## Non-Goals

M7 does not run external skills, manage subprocesses, write artifacts to disk,
or implement Rust's full verification/profile/report lifecycle. It also does
not add CLI flags. Callers can choose where to persist the JSON renderers.

Manifest dependencies remain parser-owned orientation facts only. M7 does not
add dependency policy or package-manager checks.

## API Surface

- `buildTypeScriptVerificationTaskIndex(plan)`
- `renderTypeScriptVerificationTaskIndexJson(index)`
- `defaultTypeScriptVerificationReportOptions()`
- `buildTypeScriptVerificationReportBundle(plan)`
- `buildTypeScriptVerificationReportBundleWithOptions(plan, options)`
- `renderTypeScriptVerificationReportBundleJson(plan)`
- `renderTypeScriptVerificationReportArtifactJson(plan, key)`

`verification_plan_json` is the always-required artifact when active tasks
exist. `task_index_json` is required when active tasks reference configured
verification skills.

## Validation

- Unit tests cover report obligations, task-index records, failed receipt
  evidence, missing receipt evidence keys, bundle persistence, artifact JSON,
  quiet satisfied tasks, and public API exports.
- Self-apply remains the default package ASP TypeScript gate.
- Acceptance remains:

```shell
direnv exec . npm ci
direnv exec . npm run check
direnv exec . npm run lint
direnv exec . npm test
direnv exec . npm run check:policy
direnv exec . git diff --check
```
