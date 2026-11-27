# Effect Production Observability M18 Plan

M18 keeps the Effect extension on the production path before starting a broad
React extension:

```text
Effect extension activation
-> parser-native external IO + telemetry/resilience facts
-> reasoning tree modules
-> low-noise extension_policy advice
-> agent compact text with concrete production repair steps
```

## Research Input

The policy is calibrated against the local Effect website docs snapshot at
`.data/effect-website@50d51c76077aed9bc457ff950be41af42cb868d5`:

- `observability/tracing.mdx`: `Effect.withSpan` instruments work with spans.
- `observability/logging.mdx`: Effect logging and `Effect.annotateLogs` provide
  scoped production context.
- `observability/metrics.mdx`: `Metric.counter`, `Metric.trackDuration`, and
  related metrics expose request counts, durations, and error/latency signals.
- `error-management/retrying.mdx`: `Effect.retry` and `Effect.retryOrElse`
  model transient-failure policy with `Schedule`.
- `concurrency/fibers.mdx`: long-running computations should use timeout
  operations when they can exceed expected duration.

React extension research is also staged locally at
`.data/react.dev@6ec61348646040795fdaa9de14a9bec603260f87`. The first React
extension should start from official docs around React Compiler, Rules of
React, hook lint rules, and effect minimization rather than generic UI style.

## Scope

- Add parser-native `TypeScriptEffectProductionBoundarySignalFact` for public
  owners that construct external IO boundaries with `Effect.tryPromise`,
  `Effect.promise`, `Effect.async`, or `fetch`.
- Classify whether the same owner already has observability evidence:
  `Effect.withSpan`, Effect log/annotation calls, or `Metric.*`.
- Classify whether the same owner already has resilience evidence:
  `Effect.retry*` or `Effect.timeout*`.
- Add `TS-EXT-EFFECT-R010` as `info`, advising agents to put span names,
  log/span attributes, metrics, retry, and timeout policy at the public Effect
  boundary.

## Non-Goals

M18 does not execute effects, inspect installed Effect versions, require
OpenTelemetry packages, enforce a metrics backend, or introduce a manifest
dependency gate. It also does not implement stream/backpressure advice yet.
Stream policy should be a separate slice over `Stream.Stream`-specific parser
facts.

M18 does not implement the React extension. It only records the React docs
research baseline so the next milestone can add a parser-first React policy
instead of a generic JSX style linter.

## Validation

- Parser tests cover external IO production boundary facts and suppression when
  both observability and resilience evidence exist.
- Extension policy tests cover `TS-EXT-EFFECT-R010`, default `info` severity,
  and agent compact text repair guidance.
- Boundary tests ensure rules/reasoning stay downstream of parser-owned facts.
- Self-apply remains clean under the default ASP TypeScript.
