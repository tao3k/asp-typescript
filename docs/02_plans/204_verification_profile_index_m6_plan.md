# Verification Profile Index M6 Plan

M6 adds the Rust-aligned verification profile index on top of the M5
verification planner. The index is the Agent's configuration draft surface:
parser/reasoning facts suggest which owners need `TypeScriptVerificationProfileHint`
entries, then the compact renderer goes quiet after matching hints exist.

The authority chain remains unchanged:

```text
TypeScript native parser facts
-> reasoning tree owner facts
-> verification profile candidates
-> configured verification policy
-> compact agent output
```

## Scope

- Add `TypeScriptVerificationProfileIndex` and
  `TypeScriptVerificationProfileCandidate`.
- Build the index from a project root or an existing ASP TypeScript report.
- Render active profile candidates as compact `[verify-profile]` blocks.
- Render the full index as JSON for structured consumers.
- Expose helpers for active candidates, active profile hints, and clear-state
  checks.
- Keep profile index logic downstream of the reasoning tree and covered by the
  parser-boundary test.

## Candidate Semantics

Candidates are derived from parser/reasoning owner facts:

- module role and layer
- parser-visible export count
- owner dependency count
- TypeScript-native import-resolution counts
- package entry targets that resolve to parser-visible owners

M6 suggests a small, conservative responsibility set:

- `public_api` when an owner is an entrypoint/facade, exports public surface, or
  owns a package entry target.
- `external_dependency` when parser facts show external or `#` package-import
  boundaries.

The index does not infer `latency_sensitive`, `security_boundary`,
`persistence`, or `availability_critical`; those remain project-owned semantics.
It also does not read manifest dependency declarations or turn dependency facts
into policy gates.

## States

- `missing_profile`: no matching profile hint exists for the parser-visible
  owner.
- `profile_drift`: a matching hint exists, but it does not cover all suggested
  responsibilities.
- `configured`: the matching hint covers all suggested responsibilities.

Only `missing_profile` and `profile_drift` render in compact output.
Generated active hints preserve already configured responsibilities and add the
parser-suggested responsibilities, so applying a drift suggestion does not drop
project-owned semantics.

## Non-Goals

M6 does not add CLI flags, verification execution, report bundles, performance
indexes, dependency-signal config, or manifest dependency policy. Those remain
future milestones if the ASP TypeScript needs them after the profile draft
surface is stable.

## Validation

- Unit tests cover missing profile suggestions, profile drift, configured
  quieting, active hint generation, compact render, and JSON render.
- Public API tests lock the new facade exports.
- Parser-boundary tests continue to prove verification modules do not import
  parser helpers or TypeScript parser APIs.
- The repository default ASP TypeScript self-applies with zero findings.
