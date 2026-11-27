# Effect Capability Boundaries M17 Plan

M17 extends the active Effect extension from async/resource advice into a
capability-boundary surface while preserving the ASP TypeScript contract:

```text
Effect extension activation
-> parser-native capability facts
-> reasoning tree modules
-> low-noise extension_policy advice
-> agent compact text with concrete repair steps
```

## Capability Map

The current Effect policy surface already covers several official Effect
capabilities without turning ASP TypeScript into a style checker:

- error handling: `TS-EXT-EFFECT-R005` advises typed domain error channels, and
  `TS-EXT-EFFECT-R006` advises `Effect.tryPromise` for rejection-capable
  Promise interop.
- concurrency: `TS-EXT-EFFECT-R008` advises explicit Effect concurrency and
  failure policy for async batches.
- service architecture: `TS-EXT-EFFECT-R004` advises moving leaked service
  requirements into Layer/runtime construction.
- resource management: `TS-EXT-EFFECT-R007` advises explicit Scope boundaries
  for `Effect.acquireRelease`.
- runtime boundaries: `TS-EXT-EFFECT-R003` keeps `Effect.run*` execution at
  entrypoint, framework adapter, or runtime integration owners.
- schema validation: M17 adds `TS-EXT-EFFECT-R009` for public JSON parse
  boundaries without local Effect Schema decode evidence.

## M17 Scope

- Add parser-native `TypeScriptEffectSchemaBoundarySignalFact` for public
  source owners that call `JSON.parse` or `response.json()` without a local
  Effect Schema decode/validate boundary.
- Thread the fact through module reports, reasoning modules, and public model
  exports.
- Add `TS-EXT-EFFECT-R009` as `info`, advising agents to use
  `Schema.decodeUnknown`, `Schema.decodeUnknownEither`, or `Schema.parseJson`
  and map parse failures into typed domain errors.
- Keep agent compact text grouped by rule and owner, with bounded examples and
  direct fix steps instead of dumping raw finding identifiers.

## Non-Goals

M17 does not implement streams, observability, metrics, tracing, or full Effect
service-architecture verification. Those should become later slices only after
the parser exposes stable native facts such as public `Stream.Stream`
boundaries, `Effect.withSpan`/logging/metric calls, or service layer
construction facts.

M17 also does not run Effect programs, inspect installed package versions, or
add a manifest dependency gate. Activation remains project-wide from known
Effect package/config facts, and all advice stays non-blocking unless a caller
explicitly promotes it.

## Validation

- Parser tests cover JSON-boundary facts, Schema decode suppression, and public
  source owner selection.
- Extension policy tests cover `TS-EXT-EFFECT-R009`, default `info` severity,
  and agent compact text repair guidance.
- Boundary tests ensure rules/reasoning stay downstream of parser-owned facts
  and do not import TypeScript or parser helpers.
- Self-apply remains clean under the default ASP TypeScript.
