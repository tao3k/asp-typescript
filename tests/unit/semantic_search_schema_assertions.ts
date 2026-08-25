import assert from "node:assert/strict";

import {
  TYPE_SCRIPT_BINARY,
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
  TYPE_SCRIPT_PROVIDER_NAMESPACE,
} from "../../src/cli/semantic-language.js";

type JsonObject = Record<string, unknown>;

export function assertTypeSurfaces(
  value: unknown,
  surfaceSchema: JsonObject,
  typeRefSchema: JsonObject,
  typeMemberSchema: JsonObject,
  context: string,
): void {
  assertArray(value, context, (surface, surfaceContext) =>
    assertTypeSurface(surface, surfaceSchema, typeRefSchema, typeMemberSchema, surfaceContext),
  );
}

export function assertSemanticHandles(value: unknown, schema: JsonObject, context: string): void {
  assertArray(value, context, (handle, handleContext) =>
    assertSemanticHandle(handle, schema, handleContext),
  );
}

export function assertSemanticSearchPacket(
  schema: JsonObject,
  packet: JsonObject,
  typeSurfaceSchema: JsonObject,
  semanticHandleSchema: JsonObject,
): void {
  const properties = record(schema.properties, "schema.properties");
  const required = stringArray(schema.required, "schema.required");
  const defs = record(schema.$defs, "schema.$defs");
  assertAllowedKeys(packet, Object.keys(properties), "packet");
  assertRequiredKeys(packet, required, "packet");

  assert.equal(packet.schemaId, record(properties.schemaId, "schemaId schema").const);
  assert.equal(
    packet.schemaVersion,
    record(properties.schemaVersion, "schemaVersion schema").const,
  );
  assert.equal(packet.protocolId, record(properties.protocolId, "protocolId schema").const);
  assert.equal(
    packet.protocolVersion,
    record(properties.protocolVersion, "protocolVersion schema").const,
  );
  assert.equal(packet.languageId, TYPE_SCRIPT_LANGUAGE_ID);
  assert.equal(packet.providerId, TYPE_SCRIPT_PROVIDER_ID);
  assert.equal(packet.binary, TYPE_SCRIPT_BINARY);
  assert.equal(packet.namespace, TYPE_SCRIPT_PROVIDER_NAMESPACE);
  assertString(packet.projectRoot, "packet.projectRoot");
  assertString(packet.view, "packet.view");
  assertString(packet.method, "packet.method");
  assert.equal(packet.method, `search/${String(packet.view)}`);
  assert.ok(
    stringArray(record(properties.view, "view schema").enum, "view enum").includes(
      String(packet.view),
    ),
    `packet.view ${String(packet.view)} is in schema enum`,
  );
  assert.ok(
    stringArray(
      record(properties.renderMode, "renderMode schema").enum,
      "renderMode enum",
    ).includes(String(packet.renderMode)),
    `packet.renderMode ${String(packet.renderMode)} is in schema enum`,
  );
  if (packet.packageName !== undefined) assertString(packet.packageName, "packet.packageName");
  if (packet.query !== undefined) assertString(packet.query, "packet.query");

  assertHeader(record(packet.header, "packet.header"), String(packet.view), record(defs.header));
  if (packet.inputDetection !== undefined) {
    assertInputDetection(record(packet.inputDetection), record(defs.inputDetection));
  }
  if (packet.searchSynthesis !== undefined) {
    assertSearchSynthesis(record(packet.searchSynthesis), record(defs.searchSynthesis));
  }
  if (packet.cache !== undefined) {
    assertCache(record(packet.cache), record(defs.cache));
  }
  assertArray(packet.packages, "packet.packages", (fact, context) =>
    assertFact(fact, record(defs.fact), context),
  );
  assertArray(packet.nodes, "packet.nodes", (node, context) =>
    assertNode(node, record(defs.node), context),
  );
  assertArray(packet.edges, "packet.edges", (edge, context) =>
    assertEdge(edge, record(defs.edge), context),
  );
  assertArray(packet.owners, "packet.owners", (owner, context) =>
    assertOwner(owner, record(defs.owner), context),
  );
  assertArray(packet.items, "packet.items", (item, context) =>
    assertItem(item, record(defs.item), context),
  );
  const typeSurfaceDefs = record(typeSurfaceSchema.$defs, "type surface $defs");
  assertTypeSurfaces(
    packet.typeSurfaces,
    record(typeSurfaceDefs.typeSurface, "type surface schema"),
    record(typeSurfaceDefs.typeRef, "type ref schema"),
    record(typeSurfaceDefs.typeMember, "type member schema"),
    "packet.typeSurfaces",
  );
  const handleDefs = record(semanticHandleSchema.$defs, "semantic handle $defs");
  assertSemanticHandles(
    packet.semanticHandles,
    record(handleDefs.semanticHandle, "semantic handle schema"),
    "packet.semanticHandles",
  );
  assertArray(packet.hits, "packet.hits", (hit, context) =>
    assertHit(hit, record(defs.hit), context),
  );
  assertArray(packet.findings, "packet.findings", (finding, context) =>
    assertFinding(finding, record(defs.finding), context),
  );
  assertArray(packet.nextActions, "packet.nextActions", (nextAction, context) =>
    assertNextAction(nextAction, context),
  );
  assertArray(packet.notes, "packet.notes", (note, context) =>
    assertNote(note, record(defs.note), context),
  );
}

