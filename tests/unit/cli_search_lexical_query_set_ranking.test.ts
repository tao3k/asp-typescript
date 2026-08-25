import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

test("lexical query-set ranks owner-local exported item matches before broad declaration hits", async () => {
  const root = mkdtempSync(join(tmpdir(), "asp-typescript-lexical-ranking-"));
  mkdirSync(join(root, "src", "server"), { recursive: true });
  mkdirSync(join(root, "types"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });

  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "ranking-fixture", version: "0.0.0", type: "module" }),
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
      },
      include: ["src/**/*.ts", "types/**/*.d.ts", "tests/**/*.ts"],
    }),
  );
  writeFileSync(
    join(root, "src", "server", "fetch.ts"),
    [
      "export class APIRequestContext {",
      "  async fetch(url: string): Promise<Response> {",
      "    return new Response(url);",
      "  }",
      "}",
      "",
      "export class BrowserContextAPIRequestContext extends APIRequestContext {",
      "  override async fetch(url: string): Promise<Response> {",
      "    return super.fetch(url);",
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "types", "generated.d.ts"),
    [
      "export interface APIRequestContextOptions { fetch?: boolean }",
      "export interface BrowserContextAPIRequestContextOptions { fetch?: boolean }",
      "export type FetchLike = typeof fetch;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "tests", "request.spec.ts"),
    [
      "const fixture = 'APIRequestContext BrowserContextAPIRequestContext fetch';",
      "export const requestFixture = fixture;",
      "",
    ].join("\n"),
  );

  const result = await runCli([
    "search",
    "lexical",
    "--query-set",
    "APIRequestContext",
    "--query-set",
    "BrowserContextAPIRequestContext",
    "--query-set",
    "fetch",
    "owner",
    "tests",
    "--view",
    "seeds",
    "--workspace",
    root,
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /\[search-lexical\]/);
  assert.match(result.stdout, /querySet=3/);
  assert.match(result.stdout, /owner:path\(src\/server\/fetch\.ts\)/);
  assert.match(result.stdout, /symbol\(APIRequestContext\)/);
  assert.match(result.stdout, /symbol\(BrowserContextAPIRequestContext\)/);
});

async function runCli(args: string[]): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, ["dist/src/cli/main.js", ...args], {
      cwd: new URL("../../..", import.meta.url),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
  return { exitCode, stdout, stderr };
}
