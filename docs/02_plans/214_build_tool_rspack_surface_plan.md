# Build Tool Rspack Surface M16 Plan

M16 aligns modern TypeScript project shape with Rspack/Rsbuild without moving
bundler behavior into ASP TypeScript. ASP TypeScript remains:

```text
TypeScript/parser-owned package facts
-> reasoning tree
-> low-noise project advice
-> compact agent output
```

## Scope

- Add parser-owned `packageBuildTools` facts for known Rspack/Rsbuild-family
  dependencies, package scripts, config files, and optional
  `asp-typescript.buildTools` config.
- Render `BuildTools:` in agent snapshots beside `Extensions:`.
- Add one non-blocking Rspack advice rule when Rspack is visible but no package
  script exposes the build surface.
- Keep `tsc` as the owner of type checking and declaration emit. Rspack advice
  must tell agents to keep `tsc --noEmit` or declaration steps when required.

## Non-Goals

- Do not replace `tsc`, framework compilers, Rspack itself, or package-manager
  dependency audits.
- Do not add a generic manifest dependency gate.
- Do not parse arbitrary shell script semantics beyond conservative package
  script orientation facts.

## Acceptance

- Parser tests cover package dependency, script, config-file, and asp-config
  build-tool facts.
- Snapshot tests cover `BuildTools:` output.
- Rule catalog tests keep the Rspack rule as `info`.
- Self-apply remains clean under the default ASP TypeScript.
