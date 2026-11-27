/**
 * Agent-facing command guide for the asp-typescript CLI.
 */

export function renderCodexAgentGuide(projectRoot: string): string {
  return `${commandGuide({
    ownerTarget: "<owner-path>",
    projectRoot,
  })}\n`;
}

function commandGuide(input: {
  readonly ownerTarget: string;
  readonly projectRoot: string;
}): string {
  const project = input.projectRoot === "." ? "." : input.projectRoot;
  const workspace = "--workspace <workspace-root>";
  return [
    `[asp-typescript-guide] project=${project}`,
    "|catalog search=playbook routes=search-playbook,ast-inspect,exact-source,callable-skeleton",
    "|route search-playbook returns=candidates,native-syntax,lexical-rank,graph-expansion cmd=asp search playbook --language typescript --rg -n -e <query> . --tantivy 'title:<query>^2 OR body:<query>'",
    "|route ast-inspect selectors=S:native-ast returns=locator,span,syntax-surface cmd=asp-typescript serve",
    `|route exact-source selectors=R:exact-selector returns=source cmd=asp query playbook --language typescript --selector <exact-structural-selector> --projection source ${workspace}`,
    `|route callable-skeleton selectors=R:exact-callable-selector returns=callable-skeleton cmd=asp query playbook --language typescript --selector <exact-structural-selector> --projection callable-skeleton ${workspace}`,
    "|cmd playbook=asp search playbook --language typescript --rg -n -e <query> . --tantivy 'title:<query>^2 OR body:<query>'",
    `|cmd exact-source=asp query playbook --language typescript --selector <exact-structural-selector> --projection source ${workspace}`,
    `|cmd callable-skeleton=asp query playbook --language typescript --selector <exact-structural-selector> --projection callable-skeleton ${workspace}`,
    "|cmd ast-patch=asp typescript ast-patch dry-run --packet <semantic-ast-patch.json>",
    "|policy authority=asp-typescript-api trigger=package-test",
    "|rule agent hook install/runtime is owned by asp",
    "|rule selector queries do not need a trailing project root; --workspace <workspace-root> is the independent workspace override",
    "|rule provider exposes native TypeScript compiler ast-inspect, ast-verify, and semantic-open-edb over HTTP-JSON; high-order language ontology lives in Scheme",
    "|rule exact query requires a parser-owned selector and an explicit source or callable-skeleton projection",
    "|rule the root ASP Client owns the only public search surface; provider-local search views are removed",
    "|rule displayLineRange/sourceLocatorHint are display hints; execute structural selectors or owner/symbol routes, not line ranges",
    "|rule native syntax facts remain provider-owned inputs to the root search playbook",
    "|rule use the asp typescript facade; run one command at a time; no raw TS/JS source reads",
    "|subagent give one |cmd line; require evidence/missing/next/risk",
  ].join("\n");
}
