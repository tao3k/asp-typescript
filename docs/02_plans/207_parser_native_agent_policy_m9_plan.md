# Parser-Native Agent Policy M9 Plan

M9 aligns the ASP TypeScript with the Rust parser-native agent policy
direction while keeping the TypeScript boundary strict:

```text
TypeScript native syntax facts
-> reasoning tree module facts
-> low-noise agent policy
-> compact agent output
-> self-apply validation
```

## Scope

- Split native syntax fact extraction under `src/parser/native_syntax/` so the
  parser layer owns TypeScript AST walking by concern: public API shape, public
  data shape, control-flow shape, and shared helpers.
- Add parser-native facts for exported function parameters, public tuple API
  surfaces, exported primitive data fields, and public function control-flow
  metrics.
- Project those facts into `TypeScriptReasoningModule` so rule packs consume
  reasoning tree facts instead of TypeScript ASTs or parser helper APIs.
- Add advisory `TS-AGENT-POLICY-004` through `TS-AGENT-POLICY-008` for public flag
  parameters, broad positional public APIs, anonymous primitive tuple APIs,
  nested public algorithms, and broad linear public algorithms.
- Keep all new agent policy findings at `info` severity and visible by
  default, while preserving caller controls for disabling packs/rules,
  overriding severities, or promoting selected rules.
- Export the new model fact types from the package facade.

## Non-Goals

M9 does not add a broad TypeScript style gate, does not replace `tsc`, ESLint,
or Prettier, and does not add manifest dependency checks. Exported primitive
data-field facts are collected and exposed for future policies and downstream
tools, but M9 does not turn them into default findings. Verification execution,
profiles, report bundles, and dependency signals remain the M5-M8 verification
lane unless a later milestone extends them.

## Rule Surface

- `TS-AGENT-POLICY-004`: public functions with multiple flag parameters should move
  mode semantics to a named options object or discriminated union.
- `TS-AGENT-POLICY-005`: broad public positional parameter lists should move to a
  named request/options surface.
- `TS-AGENT-POLICY-006`: anonymous primitive tuple parameters or return values should
  become named object, tuple alias, or domain types.
- `TS-AGENT-POLICY-007`: deeply nested or branch-heavy public algorithms should
  expose guard clauses, discriminated dispatch, or small named steps.
- `TS-AGENT-POLICY-008`: broad linear public algorithms should split algorithm
  responsibilities into smaller named helpers or pipeline steps.

These rules consume only `TypeScriptReasoningTree` and
`TypeScriptReasoningModule` facts.

## Validation

- Unit tests cover native parser fact extraction, reasoning projection, rule
  catalog order, policy-config rule-pack membership, public API exports, agent
  policy findings, and self-apply.
- Parser-boundary tests continue to prove non-parser layers do not import
  `typescript`, call parser/module-resolution helpers, or reconstruct
  parser-native facts.
- Acceptance remains:

```shell
direnv exec . npm ci
direnv exec . npm run check
direnv exec . npm run lint
direnv exec . npm test
direnv exec . npm run check:policy
direnv exec . git diff --check
```
