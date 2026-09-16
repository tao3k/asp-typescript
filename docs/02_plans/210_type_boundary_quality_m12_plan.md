# Type Boundary Quality M12 Plan

M12 continues the ASP Rust alignment by strengthening TypeScript type
quality advice without turning ASP TypeScript into a linter:

```text
TypeScript native type-boundary facts
-> reasoning module facts
-> conservative low-noise type advice
-> compact agent output
-> self-apply validation
```

## Scope

- Extend the parser-native fact layer with public primitive type aliases and
  discriminated-union variant payload fields.
- Keep public data fields as the source for stringly state/status/kind advice.
- Add advisory `TS-AGENT-POLICY-010` through `TS-AGENT-POLICY-012`:
  - `TS-AGENT-POLICY-010`: semantic public type aliases over raw primitive carriers.
  - `TS-AGENT-POLICY-011`: raw string public state/status/kind/mode/type/tag fields.
  - `TS-AGENT-POLICY-012`: public discriminated-union variants with multiple
    primitive semantic payload fields.
- Keep all M12 rules at `info` severity. Projects can disable individual
  rules, disable `agent_policy`, override severities, or promote them through
  existing policy config.
- Exclude the `model` layer, including nested `src/**/model.ts`, so fact and
  schema contracts remain valid internal model definitions.

## Non-Goals

M12 does not implement TypeScript generic-constraint policy, exhaustive-union
checking, enum design linting, package dependency policy, or a style gate.
Literal-union aliases such as `type Status = "pending" | "done"` remain an
accepted typed boundary, not a warning.

## Validation

- Parser tests cover public primitive aliases and discriminated-union payload
  facts.
- Agent-policy tests cover `TS-AGENT-POLICY-010` through `TS-AGENT-POLICY-012`, catalog
  order, policy-pack membership, and model-layer suppression.
- Public API tests cover the exported M12 fact types.
- Parser-boundary and self-apply tests continue to prove rule layers consume
  reasoning facts instead of TypeScript parser APIs.

Acceptance remains:

```shell
direnv exec . npm ci
direnv exec . npm run check
direnv exec . npm run lint
direnv exec . npm test
direnv exec . npm run check:policy
direnv exec . git diff --check
```
