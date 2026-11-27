import ts from "typescript";

import type {
  SourceLocation,
  TypeScriptPackageExtensionConfigSource,
  TypeScriptPackageExtensionFact,
} from "../model.js";
import { locationForNode } from "./diagnostics.js";
import { packageDependencyProperty } from "./package_dependencies.js";
import {
  jsonObjectProperty,
  packageJsonProperty,
  packageJsonPropertyLocation,
} from "./package_document.js";
import type { ParsedPackageJsonDocument } from "./types.js";

const KNOWN_PACKAGE_EXTENSIONS = [
  {
    name: "effect",
    displayName: "Effect",
    packageName: "effect",
    capabilities: ["typed-async", "domain-effects", "policy"],
    configAliases: ["Effect"],
  },
  {
    name: "react",
    displayName: "React",
    packageName: "react",
    capabilities: ["components", "hooks", "compiler-readiness", "purity"],
    configAliases: ["React"],
  },
  {
    name: "shadcn",
    displayName: "shadcn/ui",
    packageName: "tailwindcss",
    capabilities: ["components", "registry", "theming", "cli"],
    configAliases: ["shadcn", "Shadcn"],
  },
] as const;

const ASP_CONFIG_SOURCE_NAMES: readonly TypeScriptPackageExtensionConfigSource[] = [
  "asp-typescript",
];

export function packageExtensionFacts(
  document: ParsedPackageJsonDocument,
): TypeScriptPackageExtensionFact[] {
  return KNOWN_PACKAGE_EXTENSIONS.flatMap((extension) => {
    const dependency = packageDependencyProperty(document, extension.packageName);
    const config = packageExtensionConfigProperty(document, [
      extension.name,
      ...extension.configAliases,
    ]);
    if (dependency === undefined && config === undefined) {
      return [];
    }
    const activation =
      config === undefined
        ? "dependency"
        : dependency === undefined
          ? "config-enabled-missing-dependency"
          : "config-enabled";
    const location =
      config === undefined
        ? (dependency?.location ?? packageJsonPropertyLocation(document, "name"))
        : config.location;
    return [
      {
        name: extension.name,
        displayName: extension.displayName,
        packageName: extension.packageName,
        activation,
        coverage: "project",
        capabilities: extension.capabilities,
        location,
        ...(dependency === undefined ? {} : { dependencySource: dependency.source }),
        ...(config === undefined ? {} : { configSource: config.source }),
      },
    ];
  });
}

function packageExtensionConfigProperty(
  document: ParsedPackageJsonDocument,
  extensionNames: readonly string[],
):
  | {
      readonly source: TypeScriptPackageExtensionConfigSource;
      readonly location: SourceLocation;
    }
  | undefined {
  for (const source of ASP_CONFIG_SOURCE_NAMES) {
    const configProperty = packageJsonProperty(document, source);
    if (configProperty === undefined || !ts.isObjectLiteralExpression(configProperty.initializer)) {
      continue;
    }
    const extensionsProperty = jsonObjectProperty(configProperty.initializer, "extensions");
    if (
      extensionsProperty === undefined ||
      !ts.isObjectLiteralExpression(extensionsProperty.initializer)
    ) {
      continue;
    }
    const extensionsConfig = extensionsProperty.initializer;
    const extensionProperty = extensionNames
      .map((extensionName) => jsonObjectProperty(extensionsConfig, extensionName))
      .find((candidate) => candidate !== undefined);
    if (extensionProperty === undefined) {
      continue;
    }
    const config = extensionConfigInfo(extensionProperty.initializer);
    if (!config.enabled) {
      continue;
    }
    return {
      source,
      location: locationForNode(document.sourceFile, extensionProperty),
    };
  }
  return undefined;
}

function extensionConfigInfo(value: ts.Expression): {
  readonly enabled: boolean;
} {
  if (value.kind === ts.SyntaxKind.TrueKeyword) {
    return { enabled: true };
  }
  if (ts.isStringLiteral(value)) {
    return {
      enabled: value.text.toLowerCase() === "enable",
    };
  }
  if (!ts.isObjectLiteralExpression(value)) {
    return { enabled: false };
  }
  const enabledProperty = jsonObjectProperty(value, "enabled");
  return {
    enabled:
      enabledProperty === undefined ? true : extensionConfigEnables(enabledProperty.initializer),
  };
}

function extensionConfigEnables(value: ts.Expression): boolean {
  if (value.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  return ts.isStringLiteral(value) && value.text.toLowerCase() === "enable";
}
