/**
 * Verification policy and receipt model for ASP TypeScript checks.
 *
 * This module defines task kinds, evidence, receipts, waivers, and report
 * artifacts used to keep verification obligations parser-owned.
 */
export type TypeScriptVerificationTaskKind =
  | "stress"
  | "performance"
  | "chaos"
  | "security"
  | "regression"
  | "responsibility_review";

export type TypeScriptOwnerResponsibility =
  | "pure_domain_logic"
  | "public_api"
  | "external_dependency"
  | "persistence"
  | "security_boundary"
  | "latency_sensitive"
  | "availability_critical";

export type TypeScriptVerificationPhase =
  | "after_unit_tests_pass"
  | "before_release"
  | "scheduled_regression"
  | "before_verification";

export type TypeScriptVerificationTaskState = "pending" | "satisfied" | "failed" | "waived";

export type TypeScriptVerificationReceiptStatus = "passed" | "failed";

export interface TypeScriptVerificationEvidence {
  readonly label: string;
  readonly value: string;
}

export interface TypeScriptVerificationRequirement {
  readonly key: string;
  readonly description: string;
}

export interface TypeScriptVerificationTaskContract {
  readonly phase: TypeScriptVerificationPhase;
  readonly requiredReceipt: string;
  readonly requiredEvidence: readonly TypeScriptVerificationRequirement[];
}

export interface TypeScriptVerificationSkillBinding {
  readonly skillId: string;
  readonly adapter?: string;
}

export interface TypeScriptVerificationSkillDescriptor {
  readonly skillId: string;
  readonly adapter?: string;
  readonly tool: string;
  readonly command: string;
  readonly standard: string;
  readonly requiredInputs: readonly string[];
  readonly passCriteria: readonly string[];
  readonly receiptFields: readonly string[];
}

export interface TypeScriptVerificationProfileHint {
  readonly ownerPath: string;
  readonly responsibilities: readonly TypeScriptOwnerResponsibility[];
  readonly taskKinds?: readonly TypeScriptVerificationTaskKind[];
  readonly taskContractOverrides: Readonly<
    Partial<Record<TypeScriptVerificationTaskKind, TypeScriptVerificationTaskContract>>
  >;
  readonly rationale?: string;
}

export interface TypeScriptVerificationReceipt {
  readonly kind: TypeScriptVerificationTaskKind;
  readonly ownerPath: string;
  readonly fingerprint: string;
  readonly status: TypeScriptVerificationReceiptStatus;
  readonly summary?: string;
  readonly evidenceUri?: string;
  readonly observedAt?: string;
  readonly evidence: readonly TypeScriptVerificationEvidence[];
}

export interface TypeScriptVerificationWaiver {
  readonly kind: TypeScriptVerificationTaskKind;
  readonly ownerPath: string;
  readonly fingerprint: string;
  readonly owner?: string;
  readonly reason?: string;
  readonly expiresAt?: string;
}

export interface TypeScriptVerificationResolutionNote {
  readonly label: string;
  readonly detail: string;
}

export interface TypeScriptVerificationDependencySignal {
  readonly dependency: string;
  readonly responsibilities: readonly TypeScriptOwnerResponsibility[];
}

export interface TypeScriptVerificationPolicy {
  readonly profileHints: readonly TypeScriptVerificationProfileHint[];
  readonly receipts: readonly TypeScriptVerificationReceipt[];
  readonly waivers: readonly TypeScriptVerificationWaiver[];
  readonly disabledTaskKinds: readonly TypeScriptVerificationTaskKind[];
  readonly responsibilityTaskOverrides: Readonly<
    Partial<Record<TypeScriptOwnerResponsibility, readonly TypeScriptVerificationTaskKind[]>>
  >;
  readonly taskContractOverrides: Readonly<
    Partial<Record<TypeScriptVerificationTaskKind, TypeScriptVerificationTaskContract>>
  >;
  readonly skillBindings: Readonly<
    Partial<Record<TypeScriptVerificationTaskKind, TypeScriptVerificationSkillBinding>>
  >;
  readonly skillDescriptors: readonly TypeScriptVerificationSkillDescriptor[];
  readonly dependencySignals: readonly TypeScriptVerificationDependencySignal[];
}

export interface TypeScriptVerificationTask {
  readonly kind: TypeScriptVerificationTaskKind;
  readonly state: TypeScriptVerificationTaskState;
  readonly packageRoot: string;
  readonly ownerPath: string;
  readonly ownerNamespace: string;
  readonly line?: number;
  readonly reason: string;
  readonly phase: TypeScriptVerificationPhase;
  readonly fingerprint: string;
  readonly evidence: readonly TypeScriptVerificationEvidence[];
  readonly requiredReceipt: string;
  readonly requiredEvidence: readonly TypeScriptVerificationRequirement[];
  readonly skillBinding?: TypeScriptVerificationSkillBinding;
  readonly skillContractRef?: string;
  readonly receiptSummary?: string;
  readonly receiptEvidenceUri?: string;
  readonly receiptObservedAt?: string;
  readonly receiptEvidence: readonly TypeScriptVerificationEvidence[];
  readonly resolutionNotes: readonly TypeScriptVerificationResolutionNote[];
}

