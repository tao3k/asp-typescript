import type { AspTypeScriptFinding } from "../model.js";

export function reactAgentTaskTitle(finding: AspTypeScriptFinding): string | undefined {
  switch (finding.ruleId) {
    case "TS-EXT-REACT-R001":
      return "Make explicit React extension config match package dependencies";
    case "TS-EXT-REACT-R002":
      return "Keep React component and hook render paths pure";
    case "TS-EXT-REACT-R003":
      return "Move React hooks back to stable top-level call order";
    case "TS-EXT-REACT-R004":
      return "Hoist nested React components and hooks to module scope";
    default:
      return undefined;
  }
}

export function reactAdviceFixSteps(finding: AspTypeScriptFinding): readonly string[] | undefined {
  switch (finding.ruleId) {
    case "TS-EXT-REACT-R001":
      return [
        "if React policy is intended, add `react` to package dependencies and keep `asp-typescript.extensions.react` enabled",
        "otherwise remove the explicit extension config",
      ];
    case "TS-EXT-REACT-R002":
      return [
        "move `new Date`, `Date.now`, and `Math.random` out of component or hook render paths",
        "use a lazy `useState` initializer, event handler, server-provided value, or Effect/domain boundary for non-idempotent values",
        "move `document` or `window` writes into `useEffect` or an event handler, with cleanup when the write has lifetime",
        "keep exported components and hooks idempotent so React can re-render and React Compiler can optimize safely",
      ];
    case "TS-EXT-REACT-R003":
      return [
        "call hooks unconditionally at the top level of the component or custom hook",
        "move conditions inside `useEffect`, `useMemo`, or the hook callback instead of wrapping the hook call",
        "move hooks out of loops and nested callbacks; extract a child component or custom hook when each item needs its own state",
        "do not wrap React `use` in try/catch; handle errors with an Error Boundary or route/framework error boundary",
      ];
    case "TS-EXT-REACT-R004":
      return [
        "hoist nested component and custom hook definitions to module scope",
        "pass render-local values through props or explicit hook parameters instead of closing over parent render state",
        "select between already-defined components by reference instead of constructing a new component during render",
        "keep component and hook identities stable so state is preserved and React Compiler can optimize more of the tree",
      ];
    default:
      return undefined;
  }
}

export function reactProblemText(finding: AspTypeScriptFinding): string | undefined {
  switch (finding.ruleId) {
    case "TS-EXT-REACT-R001":
      return "package config enables React policy but package dependencies do not provide React";
    case "TS-EXT-REACT-R002":
      return "public React component or hook render path has non-idempotent work or browser side effects";
    case "TS-EXT-REACT-R003":
      return "React hook call is conditional, nested, looped, after a conditional return, or inside try/catch/finally";
    case "TS-EXT-REACT-R004":
      return "React render path recreates a component or custom hook definition";
    default:
      return undefined;
  }
}

export function reactParserEvidenceText(finding: AspTypeScriptFinding): string | undefined {
  switch (finding.ruleId) {
    case "TS-EXT-REACT-R001":
      return "package.json extension config + dependency facts";
    case "TS-EXT-REACT-R002":
      return "package.json React activation + native component/hook render purity signals";
    case "TS-EXT-REACT-R003":
      return "package.json React activation + native hook-call context facts";
    case "TS-EXT-REACT-R004":
      return "package.json React activation + native nested component/hook definition facts";
    default:
      return undefined;
  }
}
