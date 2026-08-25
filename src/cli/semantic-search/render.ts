/**
 * Compact and JSON renderers for semantic-search packets.
 */

import type {
  SemanticSearchAvoidNextAction,
  SemanticSearchFieldValue,
  SemanticSearchFields,
  SemanticSearchLocation,
  SemanticSearchNextAction,
  SemanticSearchPacket,
  SemanticSearchQueryCoverage,
} from "./types.js";
import { isTestOwnerPath } from "./test-path.js";
import { ownerId } from "./utils.js";

const MAX_RENDERED_ITEMS = 16;

export function renderSemanticSearchPacketJson(packet: SemanticSearchPacket): string {
  return `${JSON.stringify(packet)}\n`;
}

export function renderSemanticSearchPacket(packet: SemanticSearchPacket): string {
  if (packet.renderMode === "seeds") {
    return renderSemanticSearchSeedPacket(packet);
  }
  if ((packet.items?.length ?? 0) > 0) {
    return renderSemanticSearchItemPacket(packet);
  }

  const lines = [`[${packet.header.kind}] ${renderFields(packet.header.fields)}`];
  const ownerByPath = new Map(packet.owners.map((owner) => [owner.path, owner]));
  for (const pkg of packet.packages ?? []) {
    lines.push(`|package ${pkg.id} ${renderFields(pkg.fields)}`.trimEnd());
  }
  for (const node of packet.nodes.filter(isPrimeAxisNode)) {
    lines.push(`|${node.kind} ${node.path ?? node.id} ${renderFields(node.fields)}`.trimEnd());
  }
  const hasItemPipe = (packet.items?.length ?? 0) > 0;
  const itemContextOwnerPath = singleOwnerContextPath(packet);
  for (const owner of packet.owners) {
    const ownerNext = hasItemPipe
      ? []
      : renderOwnerNextActions(owner.path, owner.nextActions ?? []);
    const fields: SemanticSearchFields = {
      role: owner.role,
      public: owner.public,
      exp: owner.exports?.slice(0, 8) ?? [],
      ...owner.fields,
      ...(ownerNext.length > 0 ? { next: ownerNext } : {}),
    };
    lines.push(`|owner ${owner.path} ${renderFields(fields)}`.trimEnd());
  }
  for (const item of renderedItems(packet)) {
    lines.push(renderItemLine(item, itemContextOwnerPath));
  }
  for (const handle of packet.semanticHandles ?? []) {
    lines.push(renderSemanticHandleLine(handle));
  }
  for (const hit of packet.hits) {
    const fields: SemanticSearchFields = {
      ...(hit.ownerPath === hit.location.path ? {} : { owner: hit.ownerPath }),
      kind: hit.kind,
      score: hit.score,
      reason: hit.reason,
      ...(hit.symbol ? { symbol: hit.symbol } : {}),
      ...hitEvidenceFields(packet, ownerByPath.get(hit.ownerPath)?.role, hit),
      ...hit.fields,
    };
    const lineKind = hit.kind === "api" ? "api" : "hit";
    lines.push(`|${lineKind} ${renderLocation(hit.location)} ${renderFields(fields)}`.trimEnd());
  }
  lines.push(...renderQueryCoverageLines(packet.queryCoverage ?? []));
  if (packet.view !== "workspace" && packet.view !== "prime") {
    for (const edge of packet.edges) {
      const edgeFields = compactEdgeFields(edge.fields);
      const fields = edgeFields ? ` ${renderFields(edgeFields)}` : "";
      lines.push(`|edge ${edge.from} -${edge.kind}-> ${edge.to}${fields}`.trimEnd());
    }
  }
  if (packet.view !== "workspace" && packet.view !== "prime") {
    for (const finding of packet.findings) {
      const fields: SemanticSearchFields = {
        path: finding.location.path,
        ...(finding.location.lineRange !== undefined
          ? { lineRange: finding.location.lineRange }
          : {}),
        node: ownerId(finding.location.path),
        severity: finding.severity,
      };
      lines.push(`|find ${finding.ruleId} x${finding.count} ${renderFields(fields)}`.trimEnd());
    }
  }
  const runtimeLine = renderRuntimeCostLine(packet);
  if (runtimeLine !== undefined) lines.push(runtimeLine);
  for (const note of packet.notes) {
    lines.push(`|note kind=${note.kind} message=${escapeFieldValue(note.message)}`);
  }
  if (packet.searchSynthesis !== undefined) {
    lines.push(`|synthesis ${renderSearchSynthesis(packet.searchSynthesis)}`.trimEnd());
  }
  lines.push(...renderAvoidNextActionLines(packet.avoidNextActions ?? []));
  if (packet.nextActions.length > 0) {
    lines.push(
      `|next ${packet.nextActions.map((action) => renderNextActionFragment(action)).join(",")}`,
    );
  }
  lines.push(...renderNextRunLines(packet.nextActions));
  return `${lines.join("\n")}\n`;
}

