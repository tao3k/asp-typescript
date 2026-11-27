# Effect Extension Policy M13 Plan

M13 adds the first package-owned extension policy without turning the TypeScript
ASP TypeScript into a dependency checker or an Effect linter:

```text
package.json parser facts
-> known extension activation facts
-> parser-native async API facts
-> extension_policy findings
-> compact agent snapshot
```

## Research Input

The implementation was calibrated against the Effect website docs snapshot at
`Effect-TS/website@50d51c76077aed9bc457ff950be41af42cb868d5`, especially:

- `getting-started/importing-effect.mdx`: install the `effect` package and
  import `Effect` from `effect` or `effect/Effect`.
- `getting-started/the-effect-type.mdx`: `Effect<Success, Error,
Requirements>` models success, expected errors, and requirements.
- `additional-resources/effect-vs-promise.mdx`: Promise is eager and lacks
  typed error/context channels; Effect is lazy, typed, repeatable, and supports
  structured concurrency.
- `requirements-management/services.mdx` and `layers.mdx`: services and layers
  keep dependencies in the Effect type and construction graph instead of
  leaking implementation dependencies through service APIs.

## Scope

- Add parser-owned `TypeScriptPackageExtensionFact` for known extensions.
- Auto-activate the `effect` extension when the package has an `effect`
  dependency in package dependency fields.
- Support explicit package config:
  `asp-typescript.extensions.effect = "enable"` or
  `asp-typescript.extensions.Effect = "enable"`.
- Emit `TS-EXT-EFFECT-R001` as an `error` when the project explicitly enables
  Effect but does not declare the `effect` dependency.
- Emit `TS-EXT-EFFECT-R002` as `info` when the Effect extension is active and
  public source APIs expose raw `Promise` or implicit async Promise surfaces
  instead of `Effect.Effect` return types.
- Render compact `Extensions:` snapshot lines only when extension facts exist.

## Non-Goals

M13 does not inspect installed package versions, run Effect code, enforce every
Effect style convention, or turn manifest dependencies into package-manager
policy. It also does not require all Promise usage to disappear: Promise is
accepted at runtime and adapter boundaries; the first policy only nudges public
domain-facing async APIs toward `Effect.Effect<A, E, R>`.

## Follow-On Enrichment

M14 keeps the same extension boundary and adds only parser-native facts that map
to stable Effect concepts:

- `Effect.run*` / `Runtime.run*` calls execute Effect descriptions, so runtime
  calls in source modules become advisory boundary findings.
- `Effect<Success, Error, Requirements>` exposes requirements in the third type
  parameter, so public service methods with non-`never` requirements become
  advisory layer-boundary findings.

## Validation

- Parser tests cover package extension activation and public async Effect
  surface facts from TypeScript syntax.
- Extension policy tests cover dependency activation, explicit enablement
  without dependency as blocking `error`, configured activation, and pack
  disabling.
- Agent snapshot tests cover the new section order and keep dependency fields
  out of default snapshots.
- Self-apply keeps this repository at zero default findings.
