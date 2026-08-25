import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("TypeScript semantics stay in the parser layer", () => {
  const parserSources = sourceFiles(path.join(projectRoot, "src")).filter(isParserLayerSource);
  const parserSource = parserSources
    .map((sourcePath) => fs.readFileSync(sourcePath, "utf8"))
    .join("\n");
  const forbiddenParserEntrypoints =
    /createProgram|createSourceFile|parseJsonConfigFileContent|resolveModuleName/u;
  const forbiddenProgramDiagnostics = /getSemanticDiagnostics|getSyntacticDiagnostics/u;

  assert.match(parserSource, /from "typescript"/u);
  assert.match(parserSource, /parseJsonText/u);
  assert.doesNotMatch(parserSource, /JSON\.parse\s*\(/u);
  for (const sourcePath of sourceFiles(path.join(projectRoot, "src"))) {
    if (isParserLayerSource(sourcePath)) {
      continue;
    }
    const source = fs.readFileSync(sourcePath, "utf8");
    assert.doesNotMatch(source, /from "typescript"/u, sourcePath);
    assert.doesNotMatch(source, forbiddenParserEntrypoints, sourcePath);
    assert.doesNotMatch(source, forbiddenProgramDiagnostics, sourcePath);
  }

  const reasoningSource = sourceFiles(path.join(projectRoot, "src"))
    .filter(isReasoningLayerSource)
    .map((sourcePath) => fs.readFileSync(sourcePath, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    reasoningSource,
    /resolvePathAlias\(|resolveRelativeModule\(|resolvePackageImport\(|function importEdge\(/u,
  );
  assert.doesNotMatch(reasoningSource, /escapeRegExp|new RegExp/u);

  const rulesSource = sourceFiles(path.join(projectRoot, "src"))
    .filter(isRulesLayerSource)
    .map((sourcePath) => fs.readFileSync(sourcePath, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    rulesSource,
    /from "\.\.\/parser|from "\.\/parser|parseTypeScript(ProjectFiles|SourceFile)|readProjectResolution|projectFileNames/u,
  );
  assert.doesNotMatch(
    rulesSource,
    /resolveModuleName|resolvePathAlias|resolveRelativeModule|resolvePackageImport/u,
  );
  assert.doesNotMatch(
    rulesSource,
    /TypeScriptModuleReport|TypeScriptProjectHarnessScope|TypeScriptHarnessRunMode/u,
  );
  assert.doesNotMatch(
    rulesSource,
    /moduleReport\.diagnostics|semanticDiagnostics|packageJsonDiagnostics/u,
  );
  assert.match(rulesSource, /reasoningTree\.runMode/u);

  const verificationSource = sourceFiles(path.join(projectRoot, "src"))
    .filter(isVerificationLayerSource)
    .map((sourcePath) => fs.readFileSync(sourcePath, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    verificationSource,
    /from "\.\.\/parser|from "\.\/parser|parseTypeScript(ProjectFiles|SourceFile)|readProjectResolution|projectFileNames/u,
  );
  assert.doesNotMatch(
    verificationSource,
    /createSourceFile|parseJsonConfigFileContent|resolveModuleName/u,
  );
  assert.doesNotMatch(
    verificationSource,
    /resolvePathAlias|resolveRelativeModule|resolvePackageImport|escapeRegExp|new RegExp/u,
  );

  const renderSource =
    fs.readFileSync(path.join(projectRoot, "src", "render.ts"), "utf8") +
    fs.readFileSync(path.join(projectRoot, "src", "render", "agent-snapshot.ts"), "utf8");
  assert.doesNotMatch(renderSource, /report\.(modules|projectResolution|rootPaths)/u);
  assert.match(renderSource, /report\.reasoningTree\.projectRoot/u);
  assert.match(renderSource, /tree\.ownerBranches/u);
  assert.match(renderSource, /tree\.ownerDependencies/u);
  assert.match(renderSource, /OwnerBranches:/u);
  assert.match(renderSource, /OwnerDependencies:/u);
  assert.match(renderSource, /FindingGroups:/u);

  const modelSource = fs.readFileSync(path.join(projectRoot, "src", "model.ts"), "utf8");
  assert.match(modelSource, /report\.reasoningTree\.modules\.length/u);
  assert.match(modelSource, /report\.reasoningTree\.modules\.filter/u);
});

function isParserLayerSource(sourcePath: string): boolean {
  const relativePath = path.relative(path.join(projectRoot, "src"), sourcePath);
  return (
    relativePath === "parser.ts" ||
    relativePath.startsWith(`parser${path.sep}`) ||
    relativePath.startsWith(`syntax${path.sep}`)
  );
}

function isReasoningLayerSource(sourcePath: string): boolean {
  const relativePath = path.relative(path.join(projectRoot, "src"), sourcePath);
  return relativePath === "reasoning.ts" || relativePath.startsWith(`reasoning${path.sep}`);
}

function isRulesLayerSource(sourcePath: string): boolean {
  const relativePath = path.relative(path.join(projectRoot, "src"), sourcePath);
  return relativePath === "rules.ts" || relativePath.startsWith(`rules${path.sep}`);
}

function isVerificationLayerSource(sourcePath: string): boolean {
  const relativePath = path.relative(path.join(projectRoot, "src"), sourcePath);
  return relativePath === "verification.ts" || relativePath.startsWith(`verification${path.sep}`);
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}