function renderSemanticSearchSeedPacket(packet: SemanticSearchPacket): string {
  return renderCompactGraphSeedPacket(packet, renderFields);
}

function renderSemanticSearchItemPacket(packet: SemanticSearchPacket): string {
  const items = renderedItems(packet);
  const headerFields: SemanticSearchFields = {
    ...(packet.header.fields.q === undefined ? {} : { q: packet.header.fields.q }),
    ...(packet.header.fields.role === undefined ? {} : { role: packet.header.fields.role }),
    ...(packet.header.fields.public === undefined ? {} : { public: packet.header.fields.public }),
    item: items.length,
    ...(packet.header.fields.pipes === undefined ? {} : { pipes: packet.header.fields.pipes }),
  };
  const lines = [`[${packet.header.kind}] ${renderFields(headerFields)}`];
  lines.push(...renderQueryCoverageLines(packet.queryCoverage ?? []));
  const itemContextOwnerPath = singleOwnerContextPath(packet);
  for (const owner of packet.owners) {
    const fields: SemanticSearchFields = {
      role: owner.role,
      public: owner.public,
      exp: owner.exports?.slice(0, 8) ?? [],
      ...owner.fields,
    };
    lines.push(`|owner ${owner.path} ${renderFields(fields)}`.trimEnd());
  }
  for (const item of items) {
    lines.push(renderItemLine(item, itemContextOwnerPath));
  }
  for (const note of packet.notes) {
    lines.push(`|note kind=${note.kind} message=${escapeFieldValue(note.message)}`);
  }
  const runtimeLine = renderRuntimeCostLine(packet);
  if (runtimeLine !== undefined) lines.push(runtimeLine);
  return `${lines.join("\n")}\n`;
}

function hitEvidenceFields(
  packet: SemanticSearchPacket,
  ownerRole: string | undefined,
  hit: SemanticSearchPacket["hits"][number],
): SemanticSearchFields {
  if (packet.view !== "lexical" && packet.view !== "ingest") {
    return {};
  }
  const surface =
    hit.surface ??
    (hit.ownerPath === "."
      ? "workspace"
      : ownerRole?.includes("test") === true || isTestOwnerPath(hit.ownerPath)
        ? "test"
        : "source");
  return {
    surface,
    ...(hit.realOwner === undefined || hit.realOwner === true ? {} : { realOwner: hit.realOwner }),
    ...(hit.fixturePath === undefined ? {} : { fixturePath: hit.fixturePath }),
    ...(hit.fixtureOwner === undefined ? {} : { fixtureOwner: hit.fixtureOwner }),
    ...(ownerRole ? { ownerRole } : {}),
    ...(hit.snippet ? { text: hit.snippet } : {}),
  };
}

function isPrimeAxisNode(node: { readonly kind: string }): boolean {
  return (
    node.kind === "tsconfig" ||
    node.kind === "extension" ||
    node.kind === "build_tool" ||
    node.kind === "test_surface"
  );
}

function renderedItems(
  packet: SemanticSearchPacket,
): readonly NonNullable<SemanticSearchPacket["items"]>[number][] {
  return (packet.items ?? []).slice(0, MAX_RENDERED_ITEMS);
}

