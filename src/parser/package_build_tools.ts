import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import type {
  SourceLocation,
  TypeScriptPackageBuildToolFact,
  TypeScriptPackageBuildToolName,
  TypeScriptPackageBuildToolSignalFact,
  TypeScriptPackageExtensionConfigSource,
} from "../model.js";
import { locationForNode } from "./diagnostics.js";
import { packageDependencyProperty } from "./package_dependencies.js";
import { jsonObjectProperty, packageJsonProperty } from "./package_document.js";
import type { ParsedPackageJsonDocument } from "./types.js";

interface PackageScriptLike {
  readonly name: string;
  readonly command: string;
  readonly location: SourceLocation;
}

interface BuildToolDescriptor {
  readonly name: TypeScriptPackageBuildToolName;
  readonly displayName: string;
  readonly commandTokens: readonly string[];
  readonly packageNames: readonly string[];
  readonly configFileNames: readonly string[];
  readonly configKeys: readonly string[];
  readonly capabilities: readonly string[];
}

const BUILD_TOOL_DESCRIPTORS: readonly BuildToolDescriptor[] = [
  {
    name: "rspack",
    displayName: "Rspack",
    commandTokens: ["rspack"],
    packageNames: ["@rspack/core", "@rspack/cli", "@rspack/dev-server"],
    configFileNames: [
      "rspack.config.ts",
      "rspack.config.js",
      "rspack.config.mts",
      "rspack.config.mjs",
      "rspack.config.cts",
      "rspack.config.cjs",
    ],
    configKeys: ["rspack", "Rspack"],
    capabilities: ["bundle", "dev-server", "typescript-config"],
  },
  {
    name: "rsbuild",
    displayName: "Rsbuild",
    commandTokens: ["rsbuild"],
    packageNames: ["@rsbuild/core"],
    configFileNames: [
      "rsbuild.config.ts",
      "rsbuild.config.js",
      "rsbuild.config.mts",
      "rsbuild.config.mjs",
      "rsbuild.config.cts",
      "rsbuild.config.cjs",
    ],
    configKeys: ["rsbuild", "Rsbuild"],
    capabilities: ["bundle", "dev-server", "rspack-backed"],
  },
];

const ASP_CONFIG_SOURCE_NAMES: readonly TypeScriptPackageExtensionConfigSource[] = [
  "asp-typescript",
];

export function packageBuildToolFacts(
  projectRoot: string,
  document: ParsedPackageJsonDocument,
  scripts: readonly PackageScriptLike[],
): TypeScriptPackageBuildToolFact[] {
  return BUILD_TOOL_DESCRIPTORS.flatMap((descriptor) =>
    packageBuildToolFact(projectRoot, document, scripts, descriptor),
  ).sort((left, right) => left.name.localeCompare(right.name));
}

function packageBuildToolFact(
  projectRoot: string,
  document: ParsedPackageJsonDocument,
  scripts: readonly PackageScriptLike[],
  descriptor: BuildToolDescriptor,
): TypeScriptPackageBuildToolFact[] {
  const dependencySignals = descriptor.packageNames.flatMap((packageName) => {
    const dependency = packageDependencyProperty(document, packageName);
    return dependency === undefined
      ? []
      : [
          {
            kind: "dependency" as const,
            value: packageName,
            source: dependency.source,
            location: dependency.location,
          },
        ];
  });
  const scriptSignals = scripts.flatMap((script) =>
    commandUsesBuildTool(script.command, descriptor.commandTokens)
      ? [
          {
            kind: "script" as const,
            value: script.command,
            source: script.name,
            location: script.location,
          },
        ]
      : [],
  );
  const configSignals = descriptor.configFileNames.flatMap((configFileName) => {
    const configPath = path.join(projectRoot, configFileName);
    return fs.existsSync(configPath)
      ? [
          {
            kind: "config" as const,
            value: configFileName,
            location: { path: configPath, line: 1, column: 0 },
          },
        ]
      : [];
  });
  const aspConfigSignals = descriptor.configKeys.flatMap((configKey) => {
    const config = packageBuildToolConfigProperty(document, configKey);
    return config === undefined
      ? []
      : [
          {
            kind: "asp-config" as const,
            value: configKey,
            source: config.source,
            location: config.location,
          },
        ];
  });
  const signals: readonly TypeScriptPackageBuildToolSignalFact[] = [
    ...dependencySignals,
    ...scriptSignals,
    ...configSignals,
    ...aspConfigSignals,
  ];
  const firstSignal = signals[0];
  if (firstSignal === undefined) {
    return [];
  }
  return [
    {
      name: descriptor.name,
      displayName: descriptor.displayName,
      packageNames: valuesForKind(signals, "dependency"),
      configFiles: valuesForKind(signals, "config"),
      scriptNames: sourcesForKind(signals, "script"),
      capabilities: descriptor.capabilities,
      signals,
      location: firstSignal.location,
    },
  ];
}

function packageBuildToolConfigProperty(
  document: ParsedPackageJsonDocument,
  buildToolName: string,
):
  | { readonly source: TypeScriptPackageExtensionConfigSource; readonly location: SourceLocation }
  | undefined {
  for (const source of ASP_CONFIG_SOURCE_NAMES) {
    const configProperty = packageJsonProperty(document, source);
    if (configProperty === undefined || !ts.isObjectLiteralExpression(configProperty.initializer)) {
      continue;
    }
    const buildToolsProperty = jsonObjectProperty(configProperty.initializer, "buildTools");
    if (
      buildToolsProperty === undefined ||
      !ts.isObjectLiteralExpression(buildToolsProperty.initializer)
    ) {
      continue;
    }
    const buildToolProperty = jsonObjectProperty(buildToolsProperty.initializer, buildToolName);
    if (buildToolProperty === undefined || !buildToolConfigEnables(buildToolProperty.initializer)) {
      continue;
    }
    return { source, location: locationForNode(document.sourceFile, buildToolProperty) };
  }
  return undefined;
}

function buildToolConfigEnables(value: ts.Expression): boolean {
  if (value.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  return ts.isStringLiteral(value) && value.text.toLowerCase() === "enable";
}

function commandUsesBuildTool(command: string, commandTokens: readonly string[]): boolean {
  const tokens = new Set(commandTokenParts(command));
  return commandTokens.some((commandToken) => tokens.has(commandToken));
}

function commandTokenParts(command: string): readonly string[] {
  const tokens: string[] = [];
  let current = "";
  for (const character of command) {
    if (isCommandTokenCharacter(character)) {
      current += character;
      continue;
    }
    if (current.length > 0) {
      tokens.push(current);
      current = "";
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function isCommandTokenCharacter(character: string): boolean {
  return (
    (character >= "a" && character <= "z") ||
    (character >= "A" && character <= "Z") ||
    (character >= "0" && character <= "9") ||
    character === "@" ||
    character === "." ||
    character === "_" ||
    character === "-"
  );
}

function valuesForKind(
  signals: readonly TypeScriptPackageBuildToolSignalFact[],
  kind: TypeScriptPackageBuildToolSignalFact["kind"],
): readonly string[] {
  return [
    ...new Set(signals.filter((signal) => signal.kind === kind).map((signal) => signal.value)),
  ].sort();
}

function sourcesForKind(
  signals: readonly TypeScriptPackageBuildToolSignalFact[],
  kind: TypeScriptPackageBuildToolSignalFact["kind"],
): readonly string[] {
  return [
    ...new Set(
      signals
        .filter((signal) => signal.kind === kind && signal.source !== undefined)
        .map((signal) => signal.source ?? ""),
    ),
  ].sort();
}
