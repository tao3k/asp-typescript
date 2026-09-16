# Agent Advice Test Gate M10 Plan

M10 aligns the ASP TypeScript with the Rust cargo-test gate behavior added
after the parser-native agent policy milestone:

```text
configured parser/reasoning facts
-> deterministic low-noise policy
-> blocking-only library/CLI gate
-> explicit agent test gate for visible advice
```

## Scope

- Add `assertAspTypeScriptAgentClean(projectRoot, config?)` as a
  public project-level assertion helper.
- Keep `assertAspTypeScriptClean()` blocking-only, matching the
  existing CLI exit-code contract.
- Make the agent-clean helper fail after configured-blocking findings are
  handled when visible `info` advice remains.
- Render the failure with `renderAspTypeScriptAgentCompactText()` so
  test output is compact repair feedback, not JSON or an expanded report.
  `renderAspTypeScriptAdvice()` remains a compatibility alias for
  advice-only compact text. The first agent surface is `RepairTasks:` with
  explicit `fix:` steps and target locators; rule ids are metadata, not the
  primary instruction.
- Respect policy config before the assertion checks advice. Disabled rules,
  disabled rule packs, severity overrides, and blocking-rule promotions should
  all behave exactly as they do in ordinary project runs.
- Use the helper in repository self-apply tests so the package's own test gate
  keeps surfacing advice drift.

## Non-Goals

M10 does not change the CLI default output or exit code, does not add a new CLI
flag, and does not promote `TS-AGENT-*` catalog severities. Agent advice remains
visible and non-blocking by default; projects opt into advice-as-test-feedback
through the explicit helper.

## Validation

- Unit tests prove the blocking-only assertion allows an advice-only project,
  the agent-clean assertion fails with compact advice, and disabling
  `agent_policy` suppresses that feedback.
- Public API tests lock the new helper at the package root.
- Self-policy tests use the helper for zero-finding repository self-apply.
- Acceptance remains:

```shell
direnv exec . npm ci
direnv exec . npm run check
direnv exec . npm run lint
direnv exec . npm test
direnv exec . npm run check:policy
direnv exec . git diff --check
```
