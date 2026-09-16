import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultAspTypeScriptConfig } from "../config.js";
import type {
  AspTypeScriptConfig,
  AspTypeScriptReport,
  TypeScriptReasoningModule,
  TypeScriptReasoningOwnerBranchFact,
} from "../model.js";
import type {
  TypeScriptVerificationEvidence,
  TypeScriptVerificationPlan,
  TypeScriptVerificationPolicy,
  TypeScriptVerificationProfileHint,
  TypeScriptVerificationTask,
  TypeScriptVerificationTaskContract,
  TypeScriptVerificationTaskKind,
} from "./model.js";
import { runAspTypeScript } from "../runner.js";
import { typeScriptVerificationTaskFingerprint } from "./fingerprint.js";
import {
  profileEvidence,
  profileTaskReason,
  responsibilityLabels,
  taskContractForProfile,
  taskKindLabels,
  taskKindsForProfile,
} from "./profile.js";
import { verificationReportObligationsForTasks } from "./report_obligations.js";
import { resolveTypeScriptVerificationTask } from "./resolution.js";

interface VerificationTaskSpec {
  readonly kind: TypeScriptVerificationTaskKind;
  readonly packageRoot: string;
  readonly ownerPath: string;
  readonly ownerNamespace: string;
  readonly line?: number;
  readonly reason: string;
  readonly contract: TypeScriptVerificationTaskContract;
  readonly evidence: readonly TypeScriptVerificationEvidence[];
  readonly hint?: TypeScriptVerificationProfileHint;
}

export function planTypeScriptProjectVerification(
  projectRootInput: string | URL,
): TypeScriptVerificationPlan {
  return planTypeScriptProjectVerificationWithConfig(
    projectRootInput,
    defaultAspTypeScriptConfig(),
  );
}

export function planTypeScriptProjectVerificationWithConfig(
  projectRootInput: string | URL,
  config: AspTypeScriptConfig,
): TypeScriptVerificationPlan {
  const projectRoot =
    projectRootInput instanceof URL ? fileURLToPath(projectRootInput) : projectRootInput;
  if (!fs.existsSync(projectRoot)) {
    throw new Error(`project root does not exist: ${projectRoot}`);
  }
  return planTypeScriptProjectVerificationForReport(
    runAspTypeScript(projectRootInput, config),
    config.verificationPolicy,
  );
}

export function planTypeScriptProjectVerificationForReport(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
): TypeScriptVerificationPlan {
  const tasks = new Map<string, TypeScriptVerificationTask>();
  for (const hint of policy.profileHints) {
    const moduleReport = matchingHintModule(report, hint);
    if (moduleReport === undefined) {
      pushTask(tasks, newUnmatchedHintReviewTask(report, hint, policy));
      continue;
    }
    collectProfileConfigTasks(report, moduleReport, hint, policy, tasks);
    collectProfileConflictTasks(report, moduleReport, hint, policy, tasks);
    collectSkillTasksFromProfile(report, moduleReport, hint, policy, tasks);
  }
  const taskValues = [...tasks.values()].sort(
    (left, right) =>
      left.packageRoot.localeCompare(right.packageRoot) ||
      left.ownerPath.localeCompare(right.ownerPath) ||
      left.kind.localeCompare(right.kind) ||
      left.fingerprint.localeCompare(right.fingerprint),
  );
  return {
    projectRoot: report.reasoningTree.projectRoot,
    tasks: taskValues,
    skillDescriptors: activeSkillDescriptors(policy, taskValues.filter(isActiveTask)),
    reportObligations: verificationReportObligationsForTasks(taskValues),
  };
}

