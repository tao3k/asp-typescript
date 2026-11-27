# Public Data Shape Agent Advice M11 Plan

M11 continues the Rust parser-native agent policy alignment by enabling one
conservative TypeScript data-shape rule over facts that M9 already collects:

```text
TypeScript native public data-field facts
-> reasoning module facts
-> conservative source data-shape advice
-> compact agent output
-> self-apply validation
```

## Scope

- Add advisory `TS-AGENT-POLICY-009` for public source interfaces, type literals, or
  public class fields that expose clusters of semantic primitive fields.
- Consume only `TypeScriptReasoningModule.publicDataFields`; rule code must not
  import `typescript`, call parser helpers, or scan source text for TypeScript
  syntax.
- Keep the threshold conservative: at least three semantic primitive fields on
  the same public data surface. Semantic fields include identifiers, paths,
  URLs/URIs, keys/tokens, time/byte units, and boolean mode fields.
- Keep the finding at `info` severity. Projects can disable the rule, disable
  `agent_policy`, override severity, or promote it through existing policy
  config.
- Exclude ASP TypeScript `model` layer, including nested `src/**/model.ts`
  schema modules, so fact/schema definitions do not become generic DTO style
  findings. Application source modules remain covered.

## Non-Goals

M11 does not add enum payload modeling, generic-bound modeling, a broad DTO
style gate, dependency policy, or a package-manager check. It also does not
change CLI exit behavior. The rule is a repair hint for agent-facing public
data contracts, not a replacement for TypeScript type checking or schema
validation.

## Validation

- Unit tests cover catalog order, `agent_policy` membership, a positive public
  data-shape finding, model-layer suppression, and default self-apply.
- Parser-boundary tests continue to prove rules consume reasoning facts instead
  of parser-native APIs.
- Acceptance remains:

```shell
direnv exec . npm ci
direnv exec . npm run check
direnv exec . npm run lint
direnv exec . npm test
direnv exec . npm run check:policy
direnv exec . git diff --check
```
