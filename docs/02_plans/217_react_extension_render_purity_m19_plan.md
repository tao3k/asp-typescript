# React Extension Render Purity M19 Plan

M19 starts the React extension from the same parser-first ASP TypeScript mechanism as
Effect:

```text
React package/config activation
-> parser-native component/hook render-purity facts
-> reasoning tree modules
-> low-noise extension_policy advice
-> agent compact text with concrete React repair steps
```

## Research Input

The policy is calibrated against the local React docs snapshot at
`.data/react.dev@6ec61348646040795fdaa9de14a9bec603260f87`:

- `reference/rules/components-and-hooks-must-be-pure.md`: components and hooks
  must be idempotent and side-effect free during render.
- `learn/react-compiler/introduction.md`: React Compiler depends on components
  following the Rules of React and can skip components it cannot optimize.
- `reference/eslint-plugin-react-hooks/index.md`: lint diagnostics remain the
  canonical hook-rule and compiler diagnostic surface.
- `reference/eslint-plugin-react-hooks/lints/static-components.md`: component
  identity and render-time definition hazards are follow-up policy candidates,
  but M19 keeps the first slice focused on obvious render-purity facts.

## Scope

- Add parser-native `TypeScriptReactRenderPuritySignalFact` for public
  PascalCase components and `use*` hooks.
- Record obvious render-purity signals: `new Date`, `Date.now`,
  `Math.random`, and writes to `document` or `window` during render.
- Add React package extension activation from `react` dependencies or
  `asp-typescript.extensions.react`.
- Emit `TS-EXT-REACT-R001` as `error` for explicit React config without a
  `react` dependency.
- Emit `TS-EXT-REACT-R002` as `info` with compact agent repair steps for active
  React projects.

## Non-Goals

M19 does not replace `eslint-plugin-react-hooks`, React Compiler diagnostics,
framework compilers, JSX transforms, hydration checks, accessibility checks, or
UI style policy. It also does not add React package dependency gates beyond the
explicit extension-config consistency check.

## Validation

- Parser tests cover React component/hook render-purity facts through TSX.
- Extension policy tests cover React dependency activation, explicit config
  errors, default `info` advice, and compact repair text.
- Rule catalog and public API tests cover the new rule ids and model facts.
- Boundary tests ensure rules/reasoning stay downstream of parser-owned facts.
- Self-apply remains clean under the default ASP TypeScript.
