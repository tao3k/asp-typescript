import assert from "node:assert/strict";
import test from "node:test";

import {
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
} from "../../src/cli/semantic-language.js";
import { renderSemanticSearchPacket } from "../../src/cli/semantic-search/render.js";
import type { SemanticSearchPacket } from "../../src/cli/semantic-search/types.js";

test("owner items render as compact item inventory", () => {
  const packet: SemanticSearchPacket = {
    schemaId: "agent.semantic-protocols.semantic-search-packet",
    schemaVersion: "1",
    protocolId: "agent.semantic-protocols.semantic-language",
    protocolVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    method: "search/owner",
    projectRoot: ".",
    view: "owner",
    renderMode: "graph",
    header: {
      kind: "search-owner",
      fields: {
        q: "src/cli/semantic-search/item-query.ts",
        pipes: "items",
      },
    },
    nodes: [],
    edges: [
      {
        from: "O:src/cli/protocol.ts",
        kind: "import",
        to: "O:src/cli/semantic-search/item-query.ts",
      },
    ],
    owners: [
      {
        path: "src/cli/semantic-search/item-query.ts",
        role: "source",
        public: true,
        exports: ["SemanticReadPacket", "renderOwnerItemQuery"],
        fields: { imports: 3 },
      },
    ],
    items: [
      {
        name: "SemanticReadPacket",
        kind: "interface",
        ownerPath: "src/cli/semantic-search/item-query.ts",
        location: {
          path: "src/cli/semantic-search/item-query.ts",
          lineRange: "22:22",
        },
        fields: { exported: true, typeOnly: true },
      },
    ],
    hits: [],
    findings: [],
    searchSynthesis: {
      algorithm: "bounded-reachability-depth1",
      scope: "owner",
      summary: "bounded owner frontier",
    },
    nextActions: [
      {
        kind: "lexical",
        target: "SemanticReadPacket",
        ownerPath: "src/cli/semantic-search/item-query.ts",
        fields: {
          command:
            "asp-typescript search lexical --query-set SemanticReadPacket owner --workspace . --view seeds",
        },
      },
    ],
    notes: [],
  };

  const rendered = renderSemanticSearchPacket(packet);

  assert.match(
    rendered,
    /^\[search-owner\] q=src\/cli\/semantic-search\/item-query\.ts item=1 pipes=items/m,
  );
  assert.match(rendered, /^\|owner src\/cli\/semantic-search\/item-query\.ts role=source/m);
  assert.match(
    rendered,
    /^\|item interface SemanticReadPacket lineRange=22:22 exported=true typeOnly=true/m,
  );
  assert.doesNotMatch(rendered, /^\|item .* owner=src\/cli\/semantic-search\/item-query\.ts/m);
  assert.doesNotMatch(rendered, /^\|edge /m);
  assert.doesNotMatch(rendered, / edge=/);
  assert.doesNotMatch(rendered, / find=/);
  assert.doesNotMatch(rendered, /^\|synthesis /m);
  assert.doesNotMatch(rendered, /^\|next-run /m);
});

test("owner items render as graph frontier in seeds mode", () => {
  const packet: SemanticSearchPacket = {
    schemaId: "agent.semantic-protocols.semantic-search-packet",
    schemaVersion: "1",
    protocolId: "agent.semantic-protocols.semantic-language",
    protocolVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    binary: TYPE_SCRIPT_BINARY,
    namespace: TYPE_SCRIPT_PROVIDER_NAMESPACE,
    method: "search/owner",
    projectRoot: ".",
    view: "owner",
    renderMode: "seeds",
    header: {
      kind: "search-owner",
      fields: {
        q: "src/cli/semantic-search/item-query.ts",
        pipes: "items",
      },
    },
    nodes: [],
    edges: [],
    owners: [
      {
        path: "src/cli/semantic-search/item-query.ts",
        role: "source",
        public: true,
        exports: ["SemanticReadPacket"],
        fields: { imports: 3 },
      },
    ],
    items: [
      {
        name: "SemanticReadPacket",
        kind: "interface",
        ownerPath: "src/cli/semantic-search/item-query.ts",
        location: {
          path: "src/cli/semantic-search/item-query.ts",
          lineRange: "22:22",
        },
        fields: { exported: true, typeOnly: true },
      },
    ],
    hits: [],
    findings: [],
    nextActions: [],
    notes: [],
  };

  const rendered = renderSemanticSearchPacket(packet);

  assert.match(rendered, /^\[search-owner\] /m);
  assert.match(
    rendered,
    /I=item:symbol\(SemanticReadPacket\)@src\/cli\/semantic-search\/item-query\.ts:22:22!code/u,
  );
  assert.match(rendered, /frontier=I\.code/u);
  assert.doesNotMatch(rendered, /^\|item /m);
});