function collectProfileConfigTasks(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
  hint: TypeScriptVerificationProfileHint,
  policy: TypeScriptVerificationPolicy,
  tasks: Map<string, TypeScriptVerificationTask>,
): void {
  if (hint.responsibilities.length === 0) {
    pushTask(
      tasks,
      newProfileReviewTask(report, moduleReport, policy, {
        hint,
        reason: "profile hint declares no responsibilities for owner",
        evidence: [{ label: "profile", value: "responsibilities=<none>" }],
      }),
    );
  }
  if (hint.taskKinds !== undefined && hint.taskKinds.length > 0) {
    const taskKinds = taskKindsForProfile(hint, policy);
    const disabledTaskKinds = taskKinds.filter((kind) => policy.disabledTaskKinds.includes(kind));
    const rationale = hint.rationale?.trim();
    if (rationale === undefined || rationale.length === 0) {
      pushTask(
        tasks,
        newProfileReviewTask(report, moduleReport, policy, {
          hint,
          reason: "profile hint overrides task kinds without local rationale",
          evidence: [
            { label: "profile", value: `task_kinds=${taskKindLabels(taskKinds)}` },
            {
              label: "profile",
              value: `responsibilities=${responsibilityLabels(hint.responsibilities)}`,
            },
          ],
        }),
      );
    }
    if (disabledTaskKinds.length > 0) {
      pushTask(
        tasks,
        newProfileReviewTask(report, moduleReport, policy, {
          hint,
          reason: "owner-local verification override references disabled task kind",
          evidence: [
            { label: "configured", value: taskKindLabels(taskKinds) },
            { label: "disabled", value: taskKindLabels(disabledTaskKinds) },
          ],
        }),
      );
    }
  }
}

function collectProfileConflictTasks(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
  hint: TypeScriptVerificationProfileHint,
  policy: TypeScriptVerificationPolicy,
  tasks: Map<string, TypeScriptVerificationTask>,
): void {
  if (!hint.responsibilities.includes("pure_domain_logic")) {
    return;
  }
  const dependencyFacts = moduleDependencyFacts(report, moduleReport);
  if (
    dependencyFacts.ownerDeps === 0 &&
    dependencyFacts.externalImports === 0 &&
    dependencyFacts.unresolvedImports === 0
  ) {
    return;
  }
  pushTask(
    tasks,
    newProfileReviewTask(report, moduleReport, policy, {
      hint,
      reason:
        "profile declares pure domain logic but parser facts show runtime or owner dependencies",
      evidence: [
        { label: "profile", value: responsibilityLabels(hint.responsibilities) },
        {
          label: "parser",
          value: `external_imports=${dependencyFacts.externalImports} owner_deps=${dependencyFacts.ownerDeps} unresolved_imports=${dependencyFacts.unresolvedImports}`,
        },
      ],
    }),
  );
}

function collectSkillTasksFromProfile(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
  hint: TypeScriptVerificationProfileHint,
  policy: TypeScriptVerificationPolicy,
  tasks: Map<string, TypeScriptVerificationTask>,
): void {
  const taskKinds = taskKindsForProfile(hint, policy).filter(
    (kind) => kind !== "responsibility_review" && !policy.disabledTaskKinds.includes(kind),
  );
  for (const kind of taskKinds) {
    const contract = taskContractForProfile(policy, hint, kind);
    const reason = profileTaskReason(kind, hint.responsibilities, hint.taskKinds !== undefined);
    const evidence = [
      ...profileEvidence(hint),
      ...moduleEvidence(report, moduleReport),
      { label: "tasks", value: taskKindLabels(taskKinds) },
    ];
    pushTask(
      tasks,
      newTask(report, policy, {
        kind,
        packageRoot: report.reasoningTree.projectRoot,
        ownerPath: moduleReport.path,
        ownerNamespace: ownerNamespace(report, moduleReport),
        line: 1,
        reason,
        contract,
        evidence,
        hint,
      }),
    );
  }
}

