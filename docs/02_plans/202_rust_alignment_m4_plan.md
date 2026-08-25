# Rust Alignment M4 Plan

M4 aligns the TypeScript harness with the current Rust harness mechanism while
keeping the TypeScript-specific parser contract intact:

```text
TypeScript native parser facts
-> reasoning tree facts
-> configured deterministic rule packs
-> compact agent output
-> self-apply validation
```

## Milestone Shape

- Keep `src/parser.ts` and `src/parser/` as the only TypeScript Compiler API,
  `tsconfig`, TypeScript JSON AST, and native module-resolution entry.
- Split policy into rule catalog, rule engine, and individual rule-pack modules.
  `src/rules.ts` remains a facade.
- Add `TypeScriptRulePack` and policy config helpers for disabling rules,
  disabling built-in packs, overriding severities, and adjusting blocking
  severities.
- Keep advisory semantics low-noise: parser-breaking syntax/config failures are
  blocking by default; semantic diagnostics, package metadata diagnostics,
  modularity, test-layout, and `TS-AGENT-*` advice remain visible `info`
  findings unless callers configure otherwise.
- Improve `asp-typescript search prime` with Rust-style caps, empty-placeholder
  suppression, deterministic owner dependency fan-out/fan-in grouping, and
  configured finding output.

## Public Surface

The package facade exports runners, assertion helpers, parser entrypoints,
compact/JSON/reasoning renderers, project agent snapshot helpers, rule catalog
functions, `TypeScriptRulePack`, `typeScriptRulePackRuleIds()`, and policy
config helper functions. Reasoning builders and rule evaluators remain private
implementation details.

## Explicit Non-Goals

M4 does not add manifest dependency policy and does not implement the Rust
verification/profile/report-bundle subsystem. Package metadata and dependency
orientation facts remain parser-owned facts that help agents choose edit
surfaces; they are not package-manager gates.

## Closure Checks

- parser boundary tests prove rules and renderers stay downstream of native
  parser facts;
- policy config tests prove disable/override precedence and configured snapshot
  behavior;
- snapshot tests prove compact caps, no `-> -` placeholders, and fan-in/fan-out
  grouping;
- self-policy tests prove the repository default harness remains clean;
- acceptance runs remain `npm run check`, `npm run lint`, `npm test`,
  `npm run harness`, and `git diff --check` through `direnv exec .`.
