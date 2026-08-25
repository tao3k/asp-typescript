import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import process from "node:process";

const SCHEMA_ID = "agent.semantic-protocols.dev-command-log";
const SCHEMA_VERSION = "1";
const PROTOCOL_ID = "agent.semantic-protocols.semantic-language";
const PROTOCOL_VERSION = "1";

const SECRET_FLAGS = new Set(["--api-key", "--apikey", "--password", "--secret", "--token"]);

const PROJECT_ANCHORS = [
  "Cargo.toml",
  "package.json",
  "pnpm-lock.yaml",
  "pyproject.toml",
  "Project.toml",
  ".git",
];

const VALUE_OPTIONS = new Set([
  "--from-hook",
  "--package",
  "--query",
  "--query-set",
  "--selector",
  "--term",
  "--view",
]);

const SEARCH_PIPES = new Set([
  "dependency",
  "deps",
  "docs",
  "features",
  "lexical",
  "items",
  "owner",
  "owners",
  "prime",
  "symbol",
  "tests",
  "workspace",
]);

type DevCommandLog =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly argv: readonly string[];
      readonly command: NormalizedCommand;
      readonly contextSource: string;
      readonly cwd: string;
      readonly eventId: string;
      readonly hookRunId: string | undefined;
      readonly logFile: string;
      readonly parentEventId: string | undefined;
      readonly projectRoot: string;
      readonly projectRootHash: string;
      readonly sessionId: string;
      readonly sessionOrdinal: number;
      readonly startedAtMs: number;
      readonly startedAtUtc: string;
    };

type NormalizedCommand = {
  readonly namespace: string;
  readonly method: string;
  readonly pipes: readonly string[];
  readonly query: string | undefined;
  readonly querySetCount: number;
  readonly renderMode: string | undefined;
  readonly view: string | undefined;
};

type SessionContext = {
  readonly hookRunId: string | undefined;
  readonly parentEventId: string | undefined;
  readonly sessionId: string;
  readonly source: string;
};

export function startDevCommandLog(args: readonly string[], cwd: string): DevCommandLog {
  if (!envTruthy("SEMANTIC_PROTOCOL_DEV_MODE")) {
    return { enabled: false };
  }

  const projectRoot = inferProjectRoot(args, cwd) ?? cwd;
  const projectRootHash = stableHashHex(projectRoot);
  const logRoot = resolveLogRoot(projectRoot, projectRootHash);
  if (logRoot === undefined) {
    return { enabled: false };
  }

  const session = resolveSessionContext(logRoot, projectRootHash);
  const sessionOrdinal = allocateSessionOrdinal(logRoot, session.sessionId);
  const startedAtMs = Date.now();
  const eventId = `asp-typescript-${startedAtMs}-${process.pid}-${sessionOrdinal
    .toString()
    .padStart(6, "0")}`;
  const logFile = path.join(
    logRoot,
    "typescript",
    "asp-typescript",
    "commands",
    `${formatUtcFileTimestamp(startedAtMs)}-${sessionOrdinal
      .toString()
      .padStart(6, "0")}-${sanitizeFileComponent(eventId)}.jsonl`,
  );
  const argv = ["asp-typescript", ...redactArgv(args)];

  return {
    enabled: true,
    argv,
    command: normalizeCommand(argv),
    contextSource: session.source,
    cwd,
    eventId,
    hookRunId: session.hookRunId,
    logFile,
    parentEventId: session.parentEventId,
    projectRoot,
    projectRootHash,
    sessionId: session.sessionId,
    sessionOrdinal,
    startedAtMs,
    startedAtUtc: formatUtcTimestamp(startedAtMs),
  };
}