function assertHeader(header: JsonObject, view: string, schema: JsonObject): void {
  assertSchemaObject(header, schema, "header");
  assert.equal(header.kind, `search-${view}`);
  assertFields(header.fields, "header.fields");
}

function assertInputDetection(inputDetection: JsonObject, schema: JsonObject): void {
  assertSchemaObject(inputDetection, schema, "inputDetection");
  assert.ok(
    stringArray(
      record(record(schema.properties).source).enum,
      "inputDetection source enum",
    ).includes(String(inputDetection.source)),
  );
  assertNonNegativeInteger(inputDetection.lineCount, "inputDetection.lineCount");
  assertNonNegativeInteger(inputDetection.byteCount, "inputDetection.byteCount");
  if (inputDetection.sample !== undefined) {
    assertString(inputDetection.sample, "inputDetection.sample");
  }
}

function assertSearchSynthesis(searchSynthesis: JsonObject, schema: JsonObject): void {
  assertSchemaObject(searchSynthesis, schema, "searchSynthesis");
  assertString(searchSynthesis.algorithm, "searchSynthesis.algorithm");
  assertString(searchSynthesis.scope, "searchSynthesis.scope");
  if (searchSynthesis.summary !== undefined) {
    assertString(searchSynthesis.summary, "searchSynthesis.summary");
  }
  if (searchSynthesis.ownerPath !== undefined) {
    assertString(searchSynthesis.ownerPath, "searchSynthesis.ownerPath");
  }
  if (searchSynthesis.selectedOwners !== undefined) {
    assertNonNegativeInteger(searchSynthesis.selectedOwners, "searchSynthesis.selectedOwners");
  }
  if (searchSynthesis.selectedEdges !== undefined) {
    assertNonNegativeInteger(searchSynthesis.selectedEdges, "searchSynthesis.selectedEdges");
  }
  if (searchSynthesis.incomingOwners !== undefined) {
    assertNonNegativeInteger(searchSynthesis.incomingOwners, "searchSynthesis.incomingOwners");
  }
  if (searchSynthesis.outgoingOwners !== undefined) {
    assertNonNegativeInteger(searchSynthesis.outgoingOwners, "searchSynthesis.outgoingOwners");
  }
  for (const key of [
    "highImpactOwners",
    "frontierOwners",
    "editFrontier",
    "testFrontier",
    "findingOwners",
  ]) {
    assertStringArray(searchSynthesis[key], `searchSynthesis.${key}`);
  }
  assertArray(searchSynthesis.windowSet, "searchSynthesis.windowSet", (target, context) =>
    assertWindowSetTarget(target, context),
  );
  assertArray(searchSynthesis.seeds, "searchSynthesis.seeds", (nextAction, context) =>
    assertNextAction(nextAction, context),
  );
  if (searchSynthesis.fields !== undefined) {
    assertFields(searchSynthesis.fields, "searchSynthesis.fields");
  }
}

function assertCache(cache: JsonObject, schema: JsonObject): void {
  assertSchemaObject(cache, schema, "cache");
  assertArray(cache.fileHashes, "cache.fileHashes", (fileHash, context) => {
    const entry = record(fileHash, context);
    assertString(entry.path, `${context}.path`);
    assertString(entry.sha256, `${context}.sha256`);
    assert.match(String(entry.sha256), /^[a-f0-9]{64}$/u, `${context}.sha256 must be sha256`);
  });
  if (cache.rawSourceStored !== undefined) {
    assert.equal(cache.rawSourceStored, false, "cache.rawSourceStored must be false");
  }
}

function assertStringArray(value: unknown, context: string): void {
  if (value === undefined) return;
  assert.ok(Array.isArray(value), `${context} must be an array`);
  for (const [index, item] of value.entries()) {
    assertString(item, `${context}[${index}]`);
  }
}

