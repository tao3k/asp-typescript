import assert from "node:assert/strict";
import test from "node:test";

import { decodeJsonObjectEnvelope } from "../../src/protocol/json_object_envelope.js";

test("protocol JSON object envelope accepts an object", () => {
  assert.deepEqual(
    decodeJsonObjectEnvelope<{ workspaceRoot: string }>(
      '{"workspaceRoot":"."}',
      "project-resolution request",
    ),
    { workspaceRoot: "." },
  );
});

test("protocol JSON object envelope rejects malformed JSON without fallback", () => {
  assert.throws(
    () => decodeJsonObjectEnvelope("{", "project-resolution request"),
    /project-resolution request must be valid JSON/u,
  );
});

test("protocol JSON object envelope rejects non-object JSON without coercion", () => {
  assert.throws(
    () => decodeJsonObjectEnvelope("[]", "project-resolution request"),
    /project-resolution request must be a JSON object/u,
  );
});
