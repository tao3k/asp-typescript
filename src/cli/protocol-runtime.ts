/**
 * Runtime planning helpers for protocol command execution.
 */

import fs from "node:fs";
import path from "node:path";

import { typeScriptHarnessConfigForProject } from "../config.js";
import {
  prefilterTypeScriptSearchPaths,
  typeScriptSearchScopeFileNames,
  type TypeScriptSearchPrefilterResult,
} from "./search-prefilter.js";
import type { SearchArgs } from "./protocol.js";
import type { TypeScriptSemanticSearchView } from "./semantic-language.js";

interface SearchRunPlan {
  readonly projectRoot: string;
  readonly fileNames?: readonly string[];
  readonly prefilter?: TypeScriptSearchPrefilterResult;
}

export const SEARCH_VIEWS_REQUIRING_FULL_NATIVE_SYNTAX_FACTS =
  new Set<TypeScriptSemanticSearchView>(["owner", "api", "public-external-types"]);

export const SEARCH_VIEWS_REQUIRING_RULE_EVALUATION = new Set<TypeScriptSemanticSearchView>([
  "owner",
  "policy",
]);

export function searchRunPlan(cwd: string, args: SearchArgs): SearchRunPlan {
  const root = path.resolve(cwd, args.projectRoot ?? ".");
  const config = typeScriptHarnessConfigForProject(root);
  if (args.packagePath === undefined) {
    return prefilteredSearchRunPlan(root, args, [], config);
  }

  const scopePath = path.resolve(root, args.packagePath);
  if (!fs.existsSync(scopePath)) {
    throw new Error(`package path does not exist: ${scopePath}`);
  }
  if (fs.existsSync(path.join(scopePath, "package.json"))) {
    return prefilteredSearchRunPlan(
      scopePath,
      args,
      [],
      typeScriptHarnessConfigForProject(scopePath),
    );
  }
  return prefilteredSearchRunPlan(root, args, [scopePath], config);
}

function prefilteredSearchRunPlan(
  projectRoot: string,
  args: SearchArgs,
  scopePaths: readonly string[],
  config: ReturnType<typeof typeScriptHarnessConfigForProject>,
): SearchRunPlan {
  const queryTerms = prefilterQueryTerms(args);
  const prefilter =
    queryTerms.length === 0
      ? undefined
      : prefilterTypeScriptSearchPaths(projectRoot, queryTerms, {
          scopePaths,
          ignoredDirNames: config.ignoredDirNames,
          includeHiddenDirNames: config.includeHiddenDirNames,
          ...(args.ownerPath === undefined ? {} : { ownerPath: args.ownerPath }),
        });
  if (prefilter !== undefined) {
    return { projectRoot, fileNames: prefilter.fileNames, prefilter };
  }
  if (scopePaths.length > 0) {
    return {
      projectRoot,
      fileNames: typeScriptSearchScopeFileNames(
        scopePaths,
        config.ignoredDirNames,
        config.includeHiddenDirNames,
      ),
    };
  }
  return { projectRoot };
}

function prefilterQueryTerms(args: SearchArgs): readonly string[] {
  if (args.query === undefined || args.query.includes("::")) return [];
  switch (args.view) {
    case "api":
    case "public-external-types":
    case "import":
    case "reasoning":
      return [args.query, ...(args.dependency === undefined ? [] : [args.dependency])];
    default:
      return [];
  }
}
