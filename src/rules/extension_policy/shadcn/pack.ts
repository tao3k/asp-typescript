import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptReasoningTree,
} from "../../../model.js";
import { TS_EXT_SHADCN_R001, TS_EXT_SHADCN_R002, TS_EXT_SHADCN_R003 } from "./policy.js";

export function shadcnPolicyRules(): readonly AspTypeScriptRule[] {
  return [TS_EXT_SHADCN_R001, TS_EXT_SHADCN_R002, TS_EXT_SHADCN_R003];
}

export function evaluateShadcnPolicyRules(tree: TypeScriptReasoningTree): AspTypeScriptFinding[] {
  const ext = tree.packageExtensions.find((e) => e.name === "shadcn");
  if (!ext) return [];

  const findings: AspTypeScriptFinding[] = [];

  // R001: extension requires tailwindcss dependency
  if (ext.activation === "config-enabled-missing-dependency") {
    findings.push({
      ruleId: TS_EXT_SHADCN_R001.ruleId,
      packId: TS_EXT_SHADCN_R001.packId,
      severity: TS_EXT_SHADCN_R001.severity,
      title: TS_EXT_SHADCN_R001.title,
      summary:
        "shadcn/ui extension is enabled via config but tailwindcss is not a project dependency.",
      location: { path: ext.configSource ?? "<config>", line: 1, column: 0 },
      requirement: TS_EXT_SHADCN_R001.requirement,
      label: "missing shadcn dependency",
      labels: TS_EXT_SHADCN_R001.labels,
    });
  }

  return findings;
}