export function finishDevCommandLog(log: DevCommandLog, exitCode: number): void {
  if (!log.enabled) {
    return;
  }

  try {
    const finishedAtMs = Date.now();
    fs.mkdirSync(path.dirname(log.logFile), { recursive: true });
    const event: Record<string, unknown> = {
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      protocolId: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      timestampUtc: formatUtcTimestamp(finishedAtMs),
      startedAtUtc: log.startedAtUtc,
      finishedAtUtc: formatUtcTimestamp(finishedAtMs),
      eventId: log.eventId,
      sessionId: log.sessionId,
      sessionOrdinal: log.sessionOrdinal,
      languageId: "typescript",
      providerId: "asp-typescript",
      binary: "asp-typescript",
      argv: log.argv,
      cwd: log.cwd,
      projectRoot: log.projectRoot,
      projectRootHash: log.projectRootHash,
      command: log.command,
      result: {
        exitCode,
        elapsedMs: Math.max(0, finishedAtMs - log.startedAtMs),
        stdoutBytes: 0,
        stderrBytes: 0,
        status: exitCode === 0 ? "success" : "failure",
      },
      fields: {
        contextSource: log.contextSource,
        logFileNaming: "utc-second-session-ordinal-event",
        outputBytesMeasured: false,
        sequenceScope: "session",
      },
    };
    if (log.parentEventId !== undefined) {
      event.parentEventId = log.parentEventId;
    }
    if (log.hookRunId !== undefined) {
      event.hookRunId = log.hookRunId;
    }
    fs.appendFileSync(log.logFile, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Dev-mode tracing must never change CLI behavior.
  }
}

function resolveSessionContext(logRoot: string, projectRootHash: string): SessionContext {
  const envSessionId = envFirst([
    "SEMANTIC_PROTOCOL_SESSION_ID",
    "CODEX_SESSION_ID",
    "CLAUDE_SESSION_ID",
    "TERM_SESSION_ID",
  ]);
  const envHookRunId = envFirst([
    "SEMANTIC_PROTOCOL_HOOK_RUN_ID",
    "CODEX_HOOK_RUN_ID",
    "AGENT_HOOK_RUN_ID",
  ]);
  const envParentEventId = envFirst(["SEMANTIC_PROTOCOL_PARENT_EVENT_ID"]);
  if (envSessionId !== undefined || envHookRunId !== undefined || envParentEventId !== undefined) {
    const sessionId =
      envSessionId ??
      (envHookRunId !== undefined
        ? `hook-${stableHashHex(envHookRunId)}`
        : `project-${projectRootHash}`);
    return {
      hookRunId: envHookRunId,
      parentEventId: envParentEventId ?? envHookRunId,
      sessionId,
      source: "env",
    };
  }

  const marker = readActiveContext(logRoot, projectRootHash);
  if (marker !== undefined) {
    return marker;
  }
  return {
    hookRunId: undefined,
    parentEventId: undefined,
    sessionId: `project-${projectRootHash}`,
    source: "project-fallback",
  };
}

function readActiveContext(logRoot: string, projectRootHash: string): SessionContext | undefined {
  try {
    const marker = path.join(logRoot, "dev-context", `${projectRootHash}.json`);
    const stat = fs.statSync(marker);
    if (Date.now() - stat.mtimeMs > 30 * 60 * 1000) {
      return undefined;
    }
    const data = JSON.parse(fs.readFileSync(marker, "utf8")) as Record<string, unknown>;
    const sessionId = stringField(data.sessionId) ?? `project-${projectRootHash}`;
    return {
      hookRunId: stringField(data.hookRunId),
      parentEventId: stringField(data.parentEventId),
      sessionId,
      source: "active-context",
    };
  } catch {
    return undefined;
  }
}

function allocateSessionOrdinal(logRoot: string, sessionId: string): number {
  const dir = path.join(logRoot, "typescript", "asp-typescript", "sessions");
  const key = sanitizeFileComponent(sessionId);
  const counterPath = path.join(dir, `${key}.counter`);
  const lockPath = path.join(dir, `${key}.lock`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    let nextValue = 1;
    withLock(lockPath, () => {
      let current = 0;
      try {
        const parsed = Number.parseInt(fs.readFileSync(counterPath, "utf8"), 10);
        current = Number.isFinite(parsed) ? parsed : 0;
      } catch {
        current = 0;
      }
      nextValue = current + 1;
      fs.writeFileSync(counterPath, nextValue.toString(), "utf8");
    });
    return nextValue;
  } catch {
    return 0;
  }
}

function withLock(lockPath: string, body: () => void): void {
  let fd: number | undefined;
  for (let index = 0; index < 50; index += 1) {
    try {
      fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, process.pid.toString(), "utf8");
      body();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    } finally {
      if (fd !== undefined) {
        fs.closeSync(fd);
        fd = undefined;
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Ignore stale lock cleanup failures in best-effort tracing.
        }
      }
    }
  }
  throw new Error("failed to acquire dev command log counter lock");
}

function resolveLogRoot(projectRoot: string, projectRootHash: string): string | undefined {
  const traceDir = envNonEmpty("SEMANTIC_PROTOCOL_TRACE_DIR");
  if (traceDir !== undefined) {
    return pathFromEnv(traceDir, projectRoot);
  }
  const prjCacheHome = envNonEmpty("PRJ_CACHE_HOME");
  if (prjCacheHome !== undefined) {
    return path.join(pathFromEnv(prjCacheHome, projectRoot), "semantic_protocol");
  }
  const xdgCacheHome = envNonEmpty("XDG_CACHE_HOME");
  if (xdgCacheHome !== undefined) {
    return path.join(
      xdgCacheHome,
      "agent-semantic-protocols",
      projectRootHash,
      "semantic_protocol",
    );
  }
  const home = envNonEmpty("HOME");
  if (home !== undefined) {
    return path.join(
      home,
      ".cache",
      "agent-semantic-protocols",
      projectRootHash,
      "semantic_protocol",
    );
  }
  return path.join(os.tmpdir(), "agent-semantic-protocols", projectRootHash, "semantic_protocol");
}