export interface TypeScriptVerificationReportObligation {
  readonly key: string;
  readonly renderer: string;
  readonly suggestedArtifactName: string;
  readonly reason: string;
  readonly taskKinds: readonly TypeScriptVerificationTaskKind[];
  readonly taskFingerprints: readonly string[];
}

export interface TypeScriptVerificationPlan {
  readonly projectRoot: string;
  readonly tasks: readonly TypeScriptVerificationTask[];
  readonly skillDescriptors: readonly TypeScriptVerificationSkillDescriptor[];
  readonly reportObligations: readonly TypeScriptVerificationReportObligation[];
}

export type TypeScriptVerificationProfileCandidateState =
  | "missing_profile"
  | "profile_drift"
  | "configured";

export interface TypeScriptVerificationProfileCandidate {
  readonly packageRoot: string;
  readonly ownerPath: string;
  readonly hintPath: string;
  readonly ownerNamespace: string;
  readonly state: TypeScriptVerificationProfileCandidateState;
  readonly suggestedResponsibilities: readonly TypeScriptOwnerResponsibility[];
  readonly configuredResponsibilities: readonly TypeScriptOwnerResponsibility[];
  readonly suggestedTaskKinds: readonly TypeScriptVerificationTaskKind[];
  readonly evidence: readonly TypeScriptVerificationEvidence[];
}

export interface TypeScriptVerificationProfileIndex {
  readonly projectRoot: string;
  readonly candidates: readonly TypeScriptVerificationProfileCandidate[];
}

export interface TypeScriptVerificationTaskRecord {
  readonly fingerprint: string;
  readonly kind: TypeScriptVerificationTaskKind;
  readonly state: TypeScriptVerificationTaskState;
  readonly phase: TypeScriptVerificationPhase;
  readonly packageRoot: string;
  readonly ownerPath: string;
  readonly ownerNamespace: string;
  readonly line?: number;
  readonly skill?: string;
  readonly contractRef?: string;
  readonly requiredEvidenceKeys: readonly string[];
  readonly taskEvidence: readonly TypeScriptVerificationEvidence[];
  readonly receiptSummary?: string;
  readonly receiptEvidenceUri?: string;
  readonly receiptObservedAt?: string;
  readonly receiptEvidence: readonly TypeScriptVerificationEvidence[];
  readonly missingReceiptEvidenceKeys: readonly string[];
}

export interface TypeScriptVerificationTaskIndex {
  readonly projectRoot: string;
  readonly records: readonly TypeScriptVerificationTaskRecord[];
}

export interface TypeScriptVerificationPerformanceRecord {
  readonly fingerprint: string;
  readonly state: TypeScriptVerificationTaskState;
  readonly phase: TypeScriptVerificationPhase;
  readonly packageRoot: string;
  readonly ownerPath: string;
  readonly ownerNamespace: string;
  readonly skill?: string;
  readonly contractRef?: string;
  readonly requiredEvidenceKeys: readonly string[];
  readonly taskEvidence: readonly TypeScriptVerificationEvidence[];
  readonly receiptSummary?: string;
  readonly receiptEvidenceUri?: string;
  readonly receiptObservedAt?: string;
  readonly receiptEvidence: readonly TypeScriptVerificationEvidence[];
}

export interface TypeScriptVerificationPerformanceIndex {
  readonly projectRoot: string;
  readonly records: readonly TypeScriptVerificationPerformanceRecord[];
}

export type TypeScriptVerificationReportPersistence = "runtime_cache" | "source_baseline";

export interface TypeScriptVerificationReportTraceConfig {
  readonly profile: string;
  readonly maxSeconds?: number;
  readonly sampleIntervalMs?: number;
  readonly includeRawTraces: boolean;
}

export interface TypeScriptVerificationReportTemplate {
  readonly templateId: string;
  readonly schemaVersion: string;
  readonly requiredSections: readonly string[];
}

export interface TypeScriptVerificationReportOptions {
  readonly defaultTrace?: TypeScriptVerificationReportTraceConfig;
  readonly artifactTraces: Readonly<Record<string, TypeScriptVerificationReportTraceConfig>>;
  readonly artifactTemplates: Readonly<Record<string, TypeScriptVerificationReportTemplate>>;
  readonly artifactPersistence: Readonly<Record<string, TypeScriptVerificationReportPersistence>>;
}

export interface TypeScriptVerificationReportArtifact {
  readonly key: string;
  readonly artifactName: string;
  readonly renderer: string;
  readonly reason: string;
  readonly taskKinds: readonly TypeScriptVerificationTaskKind[];
  readonly taskFingerprints: readonly string[];
  readonly persistence: TypeScriptVerificationReportPersistence;
  readonly template?: TypeScriptVerificationReportTemplate;
  readonly trace?: TypeScriptVerificationReportTraceConfig;
}

export interface TypeScriptVerificationReportBundle {
  readonly projectRoot: string;
  readonly artifacts: readonly TypeScriptVerificationReportArtifact[];
}

export interface TypeScriptVerificationReportWriteConfig {
  readonly projectRoot: string;
  readonly sourceBaselineDir: string;
  readonly runtimeCacheDir: string;
  readonly projectRootPlaceholder?: string;
}

export interface TypeScriptVerificationReportWriteReceipt {
  readonly sourceBaselinePaths: readonly string[];
  readonly runtimeCachePaths: readonly string[];
}
