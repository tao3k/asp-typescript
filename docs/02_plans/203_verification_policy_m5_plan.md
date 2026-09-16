# Verification Policy M5 Plan

M5 adds a Rust-aligned verification policy foundation on top of the M4 parser
and rule-pack architecture. It keeps the same authority chain:

```text
TypeScript native parser facts
-> reasoning tree facts
-> configured low-noise policy
-> compact agent output
-> external verification task contracts
```

The milestone does not run stress, performance, chaos, or security tools. It
derives deterministic task contracts that tell agents which external skill must
produce which receipt for a parser-visible owner.

## Scope

- Add `TypeScriptVerificationPolicy` to `AspTypeScriptConfig`.
- Expose immutable helpers for profile hints, receipts, waivers, responsibility
  task mapping, task contract overrides, skill bindings, and skill descriptors.
- Add verification planning from an existing ASP TypeScript report or from a project
  root.
- Keep verification state compact: pending and failed tasks render by default;
  satisfied receipts and complete waivers hide resolved tasks.
- Render expandable skill contracts separately from the first-read task surface.
- Keep parser-native facts authoritative. Verification consumes the reasoning
  tree and never imports TypeScript parser APIs or parser helpers.

## Responsibilities

Profile hints classify owners with a small vocabulary:

- `pure_domain_logic`
- `public_api`
- `external_dependency`
- `persistence`
- `security_boundary`
- `latency_sensitive`
- `availability_critical`

Default task mapping stays conservative:

- `public_api` creates `stress`.
- `latency_sensitive` creates `performance`.
- `external_dependency`, `persistence`, and `availability_critical` create
  `chaos`.
- `security_boundary` creates `security`.
- `pure_domain_logic` creates no external task by itself.

If a profile hint drifts from parser facts, M5 creates
`responsibility_review`. Examples include a hint that points at no parser-known
module, a hint with no responsibilities, an explicit task override without a
local rationale, or `pure_domain_logic` on an owner that has parser-visible
external imports, unresolved imports, or non-test owner dependencies.

## Outputs

Library consumers can call:

- `planTypeScriptProjectVerification(projectRoot)`
- `planTypeScriptProjectVerificationWithConfig(projectRoot, config)`
- `planTypeScriptProjectVerificationForReport(report, policy)`
- `renderTypeScriptVerificationPlan(plan)`
- `renderTypeScriptVerificationPlanJson(plan)`
- `renderTypeScriptVerificationSkillContracts(plan)`

The compact renderer is intentionally not a second ASP TypeScript report. It is a
reminder surface:

```text
[verify] src/api.ts
   |owner: src/api
   |performance: pending phase=after_unit_tests_pass fingerprint=tsv:...
   |why: performance=profile declares latency-sensitive TypeScript owner
   |requires: performance=benchmark_command,baseline,regression_threshold,latency_or_throughput,allocation_profile,profile_artifact
```

When a configured skill binding exists, the task line keeps only the skill and
contract reference, and `renderTypeScriptVerificationSkillContracts()` provides
the expanded command, inputs, pass criteria, and receipt fields.

## Non-Goals

M5 does not add CLI flags, CI execution, report bundles, verifier subprocess
management, profile index discovery, or manifest dependency policy. Those are
M6+ topics if the ASP TypeScript needs the fuller Rust verification
subsystem later.

## Validation

- Unit tests cover profile mapping, parser-fact drift review, receipts, waivers,
  skill bindings, compact rendering, JSON rendering, and public API exports.
- Boundary tests ensure verification modules do not import parser helpers or
  TypeScript parser APIs.
- Self-apply remains the default gate: the repository must produce zero default
  ASP TypeScript findings.
