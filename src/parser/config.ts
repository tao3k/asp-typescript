import path from "node:path";

import ts from "typescript";

import type { TypeScriptProjectConfigFacts, AspTypeScriptProjectScope } from "../model.js";
import { slashPath } from "../reasoning/path_utils.js";
import {
  compilerOptionFacts,
  defaultCompilerOptionFacts,
  pathAliasFacts,
} from "./compiler_options.js";
import { nativeDiagnosticFromTsDiagnostic } from "./diagnostics.js";
import { projectReferencePackageFacts } from "./package_json.js";
import type { TypeScriptProgramInputs } from "./types.js";

export function readTypeScriptConfigFacts(projectRoot: string): TypeScriptProjectConfigFacts {
  const configPath = path.join(projectRoot, "tsconfig.json");
  const tsConfigPath = slashPath(configPath);
  if (!ts.sys.fileExists(configPath)) {
    return {
      fileNames: [],
      projectReferences: [],
      projectReferencePackages: [],
      pathAliases: [],
      compilerOptions: defaultCompilerOptionFacts(),
      diagnostics: [],
    };
  }
  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (readResult.error !== undefined) {
    return {
      configPath,
      fileNames: [],
      projectReferences: [],
      projectReferencePackages: [],
      pathAliases: [],
      compilerOptions: defaultCompilerOptionFacts(),
      diagnostics: [nativeDiagnosticFromTsDiagnostic(readResult.error, tsConfigPath)],
    };
  }
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(tsConfigPath),
    undefined,
    tsConfigPath,
  );
  const baseUrl =
    parsed.options.baseUrl === undefined ? undefined : path.resolve(parsed.options.baseUrl);
  const projectReferences = (parsed.projectReferences ?? [])
    .map((reference) => path.resolve(path.dirname(configPath), reference.path))
    .sort();
  const configFacts: TypeScriptProjectConfigFacts = {
    configPath,
    fileNames: parsed.fileNames.map((fileName) => path.resolve(fileName)).sort(),
    projectReferences,
    projectReferencePackages: projectReferencePackageFacts(projectReferences),
    pathAliases: pathAliasFacts(parsed.options.paths, baseUrl ?? path.dirname(configPath)),
    compilerOptions: compilerOptionFacts(parsed.options),
    diagnostics: parsed.errors.map((diagnostic) =>
      nativeDiagnosticFromTsDiagnostic(diagnostic, tsConfigPath),
    ),
  };
  return baseUrl === undefined ? configFacts : { ...configFacts, baseUrl };
}

export function readTypeScriptProgramInputs(
  scope: AspTypeScriptProjectScope,
): TypeScriptProgramInputs {
  const configPath = scope.config.configPath;
  if (configPath === undefined) {
    return { options: {} };
  }
  const tsConfigPath = slashPath(configPath);
  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (readResult.error !== undefined) {
    return { options: {} };
  }
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(tsConfigPath),
    undefined,
    tsConfigPath,
  );
  const programInputs: TypeScriptProgramInputs = {
    options: parsed.options,
  };
  return parsed.projectReferences === undefined
    ? programInputs
    : { ...programInputs, projectReferences: parsed.projectReferences };
}
