import path from "node:path";

import type { AspTypeScriptReport } from "../model.js";
import type {
  TypeScriptVerificationEvidence,
  TypeScriptVerificationPolicy,
  TypeScriptVerificationReceipt,
  TypeScriptVerificationResolutionNote,
  TypeScriptVerificationTaskKind,
  TypeScriptVerificationTaskState,
  TypeScriptVerificationWaiver,
} from "./model.js";

export function resolveTypeScriptVerificationTask(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
  kind: TypeScriptVerificationTaskKind,
  ownerPath: string,
  fingerprint: string,
): {
  readonly state: TypeScriptVerificationTaskState;
  readonly receiptSummary?: string;
  readonly receiptEvidenceUri?: string;
  readonly receiptObservedAt?: string;
  readonly receiptEvidence: readonly TypeScriptVerificationEvidence[];
  readonly notes: readonly TypeScriptVerificationResolutionNote[];
} {
  const receipt = matchingReceipt(report, policy.receipts, kind, ownerPath, fingerprint);
  if (receipt !== undefined) {
    const receiptSummary = receipt.summary ?? `${kind}=${receipt.status}`;
    if (receipt.status === "passed") {
      return {
        state: "satisfied",
        receiptSummary,
        ...(receipt.evidenceUri === undefined ? {} : { receiptEvidenceUri: receipt.evidenceUri }),
        ...(receipt.observedAt === undefined ? {} : { receiptObservedAt: receipt.observedAt }),
        receiptEvidence: receipt.evidence,
        notes: [],
      };
    }
    return {
      state: "failed",
      receiptSummary,
      ...(receipt.evidenceUri === undefined ? {} : { receiptEvidenceUri: receipt.evidenceUri }),
      ...(receipt.observedAt === undefined ? {} : { receiptObservedAt: receipt.observedAt }),
      receiptEvidence: receipt.evidence,
      notes: [],
    };
  }
  const waiver = matchingWaiver(report, policy.waivers, kind, ownerPath, fingerprint);
  if (waiver !== undefined) {
    const missingFields = waiverMissingFields(waiver);
    if (missingFields.length === 0) {
      return {
        state: "waived",
        receiptEvidence: [],
        notes: [{ label: "waiver", detail: waiver.reason ?? "waived" }],
      };
    }
    return {
      state: "pending",
      receiptEvidence: [],
      notes: [{ label: "waiver", detail: `incomplete: missing ${missingFields.join(", ")}` }],
    };
  }
  return { state: "pending", receiptEvidence: [], notes: [] };
}

function matchingReceipt(
  report: AspTypeScriptReport,
  receipts: readonly TypeScriptVerificationReceipt[],
  kind: TypeScriptVerificationTaskKind,
  ownerPath: string,
  fingerprint: string,
): TypeScriptVerificationReceipt | undefined {
  return receipts.find(
    (receipt) =>
      receipt.kind === kind &&
      receipt.fingerprint === fingerprint &&
      normalizeHintOwnerPath(report, receipt.ownerPath) === ownerPath,
  );
}

function matchingWaiver(
  report: AspTypeScriptReport,
  waivers: readonly TypeScriptVerificationWaiver[],
  kind: TypeScriptVerificationTaskKind,
  ownerPath: string,
  fingerprint: string,
): TypeScriptVerificationWaiver | undefined {
  return waivers.find(
    (waiver) =>
      waiver.kind === kind &&
      waiver.fingerprint === fingerprint &&
      normalizeHintOwnerPath(report, waiver.ownerPath) === ownerPath,
  );
}

function waiverMissingFields(waiver: TypeScriptVerificationWaiver): readonly string[] {
  return [
    waiver.owner?.trim() ? undefined : "owner",
    waiver.reason?.trim() ? undefined : "reason",
    waiver.expiresAt?.trim() ? undefined : "expiresAt",
  ].filter((field): field is string => field !== undefined);
}

function normalizeHintOwnerPath(report: AspTypeScriptReport, ownerPath: string): string {
  return path.isAbsolute(ownerPath)
    ? path.resolve(ownerPath)
    : path.resolve(report.reasoningTree.projectRoot, ownerPath);
}
