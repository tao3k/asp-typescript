import { Buffer } from "node:buffer";

import { projectTypeScriptOwnerSource } from "../parser/native_syntax/item-query.js";
import { TYPE_SCRIPT_LANGUAGE_ID, TYPE_SCRIPT_PROVIDER_ID } from "./semantic-language.js";

interface ExactRequest {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly languageId: string;
  readonly providerId: string;
  readonly structuralSelector: string;
  readonly ownerPath: string;
  readonly projectionKind: "source" | "callable-skeleton";
  readonly sourceDigest: string;
  readonly sourceByteLength: number;
  readonly sourceEncoding: "base64";
  readonly sourceBytesBase64: string;
}

export function projectExactRequest(value: unknown): Record<string, unknown> {
  const request = validateRequest(value);
  const source = Buffer.from(request.sourceBytesBase64, "base64");
  if (
    source.length !== request.sourceByteLength ||
    source.toString("base64") !== request.sourceBytesBase64
  ) {
    throw new Error("exact request source bytes do not match their identity");
  }
  const sourceText = new TextDecoder("utf-8", { fatal: true }).decode(source);
  const item = projectTypeScriptOwnerSource(request.ownerPath, sourceText).find(
    (candidate) =>
      selector(request.ownerPath, candidate.kind, candidate.name) === request.structuralSelector,
  );
  if (item === undefined) throw new Error("exact request item is absent from the live owner");
  const response: Record<string, unknown> = {
    schemaId: "agent.semantic-protocols.provider-native-exact-projection",
    schemaVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    ownerPath: request.ownerPath,
    requestedStructuralSelector: request.structuralSelector,
    resolutionState: "resolved",
    structuralSelector: request.structuralSelector,
    projectionMode: request.projectionKind,
    normalizedParserFacts: {
      parser: "typescript-native",
      itemKind: item.kind,
      itemName: item.name,
    },
    sourceContentDigest: request.sourceDigest,
    sourceByteStart: item.sourceByteStart,
    sourceByteEnd: Math.max(item.sourceByteStart, item.sourceByteEnd - 1),
  };
  if (request.projectionKind === "source") {
    response.projectionText = source
      .subarray(item.sourceByteStart, item.sourceByteEnd)
      .toString("utf8");
  } else {
    response.projectionPayload = callableSkeleton(request.structuralSelector, item);
  }
  return response;
}

function validateRequest(value: unknown): ExactRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("exact request must be an object");
  const request = value as Partial<ExactRequest>;
  if (
    request.schemaId !== "agent.semantic-protocols.provider-native-exact-request" ||
    request.schemaVersion !== "1" ||
    request.languageId !== TYPE_SCRIPT_LANGUAGE_ID ||
    request.providerId !== TYPE_SCRIPT_PROVIDER_ID ||
    typeof request.structuralSelector !== "string" ||
    typeof request.ownerPath !== "string" ||
    !request.structuralSelector.startsWith(`typescript://${request.ownerPath}#item/`) ||
    (request.projectionKind !== "source" && request.projectionKind !== "callable-skeleton") ||
    typeof request.sourceDigest !== "string" ||
    typeof request.sourceByteLength !== "number" ||
    request.sourceEncoding !== "base64" ||
    typeof request.sourceBytesBase64 !== "string"
  )
    throw new Error("exact request contract mismatch");
  return request as ExactRequest;
}

function selector(ownerPath: string, kind: string, name: string): string {
  return `typescript://${ownerPath}#item/${kind}/${name}`;
}

function callableSkeleton(
  rootSelector: string,
  item: ReturnType<typeof projectTypeScriptOwnerSource>[number],
): Record<string, unknown> {
  const nodes = item.projectionNodes.map((node) => ({
    id: node.id,
    ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
    kind: node.kind,
    role: node.role,
    label: node.label,
    selector: `${rootSelector}/segment/${node.kind}/${node.id}`,
    flags: node.flags,
  }));
  return {
    rootSelector,
    rootNodeId: item.projectionNodes[0]?.id ?? rootSelector,
    callable: { name: item.name, kind: item.kind },
    nodes,
    relations: nodes.flatMap((node) =>
      "parentId" in node ? [{ from: node.parentId, kind: "contains", to: node.id }] : [],
    ),
    cost: { nodeCount: nodes.length, sourceBytes: item.sourceByteEnd - item.sourceByteStart },
    languageFacts: { exported: item.exported, typeOnly: item.typeOnly },
  };
}
