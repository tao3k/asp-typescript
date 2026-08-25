import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultTypeScriptHarnessConfig,
  planTypeScriptProjectVerificationWithConfig,
  renderTypeScriptVerificationPlan,
  renderTypeScriptVerificationPlanJson,
  renderTypeScriptVerificationSkillContracts,
  withDisabledTypeScriptVerificationTaskKind,
  withTypeScriptVerificationProfileHint,
  withTypeScriptVerificationReceipt,
  withTypeScriptVerificationSkillBinding,
  withTypeScriptVerificationSkillDescriptor,
  withTypeScriptVerificationWaiver,
  type TypeScriptVerificationProfileHint,
  type TypeScriptVerificationSkillDescriptor,
} from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("verification policy plans compact external-skill tasks from profile hints", () => {
  const root = writeVerificationProject("profile-plan", "export const api = 1;\n");
  const config = withTypeScriptVerificationProfileHint(
    defaultTypeScriptHarnessConfig(),
    profileHint("src/index.ts", ["public_api", "latency_sensitive"]),
  );

  const plan = planTypeScriptProjectVerificationWithConfig(root, config);
  const rendered = renderTypeScriptVerificationPlan(plan);
  const json = JSON.parse(renderTypeScriptVerificationPlanJson(plan)) as {
    readonly tasks: readonly { readonly kind: string; readonly fingerprint: string }[];
  };

  assert.deepEqual(
    plan.tasks.map((task) => `${task.kind}:${task.state}:${relativePath(root, task.ownerPath)}`),
    ["performance:pending:src/index.ts", "stress:pending:src/index.ts"],
  );
  assert.match(rendered, /^\[verify\] src\/index\.ts/u);
  assert.match(rendered, /\|owner: src/u);
  assert.match(rendered, /\|performance: pending phase=after_unit_tests_pass fingerprint=tsv:/u);
  assert.match(rendered, /\|stress: pending phase=after_unit_tests_pass fingerprint=tsv:/u);
  assert.match(rendered, /\|fact: stress.profile=latency_sensitive,public_api/u);
  assert.deepEqual(
    json.tasks.map((task) => task.kind),
    ["performance", "stress"],
  );
  assert.ok(json.tasks.every((task) => task.fingerprint.startsWith("tsv:")));
});

test("verification policy emits responsibility review when hints drift from parser facts", () => {
  const root = writeVerificationProject(
    "profile-drift",
    'import fs from "node:fs";\nexport const read = fs.readFileSync;\n',
  );
  const config = withTypeScriptVerificationProfileHint(
    defaultTypeScriptHarnessConfig(),
    profileHint("src/index.ts", ["pure_domain_logic"]),
  );

  const plan = planTypeScriptProjectVerificationWithConfig(root, config);
  const rendered = renderTypeScriptVerificationPlan(plan);

  assert.deepEqual(
    plan.tasks.map((task) => `${task.kind}:${task.state}`),
    ["responsibility_review:pending"],
  );
  assert.match(rendered, /\|responsibility_review: pending/u);
  assert.match(rendered, /profile declares pure domain logic/u);
  assert.match(rendered, /\|fact: responsibility_review.parser=/u);
});

test("verification receipts and waivers control active compact reminders", () => {
  const root = writeVerificationProject("receipt-waiver", "export const api = 1;\n");
  const baseConfig = withTypeScriptVerificationProfileHint(
    defaultTypeScriptHarnessConfig(),
    profileHint("src/index.ts", ["public_api"]),
  );
  const initialPlan = planTypeScriptProjectVerificationWithConfig(root, baseConfig);
  const stressTask = initialPlan.tasks.find((task) => task.kind === "stress");
  assert.ok(stressTask);

  const receiptConfig = withTypeScriptVerificationReceipt(baseConfig, {
    kind: "stress",
    ownerPath: "src/index.ts",
    fingerprint: stressTask.fingerprint,
    status: "passed",
    summary: "stress=sla held",
    evidence: [{ label: "sla_result", value: "pass" }],
  });
  const receiptPlan = planTypeScriptProjectVerificationWithConfig(root, receiptConfig);
  assert.equal(receiptPlan.tasks[0]?.state, "satisfied");
  assert.equal(renderTypeScriptVerificationPlan(receiptPlan), "");

  const incompleteWaiverConfig = withTypeScriptVerificationWaiver(baseConfig, {
    kind: "stress",
    ownerPath: "src/index.ts",
    fingerprint: stressTask.fingerprint,
    owner: "platform",
    reason: "temporary upstream outage",
  });
  const waiverPlan = planTypeScriptProjectVerificationWithConfig(root, incompleteWaiverConfig);
  const waiverRendered = renderTypeScriptVerificationPlan(waiverPlan);
  assert.equal(waiverPlan.tasks[0]?.state, "pending");
  assert.match(waiverRendered, /resolution: stress\.waiver=incomplete: missing expiresAt/u);

  const completeWaiverConfig = withTypeScriptVerificationWaiver(baseConfig, {
    kind: "stress",
    ownerPath: "src/index.ts",
    fingerprint: stressTask.fingerprint,
    owner: "platform",
    reason: "accepted for bootstrap",
    expiresAt: "2026-06-01",
  });
  const completeWaiverPlan = planTypeScriptProjectVerificationWithConfig(
    root,
    completeWaiverConfig,
  );
  assert.equal(completeWaiverPlan.tasks[0]?.state, "waived");
  assert.equal(renderTypeScriptVerificationPlan(completeWaiverPlan), "");
});

