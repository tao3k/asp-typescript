import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

type JsonObject = Record<string, unknown>;

function schema(name: string): JsonObject {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "schemas", name), "utf8"),
  ) as JsonObject;
}

function object(value: unknown): JsonObject {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as JsonObject;
}

test("callable skeleton schema admits the emitted root selector", () => {
  const contract = schema("callable-skeleton.schema.json");
  const properties = object(contract.properties);
  assert.deepEqual(properties.rootSelector, { type: "string", minLength: 1 });
  assert.ok((contract.required as readonly unknown[]).includes("rootSelector"));
});

test("ASP client frame clientInfo definition is concrete and reusable", () => {
  const contract = schema("asp-client-frame.schema.json");
  const clientInfo = object(object(contract.$defs).clientInfo);
  assert.equal(clientInfo.type, "object");
  assert.deepEqual(clientInfo.required, ["name", "version"]);
  assert.equal(clientInfo.$ref, undefined);
});

test("provider manifest route bindings expose no removed check command", () => {
  const contract = schema("provider-manifest.schema.json");
  const routeBindings = object(object(contract.$defs).hookRouteBindings);
  assert.equal((routeBindings.required as readonly unknown[]).includes("checkChanged"), false);
  assert.equal(object(routeBindings.properties).checkChanged, undefined);
});
