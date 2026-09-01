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
  const root = workspace;
  const seeds = `${workspace} --view seeds`;
  return [
    `[asp-typescript-guide] project=${project}`,
    "|catalog reasoningProfiles=owner-query,query-deps,owner-tests,finding-frontier,feature-cfg entries=owner-query,query-deps,owner-tests routes=syntax-locate,exact-source,callable-skeleton",
    "|routing evidence-state prime=owner-map-only pipe=ambiguous-query owner=known-owner selector=exact-parser-id deps=known-dependency tests=known-owner ingest=stdin",
    `|route syntax-locate selectors=S:tree-sitter-query,Scope:owner-or-structural returns=locator,capture,frontier code=false cmd=asp typescript query --treesitter-query '(function_declaration name: (identifier) @function.name)' --selector <owner-path-or-structural-scope> ${workspace}`,
    `|route exact-source selectors=R:exact-selector returns=source cmd=asp typescript query --selector <exact-structural-selector> --projection source ${workspace}`,
    `|route callable-skeleton selectors=R:exact-callable-selector returns=callable-skeleton cmd=asp typescript query --selector <exact-structural-selector> --projection callable-skeleton ${workspace}`,
    `|cmd prime=asp typescript search prime ${seeds} condition=owner-map-unknown`,
    `|cmd pipe=asp typescript search pipe <query> ${seeds} condition=ambiguous-query`,
    `|cmd owner=asp typescript search owner ${input.ownerTarget} ${seeds}`,
    `|cmd reasoning-owner-tests=asp typescript search reasoning owner-tests --owner ${input.ownerTarget} ${seeds}`,
    `|cmd reasoning-owner-query=asp typescript search reasoning owner-query --owner ${input.ownerTarget} --query <symbol> ${seeds}`,
    `|cmd reasoning-query-deps=asp typescript search reasoning query-deps --query <symbol> --dependency <pkg> ${seeds}`,
    `|cmd syntax-locate=asp typescript query --treesitter-query '(function_declaration name: (identifier) @function.name)' --selector <owner-path-or-structural-scope> ${workspace}`,
    `|cmd exact-source=asp typescript query --selector <exact-structural-selector> --projection source ${workspace}`,
    `|cmd callable-skeleton=asp typescript query --selector <exact-structural-selector> --projection callable-skeleton ${workspace}`,
    `|cmd owner-items=asp typescript search owner ${input.ownerTarget} items --query <symbol-or-a|b|c> ${workspace}`,
    `|cmd policy=asp typescript search policy <rule-id-or-alias> owner tests ${seeds}`,
    `|cmd lexical=asp typescript search lexical --query <seed> --query <seed> owner tests ${seeds}`,
    `|cmd dependency=asp typescript search dependency <package-or-import> ${seeds}`,
    `|cmd deps=asp typescript search deps <dep[/subpath][@version][::api]> ${workspace}`,
    `|cmd env=asp typescript search env [term ...] ${seeds}`,
    `|cmd runtime-source=asp typescript search runtime-source [term ...] ${seeds}`,
    `|cmd lang=asp typescript search lang [term ...] ${seeds}`,
    `|cmd std=asp typescript search std [term ...] ${seeds}`,
    `|cmd capability=asp typescript search capability [term ...] ${seeds}`,
    `|cmd extension=asp typescript search extension <extension> [term ...] ${seeds}`,
    `|cmd pattern=asp typescript search pattern <feature-or-extension> [term ...] ${seeds}`,
    `|cmd compare=asp typescript search compare <axis> [left right] ${seeds}`,
    `|pipe <candidate-lines> | asp typescript search ingest ${root} --view seeds`,
    "|cmd ast-patch=asp typescript ast-patch dry-run --packet <semantic-ast-patch.json>",
    `|cmd evidence-graph=asp typescript evidence graph --json ${root}`,
    `|cmd evidence-analyze=asp typescript evidence analyze --json ${root}`,
    "|policy authority=typescript-lang-project-harness-api trigger=package-test",
    "|rule agent hook install/runtime is owned by asp",
    "|rule selector queries do not need a trailing project root; --workspace <workspace-root> is the independent workspace override",
    "|rule syntax query ABI is compiled by asp; provider projects native parser facts into tree-sitter-compatible captures",
    "|rule syntax predicates supported=#eq?,#any-eq?,#any-of?,#match?,#any-match?,#not-eq?,#not-match? unsupported=none unsupportedReported=true",
    "|rule exact query requires a parser-owned selector and an explicit source or callable-skeleton projection",
    "|rule search-owner is the only owner and symbol discovery surface",
    "|rule displayLineRange/sourceLocatorHint are display hints; execute structural selectors or owner/symbol routes, not line ranges",
    "|rule provider-knowledge-axes env/lang/std/pattern/runtime-source return facts or explicit frontier gaps; do not fill missing facts from memory",
    "|rule dependency search is manifest-first and import-usage backed; cache file hashes and index facts, never raw dependency source text",
    "|rule use the asp typescript facade; run one command at a time; no raw TS/JS source reads",
    "|subagent give one |cmd or |pipe line; require evidence/missing/next/risk",
  ].join("\n");
}
