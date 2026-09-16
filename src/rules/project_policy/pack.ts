import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningTree,
} from "../../model.js";
import { diagnosticFinding, relativeToProject } from "../common.js";

const TS_PROJ_R001: AspTypeScriptRule = {
  ruleId: "TS-AGENT-PROJECT-001",
  packId: "typescript.project_policy",
  severity: "warning",
  title: "Project should declare tsconfig",
  requirement:
    "Project runs should declare tsconfig.json so ASP TypeScript sees TypeScript's source set.",
  labels: { surface: "project", parser: "tsconfig" },
};

const TS_PROJ_R002: AspTypeScriptRule = {
  ruleId: "TS-AGENT-PROJECT-002",
  packId: "typescript.project_policy",
  severity: "error",
  title: "tsconfig must parse",
  requirement: "tsconfig.json must parse through TypeScript's native config parser.",
  labels: { surface: "project", parser: "tsconfig" },
};

const TS_PROJ_R003: AspTypeScriptRule = {
  ruleId: "TS-AGENT-PROJECT-003",
  packId: "typescript.project_policy",
  severity: "info",
  title: "package.json should parse",
  requirement:
    "package.json should parse so package entry fields, exports, imports, bins, scripts, and workspaces are visible.",
  labels: { surface: "project", parser: "package-json" },
};

const TS_PROJ_R004: AspTypeScriptRule = {
  ruleId: "TS-AGENT-PROJECT-004",
  packId: "typescript.project_policy",
  severity: "info",
  title: "Project references should be composite",
  requirement:
    "TypeScript project references should point to local configs with composite and declaration enabled.",
  labels: { surface: "project-reference", parser: "tsconfig" },
};

const TS_PROJ_R005: AspTypeScriptRule = {
  ruleId: "TS-AGENT-PROJECT-005",
  packId: "typescript.project_policy",
  severity: "info",
  title: "Package entries need modern module resolution",
  requirement:
    "Projects using package.json exports or imports should use node16, nodenext, or bundler moduleResolution so TypeScript follows modern package entry semantics.",
  labels: { surface: "project", parser: "tsconfig" },
};

const TS_PROJ_R006: AspTypeScriptRule = {
  ruleId: "TS-AGENT-PROJECT-006",
  packId: "typescript.project_policy",
  severity: "info",
  title: "Rspack projects should expose npm build scripts",
  requirement:
    "When package.json or config files declare Rspack, the project should expose that build surface through package scripts so npm check/test and agents can run the same build path.",
  labels: { surface: "project", parser: "package-json", build_tool: "rspack" },
};

export function typeScriptProjectPolicyRules(): readonly AspTypeScriptRule[] {
  return [TS_PROJ_R001, TS_PROJ_R002, TS_PROJ_R003, TS_PROJ_R004, TS_PROJ_R005, TS_PROJ_R006];
}

export function evaluateProjectPolicyRules(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  const findings: AspTypeScriptFinding[] = [];
  if (reasoningTree.runMode === "project" && reasoningTree.configPath === undefined) {
    findings.push({
      ruleId: TS_PROJ_R001.ruleId,
      packId: TS_PROJ_R001.packId,
      severity: TS_PROJ_R001.severity,
      title: TS_PROJ_R001.title,
      summary: "No tsconfig.json was found for this project run.",
      location: { path: reasoningTree.projectRoot, line: 1, column: 0 },
      requirement: TS_PROJ_R001.requirement,
      label: "missing tsconfig.json",
      labels: TS_PROJ_R001.labels,
    });
  }
  findings.push(
    ...reasoningTree.diagnostics
      .filter((diagnostic) => diagnostic.phase === "config")
      .map((diagnostic) =>
        diagnosticFinding(TS_PROJ_R002, diagnostic, "TypeScript config parser diagnostic"),
      ),
    ...reasoningTree.diagnostics
      .filter((diagnostic) => diagnostic.phase === "package-json")
      .map((diagnostic) =>
        diagnosticFinding(TS_PROJ_R003, diagnostic, "package.json parser diagnostic"),
      ),
    ...evaluateProjectReferenceConfigAdvice(reasoningTree),
    ...evaluatePackageEntryResolutionModeAdvice(reasoningTree),
    ...evaluateRspackBuildSurfaceAdvice(reasoningTree),
  );
  return findings;
}

function evaluateProjectReferenceConfigAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return reasoningTree.projectReferencePackages.flatMap((referencePackage) => {
    if (referencePackage.configPath === undefined) {
      return [
        {
          ruleId: TS_PROJ_R004.ruleId,
          packId: TS_PROJ_R004.packId,
          severity: TS_PROJ_R004.severity,
          title: TS_PROJ_R004.title,
          summary: `Project reference package '${referencePackage.name ?? relativeToProject(reasoningTree, referencePackage.path)}' has no local tsconfig.json.`,
          location: { path: referencePackage.packageJsonPath, line: 1, column: 0 },
          requirement: TS_PROJ_R004.requirement,
          label: "missing referenced project config",
          labels: TS_PROJ_R004.labels,
        },
      ];
    }
    const compilerOptions = referencePackage.compilerOptions;
    if (compilerOptions === undefined) {
      return [];
    }
    const missingOptions = [
      compilerOptions.composite ? undefined : "composite",
      compilerOptions.declaration ? undefined : "declaration",
    ].filter((option): option is string => option !== undefined);
    if (missingOptions.length === 0) {
      return [];
    }
    return [
      {
        ruleId: TS_PROJ_R004.ruleId,
        packId: TS_PROJ_R004.packId,
        severity: TS_PROJ_R004.severity,
        title: TS_PROJ_R004.title,
        summary: `Project reference package '${referencePackage.name ?? relativeToProject(reasoningTree, referencePackage.path)}' should enable ${missingOptions.join(" and ")} in its local tsconfig.json.`,
        location: { path: referencePackage.configPath, line: 1, column: 0 },
        requirement: TS_PROJ_R004.requirement,
        label: "referenced project config",
        labels: TS_PROJ_R004.labels,
      },
    ];
  });
}

function evaluatePackageEntryResolutionModeAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  if (
    reasoningTree.configPath === undefined ||
    (!reasoningTree.packageExports.length && !reasoningTree.packageImports.length)
  ) {
    return [];
  }
  const moduleResolution = reasoningTree.compilerOptions.moduleResolution?.toLowerCase();
  if (
    moduleResolution === "node16" ||
    moduleResolution === "nodenext" ||
    moduleResolution === "bundler"
  ) {
    return [];
  }
  const packageEntryKinds = [
    reasoningTree.packageExports.length > 0 ? "exports" : undefined,
    reasoningTree.packageImports.length > 0 ? "imports" : undefined,
  ].filter((kind): kind is string => kind !== undefined);
  return [
    {
      ruleId: TS_PROJ_R005.ruleId,
      packId: TS_PROJ_R005.packId,
      severity: TS_PROJ_R005.severity,
      title: TS_PROJ_R005.title,
      summary: `package.json ${packageEntryKinds.join("/")} is present, but tsconfig moduleResolution is ${moduleResolution ?? "not declared"}.`,
      location: { path: reasoningTree.configPath, line: 1, column: 0 },
      requirement: TS_PROJ_R005.requirement,
      label: "package entry module resolution",
      labels: TS_PROJ_R005.labels,
    },
  ];
}

function evaluateRspackBuildSurfaceAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  const rspack = reasoningTree.packageBuildTools.find((buildTool) => buildTool.name === "rspack");
  if (rspack === undefined || rspack.scriptNames.length > 0) {
    return [];
  }
  return [
    {
      ruleId: TS_PROJ_R006.ruleId,
      packId: TS_PROJ_R006.packId,
      severity: TS_PROJ_R006.severity,
      title: TS_PROJ_R006.title,
      summary: `Rspack is visible through ${rspackSignalSummary(rspack)}, but package.json scripts do not expose rspack build or serve.`,
      location: rspack.location,
      requirement: TS_PROJ_R006.requirement,
      label: "expose Rspack through package scripts",
      labels: {
        ...TS_PROJ_R006.labels,
        packages: rspack.packageNames.join(","),
        configs: rspack.configFiles.join(","),
        repair:
          "add package scripts such as build=rspack build and keep tsc in check/test when type or declaration output is required",
      },
    },
  ];
}

function rspackSignalSummary(
  buildTool: TypeScriptReasoningTree["packageBuildTools"][number],
): string {
  const parts = [
    buildTool.packageNames.length > 0 ? `packages ${buildTool.packageNames.join(",")}` : undefined,
    buildTool.configFiles.length > 0 ? `configs ${buildTool.configFiles.join(",")}` : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? "package.json ASP TypeScript config" : parts.join(" and ");
}