test("verification policy disables external task kinds but reviews owner-local disabled overrides", () => {
  const root = writeVerificationProject("disabled-kind", "export const api = 1;\n");
  const disabledConfig = withDisabledTypeScriptVerificationTaskKind(
    withTypeScriptVerificationProfileHint(
      defaultTypeScriptHarnessConfig(),
      profileHint("src/index.ts", ["latency_sensitive"]),
    ),
    "performance",
  );

  const disabledPlan = planTypeScriptProjectVerificationWithConfig(root, disabledConfig);
  assert.deepEqual(disabledPlan.tasks, []);

  const ownerOverrideConfig = withDisabledTypeScriptVerificationTaskKind(
    withTypeScriptVerificationProfileHint(defaultTypeScriptHarnessConfig(), {
      ownerPath: "src/index.ts",
      responsibilities: ["public_api"],
      taskKinds: ["performance"],
      taskContractOverrides: {},
      rationale: "bootstrap local performance task migration",
    }),
    "performance",
  );
  const ownerOverridePlan = planTypeScriptProjectVerificationWithConfig(root, ownerOverrideConfig);
  const rendered = renderTypeScriptVerificationPlan(ownerOverridePlan);

  assert.deepEqual(
    ownerOverridePlan.tasks.map((task) => `${task.kind}:${task.state}`),
    ["responsibility_review:pending"],
  );
  assert.match(rendered, /owner-local verification override references disabled task kind/u);
  assert.match(rendered, /\|fact: responsibility_review\.disabled=performance/u);
});

test("configured verification skill binding keeps compact output quiet and expandable", () => {
  const root = writeVerificationProject("skill-binding", "export const api = 1;\n");
  const config = withTypeScriptVerificationSkillDescriptor(
    withTypeScriptVerificationSkillBinding(
      withTypeScriptVerificationProfileHint(
        defaultTypeScriptHarnessConfig(),
        profileHint("src/index.ts", ["latency_sensitive"]),
      ),
      "performance",
      { skillId: "typescript-verification-performance", adapter: "vitest-bench" },
    ),
    performanceDescriptor(),
  );

  const plan = planTypeScriptProjectVerificationWithConfig(root, config);
  const rendered = renderTypeScriptVerificationPlan(plan);
  const contracts = renderTypeScriptVerificationSkillContracts(plan);

  assert.match(rendered, /skill=typescript-verification-performance@vitest-bench/u);
  assert.match(rendered, /contract_ref=typescript-verification-performance@vitest-bench/u);
  assert.doesNotMatch(rendered, /\|why: performance=/u);
  assert.match(contracts, /^\[skill-contract\] typescript-verification-performance@vitest-bench/u);
  assert.match(contracts, /\|run: npm run test:perf/u);
  assert.match(contracts, /\|receipt: benchmark_command,baseline,regression_threshold/u);

  const performanceTask = plan.tasks.find((task) => task.kind === "performance");
  assert.ok(performanceTask);
  const satisfiedConfig = withTypeScriptVerificationReceipt(config, {
    kind: "performance",
    ownerPath: "src/index.ts",
    fingerprint: performanceTask.fingerprint,
    status: "passed",
    evidence: [{ label: "regression_threshold", value: "held" }],
  });
  const satisfiedPlan = planTypeScriptProjectVerificationWithConfig(root, satisfiedConfig);
  assert.equal(renderTypeScriptVerificationPlan(satisfiedPlan), "");
  assert.equal(renderTypeScriptVerificationSkillContracts(satisfiedPlan), "");
});

function writeVerificationProject(label: string, source: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asp-typescript-verification-${label}-`));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*.ts"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), source);
  return root;
}

function profileHint(
  ownerPath: string,
  responsibilities: TypeScriptVerificationProfileHint["responsibilities"],
): TypeScriptVerificationProfileHint {
  return {
    ownerPath,
    responsibilities,
    taskContractOverrides: {},
  };
}

function performanceDescriptor(): TypeScriptVerificationSkillDescriptor {
  return {
    skillId: "typescript-verification-performance",
    adapter: "vitest-bench",
    tool: "node:test",
    command: "npm run test:perf",
    standard: "project microbenchmarks stay within configured threshold",
    requiredInputs: ["bench_target", "baseline", "regression_threshold"],
    passCriteria: ["regression<=threshold"],
    receiptFields: ["benchmark_command", "baseline", "regression_threshold"],
  };
}