function assertFact(fact: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(fact, schema, context);
  assertString(fact.id, `${context}.id`);
  assertFields(fact.fields, `${context}.fields`);
}

function assertNode(node: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(node, schema, context);
  assertString(node.id, `${context}.id`);
  assert.ok(
    stringArray(record(record(schema.properties).kind).enum, "node kind enum").includes(
      String(node.kind),
    ),
  );
  if (node.path !== undefined) assertString(node.path, `${context}.path`);
  assertFields(node.fields, `${context}.fields`);
}

function assertEdge(edge: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(edge, schema, context);
  assertString(edge.from, `${context}.from`);
  assertString(edge.kind, `${context}.kind`);
  assertString(edge.to, `${context}.to`);
  if (edge.label !== undefined) assertString(edge.label, `${context}.label`);
  if (edge.location !== undefined) assertLocation(record(edge.location), `${context}.location`);
  if (edge.fields !== undefined) assertFields(edge.fields, `${context}.fields`);
}

function assertOwner(owner: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(owner, schema, context);
  assertString(owner.path, `${context}.path`);
  if (owner.namespace !== undefined) assertString(owner.namespace, `${context}.namespace`);
  assertString(owner.role, `${context}.role`);
  assert.equal(typeof owner.public, "boolean", `${context}.public must be boolean`);
  if (owner.exports !== undefined) {
    assert.ok(Array.isArray(owner.exports), `${context}.exports must be an array`);
    for (const [index, exportName] of owner.exports.entries()) {
      assertString(exportName, `${context}.exports[${index}]`);
    }
  }
  assertArray(owner.nextActions, `${context}.nextActions`, (nextAction, nextActionContext) =>
    assertNextAction(nextAction, nextActionContext),
  );
  assertFields(owner.fields, `${context}.fields`);
}

function assertItem(item: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(item, schema, context);
  assertString(item.name, `${context}.name`);
  assertString(item.kind, `${context}.kind`);
  assertString(item.ownerPath, `${context}.ownerPath`);
  if (item.location !== undefined) assertLocation(record(item.location), `${context}.location`);
  assertFields(item.fields, `${context}.fields`);
}

function assertHit(hit: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(hit, schema, context);
  assertString(hit.kind, `${context}.kind`);
  assertString(hit.ownerPath, `${context}.ownerPath`);
  if (hit.symbol !== undefined) assertString(hit.symbol, `${context}.symbol`);
  assertLocation(record(hit.location), `${context}.location`);
  assertNumber(hit.score, `${context}.score`);
  assertString(hit.reason, `${context}.reason`);
  if (hit.snippet !== undefined) assertString(hit.snippet, `${context}.snippet`);
  if (hit.fields !== undefined) assertFields(hit.fields, `${context}.fields`);
}

function assertFinding(finding: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(finding, schema, context);
  assertString(finding.ruleId, `${context}.ruleId`);
  assert.ok(["info", "warning", "error"].includes(String(finding.severity)), `${context}.severity`);
  assertPositiveInteger(finding.count, `${context}.count`);
  if (finding.title !== undefined) assertString(finding.title, `${context}.title`);
  assertLocation(record(finding.location), `${context}.location`);
  if (finding.fields !== undefined) assertFields(finding.fields, `${context}.fields`);
}

function assertNextAction(nextAction: JsonObject, context: string): void {
  assertString(nextAction.kind, `${context}.kind`);
  assertString(nextAction.target, `${context}.target`);
  if (nextAction.scope !== undefined) assertString(nextAction.scope, `${context}.scope`);
  if (nextAction.ownerPath !== undefined) {
    assertString(nextAction.ownerPath, `${context}.ownerPath`);
  }
  if (nextAction.fields !== undefined) assertFields(nextAction.fields, `${context}.fields`);
}

function assertWindowSetTarget(target: JsonObject, context: string): void {
  assertAllowedKeys(target, ["kind", "target", "query", "reason", "ownerPath", "fields"], context);
  assert.ok(["owner", "tests", "read"].includes(String(target.kind)), `${context}.kind`);
  assertString(target.target, `${context}.target`);
  if (target.query !== undefined) assertString(target.query, `${context}.query`);
  if (target.reason !== undefined) assertString(target.reason, `${context}.reason`);
  if (target.ownerPath !== undefined) assertString(target.ownerPath, `${context}.ownerPath`);
  if (target.fields !== undefined) assertFields(target.fields, `${context}.fields`);
}

