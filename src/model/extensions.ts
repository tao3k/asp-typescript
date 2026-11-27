/**
 * Extension activation model for TypeScript project analysis.
 *
 * This module describes framework and library extension facts that enable
 * optional parser-owned policy packs.
 */
import type { SourceLocation } from "../model.js";
import type { TypeScriptPackageDependencySource } from "./package_dependencies.js";

export type TypeScriptPackageExtensionName = "effect" | "react" | "shadcn";

export type TypeScriptPackageExtensionActivation =
  | "dependency"
  | "config-enabled"
  | "config-enabled-missing-dependency";

export type TypeScriptPackageExtensionDependencySource = TypeScriptPackageDependencySource;

export type TypeScriptPackageExtensionConfigSource = "asp-typescript";

export type TypeScriptPackageExtensionCoverage = "project";

export interface TypeScriptPackageExtensionFact {
  readonly name: TypeScriptPackageExtensionName;
  readonly displayName: string;
  readonly packageName: string;
  readonly activation: TypeScriptPackageExtensionActivation;
  readonly coverage: TypeScriptPackageExtensionCoverage;
  readonly capabilities: readonly string[];
  readonly location: SourceLocation;
  readonly dependencySource?: TypeScriptPackageExtensionDependencySource;
  readonly configSource?: TypeScriptPackageExtensionConfigSource;
}
