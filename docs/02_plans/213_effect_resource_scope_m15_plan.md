# Effect Resource Scope M15 Plan

M15 is the final pre-PR Effect enrichment slice. It keeps the same parser-first
contract and adds one resource-management policy:

```text
Effect extension activation
-> parser-native acquireRelease/scoped facts
-> low-noise extension_policy advice
-> self-apply clean
```

## Research Input

The policy is calibrated against `Effect-TS/website` docs at
`50d51c76077aed9bc457ff950be41af42cb868d5`:

- `resource-management/scope.mdx`: `Effect.acquireRelease` creates a resource
  workflow that requires `Scope`, and `Effect.scoped` closes that scope when the
  effect finishes.
- `getting-started/creating-effects.mdx`: Promise interop should expose failure
  through the typed error channel when rejection is possible.

## Scope

- Add parser-native `TypeScriptEffectResourceScopeRiskFact` for public owners
  that call `Effect.acquireRelease` without a local `Effect.scoped` boundary.
- Thread the fact through module reports and reasoning modules.
- Add `TS-EXT-EFFECT-R007` as `info`, advising agents to make resource scope
  closure explicit with `Effect.scoped` or a documented resource boundary.
- Keep Effect activation project-wide: `TS-EXT-EFFECT-R002` gives agents a
  parser-backed async/Promise migration signal whenever an active Effect project
  exposes public async domain APIs outside `Effect.Effect`.
- Keep agent test-gate failures compact but actionable: group advice, cap
  first-finding details, and put Rust/Julia-style `fix:` guidance before the
  grouped finding list.

## Non-Goals

M15 does not infer lifetime correctness, run Effect code, or reject public
resource factories. The finding stays advisory because exposing
`Effect<_, _, Scope>` can be intentional for low-level resource modules.

## Validation

- Parser tests cover `Effect.acquireRelease` risk facts and `Effect.scoped`
  suppression from TypeScript AST nodes.
- Extension policy tests cover active Effect projects, resource-scope advice,
  and default non-blocking severity.
- Self-apply remains clean under the default ASP TypeScript.
