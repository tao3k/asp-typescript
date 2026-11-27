import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function aspRulesPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(moduleDir, "asp-rules.md"),
    path.join(moduleDir, "..", "..", "src", "rules", "asp-rules.md"),
    path.join(moduleDir, "..", "..", "..", "src", "rules", "asp-rules.md"),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (existing === undefined) {
    throw new Error("Unable to locate embedded ASP TypeScript rules markdown");
  }
  return existing;
}

export function aspTypeScriptRulesMarkdown(): string {
  return fs.readFileSync(aspRulesPath(), "utf8");
}

export function renderAspTypeScriptRulesMarkdown(): string {
  const output = [
    "# asp-typescript",
    "",
    "## ASP TypeScript Rules",
    "",
    "Generated from embedded `src/rules/asp-rules.md`.",
    "",
  ];
  for (const line of aspTypeScriptRulesMarkdown().split(/\r?\n/)) {
    if (!line.startsWith("- ")) continue;
    const item = line.slice(2);
    const separator = item.indexOf(": ");
    if (separator === -1) continue;
    output.push(`- **${item.slice(0, separator)}**: ${item.slice(separator + 2)}`);
  }
  return `${output.join("\n")}\n`;
}

export function writeAspTypeScriptRulesToUnitTests(unitTestDir: string): string {
  const outputPath = path.join(unitTestDir, "asp-rules.generated.md");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderAspTypeScriptRulesMarkdown(), "utf8");
  return outputPath;
}
