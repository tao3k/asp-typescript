# Verification VAS M8 Plan

M8 aligns the ASP TypeScript with the latest Rust VAS verification artifact
surface while keeping the TypeScript parser-first boundary intact:

```text
TypeScript parser facts
-> reasoning tree facts
-> configured low-noise verification policy
-> compact agent output
-> durable report artifacts
```

## Scope

- Add a report writer that persists `verification_report_manifest.json` and
  artifact JSON to caller-provided source-baseline and runtime-cache
  directories.
- Compact absolute project-root paths in written JSON with a stable placeholder.
- Add a performance index and `performance_index_json` report obligation for
  active performance tasks.
- Preserve receipt `evidenceUri` and `observedAt` metadata on tasks, task-index
  records, and performance-index records.
- Require complete waivers to include `owner`, `reason`, and `expiresAt`; keep
  incomplete waivers active with a resolution note.
- Add disabled task-kind policy helpers. Disabled external task kinds are not
  planned; owner-local overrides pointing at disabled task kinds emit
  `responsibility_review`.
- Add dependency signals for parser-owned package/import roots so projects can
  enrich profile responsibility inference without creating dependency policy
  findings.
- Add profile-index branch aggregate evidence and a compact `profile_hints`
  reminder when active profile candidates exist.

## Non-Goals

M8 does not add CLI flags, run external verification skills, manage
subprocesses, or implement Rust's full verification/profile/report lifecycle.
It also does not add manifest dependency checks. Dependency signals are
project-owned profile inference hints, not dependency gates.

Report artifact indexes continue the M7 review decision: they cover active
obligations only and do not re-expand satisfied or waived tasks.

## API Surface

- `buildTypeScriptVerificationPerformanceIndex(plan)`
- `renderTypeScriptVerificationPerformanceIndex(index)`
- `renderTypeScriptVerificationPerformanceIndexJson(index)`
- `writeTypeScriptVerificationReports(plan, config)`
- `withDisabledTypeScriptVerificationTaskKind(config, kind)`
- `withDisabledTypeScriptVerificationTaskKinds(config, kinds)`
- `withTypeScriptVerificationDependencySignal(config, signal)`
- `TypeScriptVerificationReportWriteConfig`
- `TypeScriptVerificationReportWriteReceipt`
- `TypeScriptVerificationReportWriteError`
- `TypeScriptVerificationPerformanceIndex`
- `TypeScriptVerificationPerformanceRecord`
- `TypeScriptVerificationDependencySignal`

## Validation

- Unit tests cover report writer persistence split, performance-index
  obligations and renderers, receipt metadata propagation, complete waiver
  semantics, disabled task kinds, dependency-signal profile inference,
  profile reminders, public exports, and self-apply.
- Acceptance remains:

```shell
direnv exec . npm ci
direnv exec . npm run check
direnv exec . npm run lint
direnv exec . npm test
direnv exec . npm run check:policy
direnv exec . git diff --check
```