function renderItemLine(
  item: NonNullable<SemanticSearchPacket["items"]>[number],
  contextOwnerPath?: string,
): string {
  const read = typeof item.fields.read === "string" ? item.fields.read : undefined;
  const owner =
    item.ownerPath === contextOwnerPath || read?.startsWith(`${item.ownerPath}:`)
      ? undefined
      : item.ownerPath;
  const fields: SemanticSearchFields = {
    ...(owner === undefined ? {} : { owner }),
    ...(read !== undefined || item.location?.lineRange === undefined
      ? {}
      : { lineRange: item.location.lineRange }),
    ...item.fields,
  };
  return `|item ${item.kind} ${escapeScalar(item.name)} ${renderFields(fields)}`.trimEnd();
}

function singleOwnerContextPath(packet: SemanticSearchPacket): string | undefined {
  return packet.owners.length === 1 ? packet.owners[0]?.path : undefined;
}

function renderSemanticHandleLine(
  handle: NonNullable<SemanticSearchPacket["semanticHandles"]>[number],
): string {
  const fields: SemanticSearchFields = {
    kind: handle.kind,
    source: handle.source,
    title: handle.title,
    ...(handle.ownerPath === undefined ? {} : { owner: handle.ownerPath }),
    ...(handle.implementationOwnerPath === undefined
      ? {}
      : { implementationOwner: handle.implementationOwnerPath }),
    ...(handle.testPaths === undefined ? {} : { tests: handle.testPaths }),
    ...(handle.status === undefined ? {} : { status: handle.status }),
    ...(handle.queryTerms === undefined ? {} : { query: handle.queryTerms }),
    ...handle.fields,
  };
  return `|handle ${escapeScalar(handle.id)} ${renderFields(fields)}`.trimEnd();
}

function renderSearchSynthesis(
  synthesis: NonNullable<SemanticSearchPacket["searchSynthesis"]>,
): string {
  const displayFields: Record<string, SemanticSearchFieldValue> = { ...synthesis.fields };
  delete displayFields.seeds;
  const fields: SemanticSearchFields = {
    ...(synthesis.summary === undefined ? {} : { summary: synthesis.summary }),
    algorithm: synthesis.algorithm,
    scope: synthesis.scope,
    ...(synthesis.ownerPath === undefined ? {} : { ownerPath: synthesis.ownerPath }),
    ...(synthesis.selectedOwners === undefined ? {} : { selectedOwners: synthesis.selectedOwners }),
    ...(synthesis.selectedEdges === undefined ? {} : { selectedEdges: synthesis.selectedEdges }),
    ...(synthesis.incomingOwners === undefined ? {} : { incomingOwners: synthesis.incomingOwners }),
    ...(synthesis.outgoingOwners === undefined ? {} : { outgoingOwners: synthesis.outgoingOwners }),
    ...(synthesis.highImpactOwners === undefined
      ? {}
      : { highImpactOwners: synthesis.highImpactOwners }),
    ...(synthesis.frontierOwners === undefined ? {} : { frontierOwners: synthesis.frontierOwners }),
    ...(synthesis.editFrontier === undefined ? {} : { editFrontier: synthesis.editFrontier }),
    ...(synthesis.testFrontier === undefined ? {} : { testFrontier: synthesis.testFrontier }),
    ...(synthesis.windowSet === undefined
      ? {}
      : { windowSet: synthesis.windowSet.map((target) => renderNextActionFragment(target)) }),
    ...(synthesis.findingOwners === undefined ? {} : { findingOwners: synthesis.findingOwners }),
    ...displayFields,
  };
  return renderFields(fields);
}

function renderQueryCoverageLines(
  queryCoverage: readonly SemanticSearchQueryCoverage[],
): readonly string[] {
  return queryCoverage.map((query) => {
    const fields: SemanticSearchFields = {
      status: query.status,
      hit: query.hitCount,
      selected: query.fields?.selectedHits ?? 0,
      ...(query.surfaces && query.surfaces.length > 0
        ? { surface: query.surfaces.slice(0, 4) }
        : {}),
      ...(query.ownerPaths && query.ownerPaths.length > 0
        ? { owner: query.ownerPaths.slice(0, 4) }
        : {}),
      ...(query.fixturePaths && query.fixturePaths.length > 0
        ? { fixturePath: query.fixturePaths.slice(0, 4) }
        : {}),
    };
    return `|query ${escapeScalar(query.value)} ${renderFields(fields)}`;
  });
}