function assertNote(note: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(note, schema, context);
  assertString(note.kind, `${context}.kind`);
  assertString(note.message, `${context}.message`);
  if (note.fields !== undefined) assertFields(note.fields, `${context}.fields`);
}

function assertTypeSurface(
  surface: JsonObject,
  surfaceSchema: JsonObject,
  typeRefSchema: JsonObject,
  typeMemberSchema: JsonObject,
  context: string,
): void {
  assertSchemaObject(surface, surfaceSchema, context);
  assertString(surface.id, `${context}.id`);
  assertString(surface.name, `${context}.name`);
  assertString(surface.kind, `${context}.kind`);
  assertString(surface.role, `${context}.role`);
  assertString(surface.ownerPath, `${context}.ownerPath`);
  if (surface.location !== undefined)
    assertLocation(record(surface.location), `${context}.location`);
  assertString(surface.visibility, `${context}.visibility`);
  assert.equal(typeof surface.external, "boolean", `${context}.external must be boolean`);
  if (surface.source !== undefined) assertString(surface.source, `${context}.source`);
  if (surface.package !== undefined) assertString(surface.package, `${context}.package`);
  if (surface.module !== undefined) assertString(surface.module, `${context}.module`);
  if (surface.symbol !== undefined) assertString(surface.symbol, `${context}.symbol`);
  if (surface.versionScope !== undefined)
    assertString(surface.versionScope, `${context}.versionScope`);
  if (surface.carrier !== undefined) {
    assertTypeRef(record(surface.carrier), typeRefSchema, `${context}.carrier`);
  }
  assertArray(surface.members, `${context}.members`, (member, memberContext) =>
    assertTypeMember(member, typeMemberSchema, typeRefSchema, memberContext),
  );
  assertArray(surface.relatedTypes, `${context}.relatedTypes`, (typeRef, typeRefContext) =>
    assertTypeRef(typeRef, typeRefSchema, typeRefContext),
  );
  assertFields(surface.fields, `${context}.fields`);
}

function assertTypeRef(typeRef: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(typeRef, schema, context);
  if (typeRef.name !== undefined) assertString(typeRef.name, `${context}.name`);
  if (typeRef.languageName !== undefined)
    assertString(typeRef.languageName, `${context}.languageName`);
  if (typeRef.qualifiedName !== undefined) {
    assertString(typeRef.qualifiedName, `${context}.qualifiedName`);
  }
  assertString(typeRef.carrier, `${context}.carrier`);
  if (typeRef.package !== undefined) assertString(typeRef.package, `${context}.package`);
  if (typeRef.module !== undefined) assertString(typeRef.module, `${context}.module`);
  if (typeRef.symbol !== undefined) assertString(typeRef.symbol, `${context}.symbol`);
  if (typeRef.versionScope !== undefined)
    assertString(typeRef.versionScope, `${context}.versionScope`);
  if (typeRef.external !== undefined) {
    assert.equal(typeof typeRef.external, "boolean", `${context}.external must be boolean`);
  }
  assertArray(typeRef.typeArguments, `${context}.typeArguments`, (nestedTypeRef, nestedContext) =>
    assertTypeRef(nestedTypeRef, schema, nestedContext),
  );
  if (typeRef.fields !== undefined) assertFields(typeRef.fields, `${context}.fields`);
}

function assertTypeMember(
  member: JsonObject,
  memberSchema: JsonObject,
  typeRefSchema: JsonObject,
  context: string,
): void {
  assertSchemaObject(member, memberSchema, context);
  assertString(member.name, `${context}.name`);
  assertString(member.role, `${context}.role`);
  assertTypeRef(record(member.type), typeRefSchema, `${context}.type`);
  if (member.visibility !== undefined) assertString(member.visibility, `${context}.visibility`);
  if (member.optional !== undefined) {
    assert.equal(typeof member.optional, "boolean", `${context}.optional must be boolean`);
  }
  if (member.readonly !== undefined) {
    assert.equal(typeof member.readonly, "boolean", `${context}.readonly must be boolean`);
  }
  if (member.mutable !== undefined) {
    assert.equal(typeof member.mutable, "boolean", `${context}.mutable must be boolean`);
  }
  if (member.location !== undefined) assertLocation(record(member.location), `${context}.location`);
  if (member.fields !== undefined) assertFields(member.fields, `${context}.fields`);
}

