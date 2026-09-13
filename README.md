# asp-typescript

Standalone project-level TypeScript ASP language provider for agent repair loops,
local checks, and CI policy gates.

The package keeps one strict boundary: TypeScript semantics come from the
TypeScript Compiler API, native `tsconfig` parsing, and parser-owned project
facts. Rule packs and search packets consume those facts instead of treating
source text as the source of truth.

## Use

```ts
import { assertAspTypeScriptClean } from "asp-typescript";

assertAspTypeScriptClean(new URL(".", import.meta.url));
```

For compact repair output:

```ts
import { renderAspTypeScriptAgentCompactText, runAspTypeScript } from "asp-typescript";

const report = runAspTypeScript(".");
console.log(renderAspTypeScriptAgentCompactText(report));
```

## CLI

The provider binary is `asp-typescript`; public discovery is owned by the root
ASP Search Playbook.

```shell
asp search playbook --language typescript --rg -n -e OrderStatus src tests --tantivy 'title:OrderStatus^2 OR body:OrderStatus'
asp query playbook --language typescript --selector '<typescript-selector>' --projection source --workspace .

asp-typescript agent doctor --json .
asp-typescript agent install --client codex .
asp-typescript agent guide --client codex .
```

`agent doctor --json` emits the semantic language registry.
Project policy is the exported ASP TypeScript API invoked by package build/test
ownership; the provider CLI does not duplicate it.
`agent install --client codex` writes `.codex/config.toml` so Codex hooks route
raw TypeScript/JavaScript source reads and broad candidate searches back through
`asp-typescript search` packets. Existing multi-language hook config is preserved:
the installer updates its own marked block or appends one when another ASP provider
already owns hooks. `agent guide --client codex` prints the command-line guide
used in hook denials; every actionable line uses the installed `asp-typescript`
binary.
The provider identity is:

```text
languageId=typescript
providerId=asp-typescript
binary=asp-typescript
namespace=agent.semantic-protocols.languages.typescript.asp-typescript
```

## Rule Packs

Default project execution evaluates:

1. `typescript.syntax`
2. `typescript.semantic`
3. `typescript.project_policy`
4. `typescript.modularity`
5. `typescript.test_layout`
6. `typescript.agent_policy`
7. `typescript.extension_policy`

Blocking rules represent broken parser/project promises. Advisory rules stay
visible to agents without failing the default gate unless the caller promotes
them or uses the explicit agent test-gate assertion.

## Validation

```shell
npm run check:implementation
npm run check:policy
npm run lint
npm run format:check
npm run test:implementation
npm run test:policy
npm run check:policy
git diff --check
```

## Documentation

Durable package material lives under [docs/](docs/index.md):

- [ASP TypeScript Boundary](docs/01_core/101_asp_typescript_boundary.md)
- [Runner Modes](docs/03_features/202_runner_modes.md)
- [CLI](docs/03_features/203_cli.md)
- [Rule Catalog](docs/03_features/201_rule_catalog.md)
- [Verification Policy](docs/03_features/205_verification_policy.md)
- [CI](docs/04_development/301_ci.md)
