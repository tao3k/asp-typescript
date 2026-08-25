import assert from "node:assert/strict";
import test from "node:test";

import { semanticLanguageRegistryDocument } from "../../src/cli/semantic-language.js";

test("registry replaces direct-source-read with the canonical exact-selector query", () => {
  const registry = semanticLanguageRegistryDocument();
  const language = registry.languages.find((candidate) => candidate.languageId === "typescript");
  assert.ok(language, "typescript language registration should exist");
  assert.ok(!language.methods.includes("query/direct-source-read"));
  assert.ok(!language.methods.includes("query/owner-items"));

  const descriptor = language.methodDescriptors.find((candidate) => candidate.method === "query");
  assert.ok(descriptor, "canonical query descriptor should exist");
  assert.equal(descriptor.command, "query");
  assert.ok(!descriptor.outputModes?.includes("code"));
  assert.equal("codeOutput" in descriptor, false);
  assert.equal(descriptor.supportsJson, true);
});