function assertSemanticHandle(value: JsonObject, schema: JsonObject, context: string): void {
  assertSchemaObject(value, schema, context);
  assertString(value.id, `${context}.id`);
  assertString(value.kind, `${context}.kind`);
  assertString(value.source, `${context}.source`);
  assertString(value.title, `${context}.title`);
  if (value.ownerPath !== undefined) assertString(value.ownerPath, `${context}.ownerPath`);
  if (value.implementationOwnerPath !== undefined) {
    assertString(value.implementationOwnerPath, `${context}.implementationOwnerPath`);
  }
  if (value.testPaths !== undefined) stringArray(value.testPaths, `${context}.testPaths`);
  assertArray(value.locations, `${context}.locations`, (location, locationContext) =>
    assertLocation(location, locationContext),
  );
  if (value.queryTerms !== undefined) stringArray(value.queryTerms, `${context}.queryTerms`);
  if (value.fields !== undefined) assertFields(value.fields, `${context}.fields`);
}

export function assertSchemaObject(value: JsonObject, schema: JsonObject, context: string): void {
  assertAllowedKeys(
    value,
    Object.keys(record(schema.properties, `${context} schema properties`)),
    context,
  );
  if (schema.required !== undefined) {
    assertRequiredKeys(value, stringArray(schema.required, `${context} schema required`), context);
  }
}

export function assertLocation(location: JsonObject, context: string): void {
  assertAllowedKeys(location, ["path", "lineRange"], context);
  assertString(location.path, `${context}.path`);
  if (location.lineRange !== undefined) {
    assertString(location.lineRange, `${context}.lineRange`);
    assert.match(String(location.lineRange), /^[1-9][0-9]*:[1-9][0-9]*$/u);
  }
}

export function assertFields(value: unknown, context: string): void {
  const fields = record(value, context);
  for (const [key, fieldValue] of Object.entries(fields)) {
    assertScalar(fieldValue, `${context}.${key}`);
  }
}

export function assertScalar(value: unknown, context: string): void {
  if (typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${context} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertScalarArrayItem(item, `${context}[${index}]`);
    }
    return;
  }
  assert.fail(`${context} must be a scalar field value`);
}

function assertScalarArrayItem(value: unknown, context: string): void {
  if (typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  assert.fail(`${context} must be a string, number, or boolean`);
}

function assertArray(
  value: unknown,
  context: string,
  itemAssertion: (item: JsonObject, context: string) => void,
): void {
  if (value === undefined) return;
  assert.ok(Array.isArray(value), `${context} must be an array`);
  for (const [index, item] of value.entries()) {
    itemAssertion(record(item, `${context}[${index}]`), `${context}[${index}]`);
  }
}

export function assertAllowedKeys(
  value: JsonObject,
  allowedKeys: readonly string[],
  context: string,
): void {
  for (const key of Object.keys(value)) {
    assert.ok(allowedKeys.includes(key), `${context} has unexpected key ${key}`);
  }
}

export function assertRequiredKeys(
  value: JsonObject,
  requiredKeys: readonly string[],
  context: string,
): void {
  for (const key of requiredKeys) {
    assert.ok(Object.hasOwn(value, key), `${context} missing required key ${key}`);
  }
}

export function assertString(value: unknown, context: string): void {
  assert.equal(typeof value, "string", `${context} must be a string`);
}

export function assertPositiveInteger(value: unknown, context: string): void {
  assert.equal(typeof value, "number", `${context} must be a number`);
  const numberValue = value as number;
  assert.ok(
    Number.isInteger(numberValue) && numberValue >= 1,
    `${context} must be an integer >= 1`,
  );
}

export function record(value: unknown, context = "value"): JsonObject {
  assert.equal(typeof value, "object", `${context} must be an object`);
  assert.notEqual(value, null, `${context} must not be null`);
  assert.equal(Array.isArray(value), false, `${context} must not be an array`);
  return value as JsonObject;
}

function assertNumber(value: unknown, context: string): void {
  assert.equal(typeof value, "number", `${context} must be a number`);
  assert.ok(Number.isFinite(value), `${context} must be finite`);
}

function assertNonNegativeInteger(value: unknown, context: string): void {
  assert.equal(typeof value, "number", `${context} must be a number`);
  const numberValue = value as number;
  assert.ok(
    Number.isInteger(numberValue) && numberValue >= 0,
    `${context} must be an integer >= 0`,
  );
}

export function stringArray(value: unknown, context: string): string[] {
  assert.ok(Array.isArray(value), `${context} must be an array`);
  for (const [index, item] of value.entries()) {
    assertString(item, `${context}[${index}]`);
  }
  return value;
}

export function array(value: unknown, context: string): unknown[] {
  assert.ok(Array.isArray(value), `${context} must be an array`);
  return value;
}