function pathFromEnv(value: string, projectRoot: string): string {
  return path.isAbsolute(value) ? value : path.join(projectRoot, value);
}

function inferProjectRoot(args: readonly string[], cwd: string): string | undefined {
  for (const arg of [...args].reverse()) {
    if (arg.startsWith("-")) {
      continue;
    }
    const candidate = path.isAbsolute(arg) ? arg : path.join(cwd, arg);
    const root = projectRootFromPath(candidate);
    if (root !== undefined) {
      return root;
    }
  }
  return projectRootFromPath(cwd);
}

function projectRootFromPath(candidate: string): string | undefined {
  let cursor =
    fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
      ? candidate
      : path.dirname(candidate);
  while (true) {
    if (PROJECT_ANCHORS.some((anchor) => fs.existsSync(path.join(cursor, anchor)))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return undefined;
    }
    cursor = parent;
  }
}

function redactArgv(args: readonly string[]): string[] {
  const output: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const flag = arg.split("=", 1)[0] ?? "";
    if (SECRET_FLAGS.has(flag) && arg.includes("=")) {
      output.push(`${flag}=[REDACTED]`);
      continue;
    }
    if (SECRET_FLAGS.has(arg)) {
      output.push(arg);
      if (index + 1 < args.length) {
        index += 1;
        output.push("[REDACTED]");
      }
      continue;
    }
    output.push(arg);
  }
  return output;
}

function normalizeCommand(argv: readonly string[]): NormalizedCommand {
  const args = argv.slice(1);
  const namespaceIndex = args.findIndex((arg) => !arg.startsWith("-"));
  const namespace = normalizeToken(namespaceIndex >= 0 ? args[namespaceIndex]! : "cli");
  const renderMode = optionValue(args, "--view");
  const querySetCount = args.filter(
    (arg) => arg === "--query-set" || arg.startsWith("--query-set="),
  ).length;
  const pipes = [
    ...new Set(args.map(normalizeToken).filter((token) => SEARCH_PIPES.has(token))),
  ].sort();
  const view = namespace === "search" ? firstPositionalAfter(args, namespaceIndex) : undefined;
  const normalizedView = view === undefined ? undefined : normalizeToken(view);
  const method =
    namespace === "search" && normalizedView !== undefined
      ? `search/${normalizedView}`
      : namespace === "agent"
        ? `agent/${normalizeToken(firstPositionalAfter(args, namespaceIndex) ?? "unknown")}`
        : namespace;
  const query =
    optionValue(args, "--query") ?? firstQueryPositional(args, namespaceIndex, normalizedView);
  return {
    namespace,
    method,
    pipes,
    query,
    querySetCount,
    renderMode: renderMode === undefined ? undefined : normalizeToken(renderMode),
    view: normalizedView,
  };
}

function firstPositionalAfter(args: readonly string[], start: number): string | undefined {
  let skipNext = false;
  for (let index = Math.max(0, start + 1); index < args.length; index += 1) {
    const arg = args[index]!;
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (optionTakesValue(arg)) {
      skipNext = !arg.includes("=");
      continue;
    }
    if (!arg.startsWith("-")) {
      return arg;
    }
  }
  return undefined;
}

function firstQueryPositional(
  args: readonly string[],
  namespaceIndex: number,
  view: string | undefined,
): string | undefined {
  let skippedView = view === undefined;
  let skipNext = false;
  for (const arg of args.slice(Math.max(0, namespaceIndex + 1))) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (optionTakesValue(arg)) {
      skipNext = !arg.includes("=");
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    const token = normalizeToken(arg);
    if (!skippedView && token === view) {
      skippedView = true;
      continue;
    }
    if (SEARCH_PIPES.has(token)) {
      continue;
    }
    return arg;
  }
  return undefined;
}

function optionValue(args: readonly string[], name: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === name) {
      return args[index + 1];
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

function optionTakesValue(arg: string): boolean {
  const flag = arg.split("=", 1)[0]!;
  return VALUE_OPTIONS.has(flag);
}

function normalizeToken(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "");
  return token.length === 0 ? "unknown" : token;
}

function envTruthy(name: string): boolean {
  return ["1", "true", "TRUE", "yes", "YES", "on", "ON"].includes(process.env[name] ?? "");
}

function envFirst(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = envNonEmpty(name);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function envNonEmpty(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatUtcTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatUtcFileTimestamp(ms: number): string {
  return formatUtcTimestamp(ms).replaceAll(":", "-");
}

function sanitizeFileComponent(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_.-]+/g, "_");
  return sanitized.length === 0 ? "unknown" : sanitized;
}

function stableHashHex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
