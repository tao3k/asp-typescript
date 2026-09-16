# Effect Policy Enrichment M14 Plan

M14 enriches the Effect extension without expanding ASP TypeScript into a general
Effect style checker:

```text
package extension activation
-> parser-native Effect runtime/service facts
-> low-noise extension_policy advice
-> compact agent output
```

## Research Input

The policy is calibrated against `Effect-TS/website` docs at
`50d51c76077aed9bc457ff950be41af42cb868d5`:

- `runtime.mdx`: `Runtime.run*` and `Effect.run*` execute Effect descriptions,
  and `ManagedRuntime` is used at top-level/framework integration boundaries.
- `error-management/expected-errors.mdx`: `Effect<Success, Error,
Requirements>` exposes errors in the second type parameter and requirements
  in the third type parameter; the docs recommend tagged errors for precise
  recovery with `_tag`, `catchTag`, and `catchTags`.
- `getting-started/creating-effects.mdx`: `Effect.promise` is for Promise
  operations known not to reject; `Effect.tryPromise` is for Promise interop
  that might reject and can map unknown failures into the error channel.

## Scope

- Add parser-native facts for Effect runtime execution calls:
  `Effect.runPromise`, `Effect.runPromiseExit`, `Effect.runSync`,
  `Effect.runSyncExit`, `Effect.runFork`, and runtime-shaped `.run*` calls.
- Add parser-native facts for public service methods returning
  `Effect.Effect<Success, Error, Requirements>` from exported interfaces, type
  literals, public class methods, and exported `Effect.Tag` service shapes.
- Classify weak public Effect error channels from TypeScript `TypeNode` facts:
  primitive, literal, `any`, `unknown`, `object`, `void`, `undefined`, and
  `null` error channels are weak; `never` is clear; named/domain errors stay
  accepted.
- Classify rejection-capable `Effect.promise` interop from public owner ASTs:
  async callbacks, `throw`, and `Promise.reject` are advice-worthy because they
  hide failures outside a typed error mapper.
- Add `TS-EXT-EFFECT-R003` as `info` when runtime execution appears in source
  modules instead of entrypoint/adapter/runtime boundaries.
- Add `TS-EXT-EFFECT-R004` as `info` when public service methods expose a
  non-`never` requirements type, nudging dependencies into Layer/runtime
  construction.
- Add `TS-EXT-EFFECT-R005` as `info` when public Effect APIs expose weak error
  channels instead of tagged/domain errors.
- Add `TS-EXT-EFFECT-R006` as `info` when public Effect APIs use
  `Effect.promise` for rejection-capable interop that should be expressed with
  `Effect.tryPromise`.

## Non-Goals

M14 does not inspect installed Effect versions, execute Effect programs, enforce
pipe/gen style, require every Promise boundary to be rewritten, or introduce a
manifest dependency policy. Runtime calls remain valid in entrypoint, test, and
framework-adapter style boundaries. It also does not flag ordinary `Error`
channels by default, and it does not guess whether every network/file/client
call can reject; R006 only fires on AST-visible rejection signals.

## Validation

- Parser tests cover runtime-call facts, service-method `Effect` return facts,
  weak error-channel classification, and rejection-capable Promise interop
  facts from TypeScript AST nodes.
- Extension policy tests cover runtime boundary advice, entrypoint suppression,
  service requirement advice, typed error-channel advice, Promise interop
  advice, and pack disabling through the existing policy config pass.
- Self-apply must remain clean under the default ASP TypeScript.
