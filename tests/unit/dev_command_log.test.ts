import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { finishDevCommandLog, startDevCommandLog } from "../../src/cli/dev-command-log.js";
import {
  TYPE_SCRIPT_LANGUAGE_ID,
  TYPE_SCRIPT_PROVIDER_ID,
} from "../../src/cli/semantic-language.js";

test("dev command log records ordered active-context events", () => {
  const project = mkdtempSync(path.join(tmpdir(), `${TYPE_SCRIPT_PROVIDER_ID}-dev-log-project-`));
  const trace = mkdtempSync(path.join(tmpdir(), `${TYPE_SCRIPT_PROVIDER_ID}-dev-log-trace-`));
  const previousEnv = {
    parent: process.env.SEMANTIC_PROTOCOL_PARENT_EVENT_ID,
    session: process.env.SEMANTIC_PROTOCOL_SESSION_ID,
    hook: process.env.SEMANTIC_PROTOCOL_HOOK_RUN_ID,
    trace: process.env.SEMANTIC_PROTOCOL_TRACE_DIR,
    mode: process.env.SEMANTIC_PROTOCOL_DEV_MODE,
    codexSession: process.env.CODEX_SESSION_ID,
    claudeSession: process.env.CLAUDE_SESSION_ID,
    terminalSession: process.env.TERM_SESSION_ID,
    codexHook: process.env.CODEX_HOOK_RUN_ID,
    agentHook: process.env.AGENT_HOOK_RUN_ID,
  };

  try {
    writeFileSync(path.join(project, "package.json"), '{"name":"dev-log-fixture"}\n', "utf8");
    const projectRootHash = stableHashHex(project);
    const contextDir = path.join(trace, "dev-context");
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(
      path.join(contextDir, `${projectRootHash}.json`),
      JSON.stringify({
        hookRunId: "hook-run-ts",
        parentEventId: "hook-parent-ts",
        sessionId: "session-ts",
      }),
      "utf8",
    );

    process.env.SEMANTIC_PROTOCOL_DEV_MODE = "1";
    process.env.SEMANTIC_PROTOCOL_TRACE_DIR = trace;
    delete process.env.SEMANTIC_PROTOCOL_PARENT_EVENT_ID;
    delete process.env.SEMANTIC_PROTOCOL_SESSION_ID;
    delete process.env.SEMANTIC_PROTOCOL_HOOK_RUN_ID;
    delete process.env.CODEX_SESSION_ID;
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.TERM_SESSION_ID;
    delete process.env.CODEX_HOOK_RUN_ID;
    delete process.env.AGENT_HOOK_RUN_ID;

    const log = startDevCommandLog(["search", "lexical", "metadata", project], project);
    finishDevCommandLog(log, 0);

    const commandDir = path.join(
      trace,
      TYPE_SCRIPT_LANGUAGE_ID,
      TYPE_SCRIPT_PROVIDER_ID,
      "commands",
    );
    const entries = readdirSync(commandDir).filter((entry) => entry.endsWith(".jsonl"));
    assert.equal(entries.length, 1);
    assert.match(
      entries[0]!,
      new RegExp(`^20.*T.*Z-000001-${TYPE_SCRIPT_PROVIDER_ID}-.*\\.jsonl$`, "u"),
    );

    const event = JSON.parse(readFileSync(path.join(commandDir, entries[0]!), "utf8"));
    assert.equal(event.schemaId, "agent.semantic-protocols.dev-command-log");
    assert.equal(event.languageId, "typescript");
    assert.equal(event.providerId, TYPE_SCRIPT_PROVIDER_ID);
    assert.equal(event.sessionId, "session-ts");
    assert.equal(event.sessionOrdinal, 1);
    assert.equal(event.parentEventId, "hook-parent-ts");
    assert.equal(event.hookRunId, "hook-run-ts");
    assert.equal(event.fields.contextSource, "active-context");
    assert.equal("stdout" in event, false);
    assert.equal("stderr" in event, false);
  } finally {
    restoreEnv("SEMANTIC_PROTOCOL_PARENT_EVENT_ID", previousEnv.parent);
    restoreEnv("SEMANTIC_PROTOCOL_SESSION_ID", previousEnv.session);
    restoreEnv("SEMANTIC_PROTOCOL_HOOK_RUN_ID", previousEnv.hook);
    restoreEnv("SEMANTIC_PROTOCOL_TRACE_DIR", previousEnv.trace);
    restoreEnv("SEMANTIC_PROTOCOL_DEV_MODE", previousEnv.mode);
    restoreEnv("CODEX_SESSION_ID", previousEnv.codexSession);
    restoreEnv("CLAUDE_SESSION_ID", previousEnv.claudeSession);
    restoreEnv("TERM_SESSION_ID", previousEnv.terminalSession);
    restoreEnv("CODEX_HOOK_RUN_ID", previousEnv.codexHook);
    restoreEnv("AGENT_HOOK_RUN_ID", previousEnv.agentHook);
    rmSync(project, { recursive: true, force: true });
    rmSync(trace, { recursive: true, force: true });
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function stableHashHex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
