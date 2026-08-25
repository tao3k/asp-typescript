import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isTypeScriptHarnessClean,
  renderTypeScriptProjectHarnessAgentCompactText,
  renderTypeScriptProjectHarness,
  renderTypeScriptReasoningTree,
  runTypeScriptProjectHarness,
} from "../../src/index.js";

test("React dependency activates render purity advice from parser-native facts", () => {
  const root = reactProject("dependency-active", {
    packageJson: {
      dependencies: { react: "^19.0.0" },
    },
    source: {
      "clock.tsx": [
        'import { useEffect } from "react";',
        "export function Clock() {",
        "  const now = new Date();",
        "  const random = Math.random();",
        "  document.title = String(random);",
        "  return <time>{now.toISOString()}</time>;",
        "}",
        "export function SafeClock() {",
        '  useEffect(() => { document.title = "safe"; }, []);',
        "  return <time>safe</time>;",
        "}",
        "export function useClockSeed() {",
        "  return Date.now();",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report);
  const findings = report.findings.filter((finding) => finding.ruleId.startsWith("TS-EXT-REACT"));

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.deepEqual(
    report.projectResolution?.packageJson.packageExtensions.map((extension) => ({
      name: extension.name,
      activation: extension.activation,
      coverage: extension.coverage,
      dependencySource: extension.dependencySource,
    })),
    [
      {
        name: "react",
        activation: "dependency",
        coverage: "project",
        dependencySource: "dependencies",
      },
    ],
  );
  assert.deepEqual(
    findings.map(
      (finding) => `${finding.ruleId}:${finding.severity}:${finding.labels.module_role}`,
    ),
    ["TS-EXT-REACT-R002:info:source"],
  );
  assert.match(findings[0]?.labels.react_purity ?? "", /Clock:new Date/u);
  assert.match(findings[0]?.labels.react_purity ?? "", /Clock:Math\.random/u);
  assert.match(findings[0]?.labels.react_purity ?? "", /Clock:document\.title/u);
  assert.match(findings[0]?.labels.react_purity ?? "", /useClockSeed:Date\.now/u);
  assert.doesNotMatch(findings[0]?.labels.react_purity ?? "", /SafeClock/u);
  assert.match(rendered, /\[TS-EXT-REACT-R002\] Info/u);
  assert.match(snapshot, /react activation=dependency/u);
  assert.match(
    advice,
    /\[TS-EXT-REACT-R002\] Info x1: Keep React component and hook render paths pure/u,
  );
  assert.match(advice, /component or hook render path has non-idempotent work/u);
  assert.match(advice, /facts: package\.json React activation/u);
  assert.match(advice, /coverage: project activation=dependency dependency=dependencies/u);
  assert.match(advice, /target_groups:\n   - src\/clock\.tsx x1 first=Clock:new Date/u);
  assert.match(advice, /move `new Date`, `Date\.now`, and `Math\.random` out/u);
  assert.match(advice, /move `document` or `window` writes into `useEffect`/u);
  assert.match(advice, /React Compiler can optimize safely/u);
  assert.match(advice, /targets:\n   - @ src\/clock\.tsx:\d+:\d+ purity=Clock:new Date/u);
});

test("explicit React enablement without dependency is an error-level blocking finding", () => {
  const root = reactProject("config-missing-dependency", {
    packageJson: {
      typescriptProjectHarness: { extensions: { React: "enable" } },
    },
    source: {
      "clock.tsx": ["export function Clock() {", "  return <time />;", "}"],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptProjectHarness(report);
  const snapshot = renderTypeScriptReasoningTree(report);

  assert.equal(isTypeScriptHarnessClean(report), false);
  assert.deepEqual(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("TS-EXT-REACT"))
      .map((finding) => `${finding.ruleId}:${finding.severity}:${finding.label}`),
    ["TS-EXT-REACT-R001:error:declare react before enforcing React extension policy"],
  );
  assert.match(rendered, /\[TS-EXT-REACT-R001\] Error/u);
  assert.match(rendered, /package\.json enables the React extension/u);
  assert.match(snapshot, /react activation=config-enabled-missing-dependency/u);
});

test("React hook order violations are error-level structural findings", () => {
  const root = reactProject("hook-order", {
    packageJson: {
      dependencies: { react: "^19.0.0" },
    },
    source: {
      "hooks.tsx": [
        'import { use, useEffect, useMemo, useState } from "react";',
        "interface Props {",
        "  readonly enabled: boolean;",
        "  readonly items: readonly number[];",
        "  readonly promise: Promise<string>;",
        "}",
        "export function BadHooks({ enabled, items, promise }: Props) {",
        "  if (enabled) {",
        "    useEffect(() => undefined, []);",
        "  }",
        "  for (const item of items) {",
        "    useState(item);",
        "  }",
        "  if (!enabled) return null;",
        "  const [count] = useState(0);",
        "  const handler = () => {",
        "    useMemo(() => count, [count]);",
        "  };",
        "  try {",
        "    use(promise);",
        "  } catch {",
        "    return null;",
        "  }",
        "  return <button onClick={handler}>{count}</button>;",
        "}",
        "export function GoodUse({ enabled, promise }: Props) {",
        "  if (enabled) {",
        "    const value = use(promise);",
        "    return <div>{value}</div>;",
        "  }",
        "  return null;",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report, { findings: "all" });
  const finding = report.findings.find((candidate) => candidate.ruleId === "TS-EXT-REACT-R003");

  assert.equal(isTypeScriptHarnessClean(report), false);
  assert.equal(finding?.severity, "error");
  assert.match(finding?.labels.react_hook_calls ?? "", /BadHooks:useEffect/u);
  assert.match(finding?.labels.react_hook_calls ?? "", /BadHooks:useState/u);
  assert.match(finding?.labels.react_hook_calls ?? "", /BadHooks:useMemo/u);
  assert.match(finding?.labels.react_hook_calls ?? "", /BadHooks:use/u);
  assert.doesNotMatch(finding?.labels.react_hook_calls ?? "", /GoodUse/u);
  assert.match(finding?.labels.react_hook_violation_kinds ?? "", /conditional/u);
  assert.match(finding?.labels.react_hook_violation_kinds ?? "", /loop/u);
  assert.match(finding?.labels.react_hook_violation_kinds ?? "", /after-conditional-return/u);
  assert.match(finding?.labels.react_hook_violation_kinds ?? "", /nested-function/u);
  assert.match(finding?.labels.react_hook_violation_kinds ?? "", /try-catch-finally/u);
  assert.match(
    advice,
    /\[TS-EXT-REACT-R003\] Error x1: Move React hooks back to stable top-level call order/u,
  );
  assert.match(advice, /call hooks unconditionally at the top level/u);
  assert.match(advice, /move conditions inside `useEffect`, `useMemo`/u);
  assert.match(advice, /do not wrap React `use` in try\/catch/u);
  assert.match(advice, /targets:\n   - @ src\/hooks\.tsx:\d+:\d+ hooks=BadHooks:useEffect/u);
});

test("React static component and hook factories produce compiler-readiness advice", () => {
  const root = reactProject("static-definitions", {
    packageJson: {
      dependencies: { react: "^19.0.0" },
    },
    source: {
      "static.tsx": [
        "interface Props { readonly theme: string }",
        "export function Parent({ theme }: Props) {",
        "  function ThemedButton() {",
        "    return <button className={theme}>ok</button>;",
        "  }",
        "  const useThemedLabel = () => theme;",
        "  return <ThemedButton />;",
        "}",
      ],
    },
  });

  const report = runTypeScriptProjectHarness(root);
  const advice = renderTypeScriptProjectHarnessAgentCompactText(report);
  const finding = report.findings.find((candidate) => candidate.ruleId === "TS-EXT-REACT-R004");

  assert.equal(isTypeScriptHarnessClean(report), true);
  assert.equal(finding?.severity, "info");
  assert.match(finding?.labels.react_static_definitions ?? "", /Parent:ThemedButton/u);
  assert.match(finding?.labels.react_static_definitions ?? "", /Parent:useThemedLabel/u);
  assert.match(finding?.labels.react_static_definition_kinds ?? "", /nested-component/u);
  assert.match(finding?.labels.react_static_definition_kinds ?? "", /nested-hook/u);
  assert.match(
    advice,
    /\[TS-EXT-REACT-R004\] Info x1: Hoist nested React components and hooks to module scope/u,
  );
  assert.match(advice, /hoist nested component and custom hook definitions to module scope/u);
  assert.match(advice, /pass render-local values through props or explicit hook parameters/u);
  assert.match(
    advice,
    /targets:\n   - @ src\/static\.tsx:\d+:\d+ definitions=Parent:ThemedButton/u,
  );
});

function reactProject(
  name: string,
  options: {
    readonly packageJson: Record<string, unknown>;
    readonly source: Readonly<Record<string, string | readonly string[]>>;
  },
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asp-typescript-react-${name}-`));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: `@example/${name}`, type: "module", ...options.packageJson }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        jsx: "preserve",
        lib: ["ES2020", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2020",
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "react.d.ts"),
    [
      'declare module "react" {',
      "  export function use<T>(promise: Promise<T>): T;",
      "  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;",
      "  export function useMemo<T>(factory: () => T, deps?: readonly unknown[]): T;",
      "  export function useState<T>(initial: T): readonly [T, (next: T) => void];",
      "}",
      "declare namespace JSX {",
      "  interface IntrinsicElements {",
      "    [elemName: string]: unknown;",
      "  }",
      "}",
    ].join("\n"),
  );
  for (const [relativePath, source] of Object.entries(options.source)) {
    fs.writeFileSync(
      path.join(root, "src", relativePath),
      typeof source === "string" ? source : source.join("\n"),
    );
  }
  return root;
}
