# React High-Value Rules M20 Plan

M20 builds on M19 React activation and render-purity facts with the next two
high-return React policy surfaces:

```text
React package/config activation
-> parser-native hook-call and static-definition facts
-> reasoning tree modules
-> configured extension_policy findings
-> compact agent text with structural repair steps
```

## Research Input

The policy is calibrated against the local React docs snapshot at
`.data/react.dev@6ec61348646040795fdaa9de14a9bec603260f87`:

- `reference/eslint-plugin-react-hooks/lints/rules-of-hooks.md`: Hooks must
  keep the same call order; conditionals, loops, nested callbacks, async
  functions, and hooks after early returns are common violations. The special
  `use` API may be conditional or looped, but still cannot be wrapped in
  `try`/`catch` and must stay inside a component or hook.
- `reference/eslint-plugin-react-hooks/lints/static-components.md`: component
  definitions recreated during render reset state and cause excessive work.
- `reference/eslint-plugin-react-hooks/lints/component-hook-factories.md`:
  components and hooks should be module-level definitions rather than created
  by render-time factories.
- `learn/react-compiler/introduction.md`: React Compiler depends on code
  following the Rules of React and can optimize more of the tree when component
  and hook identities are stable.

## Scope

- Add parser-native `TypeScriptReactHookCallSignalFact` for exported React
  components and custom hooks when hook calls appear in unstable AST contexts:
  conditional branches, loops, nested functions, after conditional returns, or
  `try`/`catch`/`finally`.
- Treat the special `use` API like React docs describe: allow conditions and
  loops, but report nested-function and `try`/`catch`/`finally` contexts.
- Emit `TS-EXT-REACT-R003` as `error` because unstable hook order is a
  correctness violation, not merely style advice.
- Add parser-native `TypeScriptReactStaticDefinitionSignalFact` for nested
  PascalCase component and `use*` hook definitions inside public React render
  owners.
- Emit `TS-EXT-REACT-R004` as `info` with compact repair steps: hoist the
  definition, pass render-local data through props or hook parameters, and
  select among stable component references.

## Non-Goals

M20 does not reimplement `eslint-plugin-react-hooks`, exhaustive dependency
analysis, React Compiler diagnostics, Server Component policy, accessibility,
or framework-specific routing/build behavior. It also avoids package dependency
gates beyond explicit extension-config consistency.

## Validation

- React extension tests cover conditional, looped, nested, after-return, and
  `try` hook contexts, including the special `use` allowance.
- Static-definition tests cover nested component and custom hook definitions.
- Rule catalog/public API tests include the new rule ids and model fact types.
- Boundary tests keep rules/reasoning downstream of parser-owned facts.
- Self-apply remains clean under the default ASP TypeScript.