function newUnmatchedHintReviewTask(
  report: AspTypeScriptReport,
  hint: TypeScriptVerificationProfileHint,
  policy: TypeScriptVerificationPolicy,
): TypeScriptVerificationTask {
  const ownerPath = normalizeHintOwnerPath(report, hint.ownerPath);
  const contract = taskContractForProfile(policy, hint, "responsibility_review");
  return newTask(report, policy, {
    kind: "responsibility_review",
    packageRoot: report.reasoningTree.projectRoot,
    ownerPath,
    ownerNamespace: "",
    reason: "profile hint target is not a parser-known TypeScript module",
    contract,
    evidence: [
      {
        label: "hint",
        value: `responsibilities=${responsibilityLabels(hint.responsibilities)}`,
      },
    ],
    hint,
  });
}

function newProfileReviewTask(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
  policy: TypeScriptVerificationPolicy,
  spec: {
    readonly hint: TypeScriptVerificationProfileHint;
    readonly reason: string;
    readonly evidence: readonly TypeScriptVerificationEvidence[];
  },
): TypeScriptVerificationTask {
  const contract = taskContractForProfile(policy, spec.hint, "responsibility_review");
  return newTask(report, policy, {
    kind: "responsibility_review",
    packageRoot: report.reasoningTree.projectRoot,
    ownerPath: moduleReport.path,
    ownerNamespace: ownerNamespace(report, moduleReport),
    line: 1,
    reason: spec.reason,
    contract,
    evidence: [...spec.evidence, ...moduleEvidence(report, moduleReport)],
    hint: spec.hint,
  });
}

function newTask(
  report: AspTypeScriptReport,
  policy: TypeScriptVerificationPolicy,
  spec: VerificationTaskSpec,
): TypeScriptVerificationTask {
  const skillBinding = configuredSkillBinding(policy, spec.kind);
  const fingerprint = typeScriptVerificationTaskFingerprint({
    kind: spec.kind,
    packageRoot: compactPath(report, spec.packageRoot),
    ownerPath: compactPath(report, spec.ownerPath),
    ownerNamespace: spec.ownerNamespace,
    reason: spec.reason,
    evidence: spec.evidence,
    requiredEvidence: spec.contract.requiredEvidence,
    ...(skillBinding === undefined ? {} : { skillBinding }),
  });
  const resolution = resolveTypeScriptVerificationTask(
    report,
    policy,
    spec.kind,
    spec.ownerPath,
    fingerprint,
  );
  const skillFields =
    skillBinding === undefined
      ? {}
      : { skillBinding, skillContractRef: skillBindingLabel(skillBinding) };
  const line = spec.line === undefined ? {} : { line: spec.line };
  const receiptSummary =
    resolution.receiptSummary === undefined ? {} : { receiptSummary: resolution.receiptSummary };
  const receiptEvidenceUri =
    resolution.receiptEvidenceUri === undefined
      ? {}
      : { receiptEvidenceUri: resolution.receiptEvidenceUri };
  const receiptObservedAt =
    resolution.receiptObservedAt === undefined
      ? {}
      : { receiptObservedAt: resolution.receiptObservedAt };
  return {
    kind: spec.kind,
    state: resolution.state,
    packageRoot: spec.packageRoot,
    ownerPath: spec.ownerPath,
    ownerNamespace: spec.ownerNamespace,
    ...line,
    reason: spec.reason,
    phase: spec.contract.phase,
    fingerprint,
    evidence: spec.evidence,
    requiredReceipt: spec.contract.requiredReceipt,
    requiredEvidence: spec.contract.requiredEvidence,
    ...skillFields,
    ...receiptSummary,
    ...receiptEvidenceUri,
    ...receiptObservedAt,
    receiptEvidence: resolution.receiptEvidence,
    resolutionNotes: resolution.notes,
  };
}

