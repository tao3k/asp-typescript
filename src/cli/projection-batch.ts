import { projectTypeScriptOwnerSource } from "../parser/native_syntax/item-query.js";
import { TYPE_SCRIPT_LANGUAGE_ID, TYPE_SCRIPT_PROVIDER_ID } from "./semantic-language.js";

const REQUEST_SCHEMA_ID = "agent.semantic-protocols.provider-language-projection-batch-request";
const RESPONSE_SCHEMA_ID = "agent.semantic-protocols.provider-language-projection-batch-response";

interface ProjectionBatchOwnerIdentity {
  readonly ownerPath: string;
  readonly sourceLeafDigest: string;
}

type ProjectionBatchOwner = ProjectionBatchOwnerIdentity &
  (
    | {
        readonly sourceEncoding: "utf8";
        readonly sourceText: string;
        readonly sourceBytesBase64?: never;
      }
    | {
        readonly sourceEncoding: "base64";
        readonly sourceText?: never;
        readonly sourceBytesBase64: string;
      }
  );

interface ProjectionBatchRequest {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly languageId: string;
  readonly providerId: string;
  readonly workspaceIdentity: string;
  readonly generationRootDigest: string;
  readonly parserIdentityDigest: string;
  readonly queryPackDigest: string;
  readonly owners: readonly ProjectionBatchOwner[];
  readonly auxiliaryOwners?: readonly ProjectionBatchOwner[];
}

export function projectProjectionBatch(requestValue: unknown): Record<string, unknown> {
  const request = validateRequest(requestValue);
  const auxiliaryOwners = request.auxiliaryOwners ?? [];
  const paths = new Set<string>();
  for (const owner of [...request.owners, ...auxiliaryOwners]) {
    validateOwner(owner);
    if (paths.has(owner.ownerPath)) {
      throw new Error(`projection batch owner path is duplicated: ${owner.ownerPath}`);
    }
    paths.add(owner.ownerPath);
  }
  const owners = request.owners.map((owner) => {
    const ownerId = `owner:${owner.ownerPath}`;
    const items = projectTypeScriptOwnerSource(owner.ownerPath, decodeOwnerText(owner)).map(
      (item) => ({
        itemId: `item:${item.kind}:${item.name}`,
        ownerId,
        kind: item.kind,
        name: item.name,
        selector: `typescript://${owner.ownerPath}#item/${item.kind}/${item.name}`,
        sourceByteStart: item.sourceByteStart,
        sourceByteEnd: item.sourceByteEnd,
        identity: {
          schemaId: "agent.semantic-protocols.canonical-language-item-identity",
          schemaVersion: "1",
          languageId: TYPE_SCRIPT_LANGUAGE_ID,
          kind: item.kind,
          symbol: item.name,
          scopes: [],
        },
        projections: [],
      }),
    );
    return {
      ownerPath: owner.ownerPath,
      sourceLeafDigest: owner.sourceLeafDigest,
      items,
      relations: items.map((item) => ({
        from: { kind: "owner", id: ownerId },
        kind: "contains",
        to: { kind: "item", id: item.itemId },
      })),
    };
  });

  return {
    schemaId: RESPONSE_SCHEMA_ID,
    schemaVersion: "1",
    languageId: TYPE_SCRIPT_LANGUAGE_ID,
    providerId: TYPE_SCRIPT_PROVIDER_ID,
    generationRootDigest: request.generationRootDigest,
    owners,
  };
}

function validateRequest(value: unknown): ProjectionBatchRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("projection batch request must be a JSON object");
  }
  const request = value as Partial<ProjectionBatchRequest>;
  if (
    request.schemaId !== REQUEST_SCHEMA_ID ||
    request.schemaVersion !== "1" ||
    request.languageId !== TYPE_SCRIPT_LANGUAGE_ID ||
    request.providerId !== TYPE_SCRIPT_PROVIDER_ID ||
    typeof request.workspaceIdentity !== "string" ||
    request.workspaceIdentity.length === 0 ||
    typeof request.generationRootDigest !== "string" ||
    request.generationRootDigest.length === 0 ||
    typeof request.parserIdentityDigest !== "string" ||
    request.parserIdentityDigest.length === 0 ||
    typeof request.queryPackDigest !== "string" ||
    request.queryPackDigest.length === 0 ||
    !Array.isArray(request.owners) ||
    request.owners.length === 0 ||
    (request.auxiliaryOwners !== undefined && !Array.isArray(request.auxiliaryOwners))
  ) {
    throw new Error("projection batch request contract mismatch");
  }
  return request as ProjectionBatchRequest;
}

function validateOwner(owner: ProjectionBatchOwner): void {
  if (
    owner === null ||
    typeof owner !== "object" ||
    typeof owner.ownerPath !== "string" ||
    owner.ownerPath.length === 0 ||
    owner.ownerPath.startsWith("/") ||
    owner.ownerPath.split("/").includes("..") ||
    typeof owner.sourceLeafDigest !== "string" ||
    owner.sourceLeafDigest.length === 0 ||
    !(
      (owner.sourceEncoding === "utf8" &&
        typeof owner.sourceText === "string" &&
        owner.sourceBytesBase64 === undefined) ||
      (owner.sourceEncoding === "base64" &&
        owner.sourceText === undefined &&
        typeof owner.sourceBytesBase64 === "string")
    )
  ) {
    throw new Error(`projection batch owner identity is invalid: ${String(owner?.ownerPath)}`);
  }
}

function decodeOwnerText(owner: ProjectionBatchOwner): string {
  if (owner.sourceEncoding === "utf8") {
    return owner.sourceText;
  }
  const bytes = Buffer.from(owner.sourceBytesBase64, "base64");
  if (bytes.toString("base64") !== owner.sourceBytesBase64) {
    throw new Error(`projection batch owner base64 is invalid: ${owner.ownerPath}`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`TypeScript projection owner is not UTF-8: ${owner.ownerPath}`, {
      cause: error,
    });
  }
}
