import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCliCapture } from "./cli_helpers.js";

test("search policy returns provider-owned owner and test handles", () => {
  const root = policySearchFixture();
  const result = runCliCapture(
    [
      "search",
      "policy",
      "TS-AGENT-POLICY-001",
      "owner",
      "tests",
      "--view",
      "seeds",
      "--workspace",
      ".",
    ],
    root,
  );
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(
    result.stdout,
    /^\[search-policy\] q=TS-AGENT-POLICY-001 alg=policy-handle-catalog/mu,
  );
  assert.match(result.stdout, /^O=owner:path\(src\/rules\/agent_policy\/pack\.ts\)!owner;/mu);
  assert.match(result.stdout, /^rank=O,T,T2,T3 frontier=O\.owner,T\.tests,T2\.tests,T3\.tests/mu);
  assert.match(result.stdout, /O=owner:path\(src\/rules\/agent_policy\/pack\.ts\)!owner/u);
  assert.match(result.stdout, /T=test:path\(tests\/unit\/agent_policy\.test\.ts\)!tests/u);
  assert.doesNotMatch(result.stdout, /\|seed /u);
});

test("search policy JSON exposes semanticHandles", () => {
  const root = policySearchFixture();
  const result = runCliCapture(
    ["search", "policy", "TS-AGENT-PROJECT-001", "owner", "tests", "--json", "--workspace", "."],
    root,
  );
  assert.equal(result.exitCode, 0, result.stderr);
  const packet = JSON.parse(result.stdout) as {
    readonly view: string;
    readonly semanticHandles?: readonly {
      readonly id: string;
      readonly kind: string;
      readonly ownerPath?: string;
      readonly testPaths?: readonly string[];
    }[];
  };
  assert.equal(packet.view, "policy");
  assert.equal(packet.semanticHandles?.[0]?.id, "TS-AGENT-PROJECT-001");
  assert.equal(packet.semanticHandles?.[0]?.kind, "policy-rule");
  assert.equal(packet.semanticHandles?.[0]?.ownerPath, "src/rules/project_policy/pack.ts");
  assert.ok(packet.semanticHandles?.[0]?.testPaths?.includes("tests/unit/runner.test.ts"));
});

function policySearchFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-policy-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "policy-fixture", version: "0.0.0", type: "module" }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    `${JSON.stringify({ compilerOptions: { strict: true }, include: ["src/**/*.ts"] }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export const value = 1;\n");
  return root;
}
