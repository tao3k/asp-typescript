import assert from "node:assert/strict";
import test from "node:test";

import { projectProjectionBatch } from "../../src/cli/projection-batch.js";
import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
} from "../../src/cli/semantic-language.js";

test("projection-batch projects canonical owner items for the resident server", () => {
  const response = projectProjectionBatch({
    schemaId: "agent.semantic-protocols.provider-language-projection-batch-request",
    schemaVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    workspaceIdentity: "workspace-test",
    generationRootDigest: "blake3-256:generation",
    parserIdentityDigest: "blake3-256:parser",
    queryPackDigest: "blake3-256:query-pack",
    owners: [
      {
        ownerPath: "src/service.ts",
        sourceLeafDigest: "blake3-256:source",
        sourceEncoding: "utf8",
        sourceText: "export interface Service { run(): void }\n",
      },
    ],
    auxiliaryOwners: [
      {
        ownerPath: "tsconfig.json",
        sourceLeafDigest: "blake3-256:config",
        sourceEncoding: "utf8",
        sourceText: "{}\n",
      },
    ],
  });
  const projected = response as {
    readonly schemaId: string;
    readonly owners: readonly [{ readonly items: readonly [{ readonly selector: string }] }];
  };
  assert.equal(
    projected.schemaId,
    "agent.semantic-protocols.provider-language-projection-batch-response",
  );
  assert.equal(
    projected.owners[0].items[0].selector,
    "typescript://src/service.ts#item/interface/Service",
  );
  assert.equal(projected.owners.length, 1);
});