function renderAvoidNextActionLines(
  avoidNextActions: readonly SemanticSearchAvoidNextAction[],
): readonly string[] {
  return avoidNextActions.map(
    (action) =>
      `|avoid ${action.kind}:${escapeScalar(action.target)} reason=${escapeScalar(action.reason)}`,
  );
}

function renderRuntimeCostLine(packet: SemanticSearchPacket): string | undefined {
  const cost = packet.runtimeCost;
  if (cost === undefined) return undefined;
  const fields: SemanticSearchFields = {
    cache: cost.cacheStatus,
    ...(cost.elapsedMs === undefined ? {} : { elapsedMs: cost.elapsedMs }),
    ...(cost.parseMs === undefined ? {} : { parseMs: cost.parseMs }),
    ...(cost.sourceFilesParsed === undefined ? {} : { sourceFilesParsed: cost.sourceFilesParsed }),
    ...(cost.packagesScanned === undefined ? {} : { packagesScanned: cost.packagesScanned }),
    ...(cost.parserFactsReused === undefined ? {} : { parserFactsReused: cost.parserFactsReused }),
    ...(cost.indexId === undefined ? {} : { indexId: cost.indexId }),
    ...(cost.reason === undefined ? {} : { reason: cost.reason }),
    ...cost.fields,
  };
  return `|runtime ${renderFields(fields)}`.trimEnd();
}

function renderFields(fields: SemanticSearchFields): string {
  return Object.entries(fields)
    .filter(([, value]) => !isEmptyFieldValue(value))
    .map(([key, value]) => `${key}=${escapeFieldValue(value)}`)
    .join(" ");
}

function compactEdgeFields(
  fields: SemanticSearchFields | undefined,
): SemanticSearchFields | undefined {
  if (fields === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) => !((key === "typeOnly" || key === "test") && value === false),
    ),
  );
}

function isEmptyFieldValue(value: SemanticSearchFieldValue): boolean {
  return Array.isArray(value) && value.length === 0;
}

function escapeFieldValue(value: SemanticSearchFieldValue): string {
  if (Array.isArray(value)) {
    return value.map((item) => escapeScalar(item)).join(",");
  }
  return escapeScalar(value as string | number | boolean);
}

function escapeScalar(value: string | number | boolean): string {
  const text = String(value);
  return /[\s,=]/u.test(text) ? JSON.stringify(text) : text;
}

function renderLocation(location: SemanticSearchLocation): string {
  const fields: Record<string, SemanticSearchFieldValue> = { path: location.path };
  if (location.lineRange !== undefined) {
    fields.lineRange = location.lineRange;
  }
  return renderFields(fields);
}

function renderOwnerNextActions(
  ownerPath: string,
  actions: readonly SemanticSearchNextAction[],
): string[] {
  return actions
    .filter((action) => action.kind !== "owner" || action.target !== ownerPath)
    .map((action) => renderNextActionFragment(action, ownerPath));
}

function renderNextRunLines(actions: readonly SemanticSearchNextAction[]): readonly string[] {
  return actions.flatMap((action) => {
    const command = action.fields?.command;
    return typeof command === "string" ? [`|next-run ${command}`] : [];
  });
}

function renderNextActionFragment(
  action: RenderableActionFragment,
  contextOwnerPath?: string,
): string {
  const suffix =
    action.ownerPath !== undefined && action.ownerPath !== contextOwnerPath
      ? `(owner=${action.ownerPath})`
      : action.scope !== undefined
        ? `(scope=${action.scope})`
        : "";
  return `${action.kind}:${escapeScalar(action.target)}${suffix}`;
}

interface RenderableActionFragment {
  readonly kind: string;
  readonly target: string;
  readonly scope?: string;
  readonly ownerPath?: string;
}
import { renderCompactGraphSeedPacket } from "./compact-graph-render.js";
