import type {
  TypeScriptModuleReport,
  TypeScriptNativeDiagnostic,
  AspTypeScriptProjectScope,
  TypeScriptReasoningDiagnosticFact,
} from "../model.js";

export function reasoningDiagnostics(
  scope: AspTypeScriptProjectScope,
  modules: readonly TypeScriptModuleReport[],
): TypeScriptReasoningDiagnosticFact[] {
  return [...projectDiagnostics(scope), ...moduleDiagnostics(modules)].sort(compareDiagnostics);
}

export function moduleDiagnostics(
  modules: readonly TypeScriptModuleReport[],
): TypeScriptReasoningDiagnosticFact[] {
  return modules
    .flatMap((moduleReport) => [
      ...moduleReport.diagnostics.map((diagnostic) =>
        reasoningDiagnostic(moduleReport.path, "syntax", diagnostic),
      ),
      ...moduleReport.semanticDiagnostics.map((diagnostic) =>
        reasoningDiagnostic(moduleReport.path, "semantic", diagnostic),
      ),
    ])
    .sort(compareDiagnostics);
}

function compareDiagnostics(
  left: TypeScriptReasoningDiagnosticFact,
  right: TypeScriptReasoningDiagnosticFact,
): number {
  return `${left.ownerPath}:${left.phase}:${left.location.line}:${left.location.column}`.localeCompare(
    `${right.ownerPath}:${right.phase}:${right.location.line}:${right.location.column}`,
  );
}

function projectDiagnostics(scope: AspTypeScriptProjectScope): TypeScriptReasoningDiagnosticFact[] {
  const configDiagnostics = scope.config.diagnostics.map((diagnostic) =>
    reasoningDiagnostic(scope.config.configPath ?? scope.projectRoot, "config", diagnostic),
  );
  const packageDiagnostics = [
    ...scope.packageJson.diagnostics.map((diagnostic) =>
      reasoningDiagnostic(scope.packageJson.path ?? scope.projectRoot, "package-json", diagnostic),
    ),
    ...scope.config.projectReferencePackages.flatMap((referencePackage) =>
      referencePackage.diagnostics.map((diagnostic) =>
        reasoningDiagnostic(referencePackage.packageJsonPath, "package-json", diagnostic),
      ),
    ),
    ...scope.packageJson.workspacePackages.flatMap((workspacePackage) =>
      workspacePackage.diagnostics.map((diagnostic) =>
        reasoningDiagnostic(workspacePackage.packageJsonPath, "package-json", diagnostic),
      ),
    ),
  ];
  return [...configDiagnostics, ...packageDiagnostics];
}

function reasoningDiagnostic(
  ownerPath: string,
  phase: TypeScriptReasoningDiagnosticFact["phase"],
  diagnostic: TypeScriptNativeDiagnostic,
): TypeScriptReasoningDiagnosticFact {
  const fact: TypeScriptReasoningDiagnosticFact = {
    ownerPath,
    phase,
    code: diagnostic.code,
    category: diagnostic.category,
    message: diagnostic.message,
    location: diagnostic.location,
    relatedInformation: diagnostic.relatedInformation,
  };
  const withSource =
    diagnostic.source === undefined ? fact : { ...fact, source: diagnostic.source };
  return diagnostic.sourceLine === undefined
    ? withSource
    : { ...withSource, sourceLine: diagnostic.sourceLine };
}