function activeSkillDescriptors(
  policy: TypeScriptVerificationPolicy,
  tasks: readonly TypeScriptVerificationTask[],
): readonly TypeScriptVerificationPolicy["skillDescriptors"][number][] {
  const labels = new Set(
    tasks.flatMap((task) =>
      task.skillBinding === undefined ? [] : [skillBindingLabel(task.skillBinding)],
    ),
  );
  return policy.skillDescriptors.filter((descriptor) => labels.has(skillBindingLabel(descriptor)));
}

function configuredSkillBinding(
  policy: TypeScriptVerificationPolicy,
  kind: TypeScriptVerificationTaskKind,
) {
  const binding = policy.skillBindings[kind];
  return binding === undefined || binding.skillId.trim().length === 0 ? undefined : binding;
}

function isActiveTask(task: TypeScriptVerificationTask): boolean {
  return task.state === "pending" || task.state === "failed";
}

function pushTask(
  tasks: Map<string, TypeScriptVerificationTask>,
  task: TypeScriptVerificationTask,
): void {
  tasks.set(`${task.ownerPath}\0${task.kind}\0${task.fingerprint}`, task);
}

function matchingHintModule(
  report: AspTypeScriptReport,
  hint: TypeScriptVerificationProfileHint,
): TypeScriptReasoningModule | undefined {
  const ownerPath = normalizeHintOwnerPath(report, hint.ownerPath);
  return report.reasoningTree.modules.find((moduleReport) => moduleReport.path === ownerPath);
}

function normalizeHintOwnerPath(report: AspTypeScriptReport, ownerPath: string): string {
  return path.isAbsolute(ownerPath)
    ? path.resolve(ownerPath)
    : path.resolve(report.reasoningTree.projectRoot, ownerPath);
}

function ownerNamespace(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
): string {
  const branch = ownerBranchForModule(report, moduleReport);
  if (branch !== undefined) {
    return branch.ownerNamespace;
  }
  const relativePath = compactPath(report, moduleReport.path);
  const extension = path.extname(relativePath);
  return extension.length === 0 ? relativePath : relativePath.slice(0, -extension.length);
}

function ownerBranchForModule(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
): TypeScriptReasoningOwnerBranchFact | undefined {
  return report.reasoningTree.ownerBranches.find((branch) => branch.path === moduleReport.path);
}

function moduleDependencyFacts(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
): {
  readonly externalImports: number;
  readonly ownerDeps: number;
  readonly unresolvedImports: number;
} {
  const branch = ownerBranchForModule(report, moduleReport);
  const externalImports = branch?.importSummary.externalImports ?? 0;
  const unresolvedImports = branch?.importSummary.unresolvedImports ?? 0;
  const ownerDeps = report.reasoningTree.ownerDependencies.filter(
    (dependency) => dependency.fromPath === moduleReport.path && !dependency.isTestContext,
  ).length;
  return { externalImports, ownerDeps, unresolvedImports };
}

function moduleEvidence(
  report: AspTypeScriptReport,
  moduleReport: TypeScriptReasoningModule,
): TypeScriptVerificationEvidence[] {
  const dependencyFacts = moduleDependencyFacts(report, moduleReport);
  return [
    { label: "module", value: `role=${moduleReport.role} layer=${moduleReport.layer}` },
    {
      label: "parser",
      value: `exports=${moduleReport.exportNames.length} imports=${moduleReport.importSpecifiers.length}`,
    },
    {
      label: "owner_deps",
      value: `external=${dependencyFacts.externalImports} local=${dependencyFacts.ownerDeps} unresolved=${dependencyFacts.unresolvedImports}`,
    },
  ];
}

function compactPath(report: AspTypeScriptReport, value: string): string {
  return path.relative(report.reasoningTree.projectRoot, value).replaceAll("\\", "/") || ".";
}

function skillBindingLabel(binding: {
  readonly skillId: string;
  readonly adapter?: string;
}): string {
  const adapter = binding.adapter?.trim();
  return adapter === undefined || adapter.length === 0
    ? binding.skillId
    : `${binding.skillId}@${adapter}`;
}
