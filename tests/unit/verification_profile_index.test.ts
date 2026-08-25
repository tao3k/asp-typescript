import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  activeTypeScriptVerificationProfileHints,
  buildTypeScriptVerificationProfileIndexWithConfig,
  defaultTypeScriptHarnessConfig,
  renderTypeScriptVerificationProfileIndex,
  renderTypeScriptVerificationProfileIndexJson,
  runTypeScriptProjectHarness,
  typeScriptVerificationProfileIndexIsClear,
  withTypeScriptVerificationDependencySignal,
  withTypeScriptVerificationProfileHint,
  type TypeScriptVerificationProfileHint,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("verification profile index suggests missing owner hints from parser facts", () => {
  const root = writeProfileProject(
    "missing",
    'import { readFileSync } from "node:fs";\nexport const api = readFileSync;\n',
  );

  const index = buildTypeScriptVerificationProfileIndexWithConfig(
    root,
    defaultTypeScriptHarnessConfig(),
  );
  const rendered = renderTypeScriptVerificationProfileIndex(index);
  const json = JSON.parse(renderTypeScriptVerificationProfileIndexJson(index)) as {
    readonly candidates: readonly { readonly state: string }[];
  };
  const hints = activeTypeScriptVerificationProfileHints(index);

  assert.equal(typeScriptVerificationProfileIndexIsClear(index), false);
  assert.deepEqual(
    index.candidates.map((candidate) => ({
      owner: relativePath(root, candidate.ownerPath),
      state: candidate.state,
      responsibilities: candidate.suggestedResponsibilities,
      taskKinds: candidate.suggestedTaskKinds,
    })),
    [
      {
        owner: "src/index.ts",
        state: "missing_profile",
        responsibilities: ["external_dependency", "public_api"],
        taskKinds: ["chaos", "stress"],
      },
    ],
  );
  assert.match(rendered, /^\[verify-profile\] src\/index\.ts/u);
  assert.match(rendered, /\|state: missing_profile/u);
  assert.match(rendered, /\|suggest: external_dependency,public_api/u);
  assert.match(rendered, /\|tasks: chaos,stress/u);
  assert.match(rendered, /\|fact: module=role=facade layer=harness/u);
  assert.match(rendered, /\|fact: imports=external=1 package_import=0 unresolved=0/u);
  assert.match(rendered, /\|fact: external_roots=node:fs/u);
  assert.match(rendered, /\[verify-profile\] profile_hints/u);
  assert.match(rendered, /\|action: configure TypeScriptVerificationProfileHint entries/u);
  assert.deepEqual(
    json.candidates.map((candidate) => candidate.state),
    ["missing_profile"],
  );
  assert.deepEqual(hints, [
    {
      ownerPath: "src/index.ts",
      responsibilities: ["external_dependency", "public_api"],
      taskContractOverrides: {},
    },
  ]);
});

test("verification profile index renders drift and goes quiet when configured", () => {
  const root = writeProfileProject(
    "drift",
    'import { readFileSync } from "node:fs";\nexport const api = readFileSync;\n',
  );
  const partialConfig = withTypeScriptVerificationProfileHint(
    defaultTypeScriptHarnessConfig(),
    profileHint("src/index.ts", ["public_api", "security_boundary"]),
  );

  const driftIndex = buildTypeScriptVerificationProfileIndexWithConfig(root, partialConfig);
  const driftRendered = renderTypeScriptVerificationProfileIndex(driftIndex);

  assert.equal(driftIndex.candidates[0]?.state, "profile_drift");
  assert.match(driftRendered, /\|state: profile_drift/u);
  assert.match(driftRendered, /\|configured: public_api,security_boundary/u);
  assert.deepEqual(activeTypeScriptVerificationProfileHints(driftIndex), [
    {
      ownerPath: "src/index.ts",
      responsibilities: ["external_dependency", "public_api", "security_boundary"],
      taskContractOverrides: {},
    },
  ]);

  const configuredIndex = buildTypeScriptVerificationProfileIndexWithConfig(
    root,
    withTypeScriptVerificationProfileHint(
      defaultTypeScriptHarnessConfig(),
      profileHint("src/index.ts", ["external_dependency", "public_api"]),
    ),
  );

  assert.equal(configuredIndex.candidates[0]?.state, "configured");
  assert.equal(typeScriptVerificationProfileIndexIsClear(configuredIndex), true);
  assert.equal(renderTypeScriptVerificationProfileIndex(configuredIndex), "");
  assert.deepEqual(activeTypeScriptVerificationProfileHints(configuredIndex), []);
});

test("verification profile dependency signals enrich responsibility inference without findings", () => {
  const root = writeProfileProject(
    "dependency-signal",
    'import { readFileSync } from "node:fs";\nexport const api = readFileSync;\n',
  );
  const config = withTypeScriptVerificationDependencySignal(defaultTypeScriptHarnessConfig(), {
    dependency: "node:fs",
    responsibilities: ["persistence"],
  });

  const report = runTypeScriptProjectHarness(root, config);
  const index = buildTypeScriptVerificationProfileIndexWithConfig(root, config);
  const rendered = renderTypeScriptVerificationProfileIndex(index);

  assert.deepEqual(
    index.candidates.map((candidate) => ({
      responsibilities: candidate.suggestedResponsibilities,
      taskKinds: candidate.suggestedTaskKinds,
    })),
    [
      {
        responsibilities: ["external_dependency", "persistence", "public_api"],
        taskKinds: ["chaos", "stress"],
      },
    ],
  );
  assert.match(rendered, /\|fact: configured_dependency_roots=node:fs/u);
  assert.match(rendered, /\|fact: dependency_responsibilities=persistence/u);
  assert.equal(
    report.findings.some((finding) => finding.summary.includes("dependency")),
    false,
  );
});

function writeProfileProject(label: string, source: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asp-typescript-profile-index-${label}-`));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), source);
  return root;
}

function profileHint(
  ownerPath: string,
  responsibilities: TypeScriptVerificationProfileHint["responsibilities"],
): TypeScriptVerificationProfileHint {
  return {
    ownerPath,
    responsibilities,
    taskContractOverrides: {},
  };
}
