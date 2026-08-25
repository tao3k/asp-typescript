# Native Parser Alignment Plan

This plan keeps M2 aligned around one dependency chain:

```text
TypeScript native parser facts
-> reasoning tree facts
-> low-noise agent policy
-> compact agent output
-> self-apply validation
```

## Current Invariant

The `src/parser.ts` facade and `src/parser/` parser layer are the only owners
of TypeScript Compiler API calls, `tsconfig` parsing, TypeScript JSON parsing,
and native module resolution.
Reasoning, rules, runners, and renderers consume model facts. They do not
import `typescript`, call parser APIs, or recover TypeScript semantics from
raw source text.

## M2 Parser-First Workplan

1. Native parser fact layer
   - Keep `ts.createSourceFile`, `ts.createProgram`, `ts.parseJsonText`,
     `ts.readConfigFile`, `ts.parseJsonConfigFileContent`, and
     `ts.resolveModuleName` isolated in the parser layer.
   - Preserve syntax diagnostics, semantic diagnostics, related information,
     import/export facts, script kind, declaration status, source locations,
     compiler options, project references, path aliases, package metadata, and
     native import resolution.
   - For package metadata, preserve conditional `exports` / `imports` target
     branches as parser-owned target facts with condition paths and exact JSON
     AST locations.

2. Reasoning tree projection
   - Treat the reasoning tree as the first policy surface. Project runs anchor
     at the nearest parent `package.json`, then carry runner mode, roots,
     compiler facts, package facts, diagnostics, module roles, module layers,
     line counts, edges, owner branches, owner dependencies, package import
     owner facts, and package entry ownership.
   - Do not reimplement TypeScript module resolution or package JSON traversal
     in reasoning. It may map parser facts to owner facts, but new semantics
     begin in the parser layer.

3. Low-noise agent policy
   - Keep structural parser failures blocking only when they truly break the
     project surface: TypeScript syntax, missing project config guidance, and
     malformed `tsconfig`.
   - Keep semantic diagnostics, malformed package metadata, modularity,
     test-layout, and `TS-AGENT-*` repair hints visible as `info`.
   - Add agent advice only when the reasoning tree carries a native parser fact
     precise enough to point at the right owner or JSON location.

4. Compact agent output
   - Keep compact output as the default human/agent surface; JSON remains for
     tools.
   - The agent snapshot should follow the Rust harness shape: `Modules:`,
     `OwnerBranches:`, `OwnerDependencies:`, and `FindingGroups:`. It should
     render reasoning-tree `ownerBranches` and `ownerDependencies`, omit
     singleton and zero-value boilerplate, and keep full diagnostics in the
     default compact renderer and JSON output.

5. Self-apply validation
   - Boundary tests must prove only the parser layer imports `typescript` and
     that rules/renderers consume reasoning-tree facts.
   - The repository must pass its own default harness and advice surface with
     zero findings.
   - Acceptance stays: `npm run check`, `npm run lint`, `npm test`,
     `npm run harness`, and `git diff --check` through `direnv exec .`.

## Current Parser Slice

The active parser slice upgrades package metadata from flat targets to native
target details:

- `PackageJsonEntryFact.targets` remains for compatibility.
- `PackageJsonEntryFact.targetDetails` preserves each target string, its
  conditional path, and its TypeScript JSON AST location.
- `TypeScriptPackageEntryResolutionFact` carries those condition paths into
  package owner resolution and `TS-AGENT-POLICY-002` advice.
- `asp-typescript search prime` renders package entry ownership as owner dependencies,
  such as `package exports:. [import] --owner--> src/index.ts`, and groups
  unresolved package targets through `FindingGroups:` instead of repeating full
  diagnostic cards.

## M2 Closure Contract

M2 closes when the project can prove the whole chain in one pass:

- parser-native facts are owned by `src/parser.ts` and `src/parser/`;
- reasoning tree facts are the only policy and compact-snapshot input;
- package-name imports resolve to package import owner facts, not manifest
  dependency checks;
- compact snapshot text is covered by the golden fixture and self-applies to
  this repository;
- docs and tests point to the same snapshot contract instead of preserving
  copied Rust/Python wording.
