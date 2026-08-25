#!/usr/bin/env node

import { chmod, copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");

await build({
  entryPoints: ["src/cli/main.ts"],
  outfile: "dist/provider/asp-typescript.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  banner: {
    js: [
      "import { createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __pathDirname } from 'node:path';",
      "const require = createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
  legalComments: "none",
  sourcemap: false,
});

await chmod("dist/src/cli/main.js", 0o755);
await chmod("dist/provider/asp-typescript.mjs", 0o755);
await mkdir("dist/schemas", { recursive: true });
await copyFile(
  "provider/asp-provider-registration.json",
  "dist/provider/asp-provider-registration.json",
);

const registration = JSON.parse(
  await readFile(resolve(packageRoot, "provider/asp-provider-registration.json"), "utf8"),
);
for (const schema of registration.schemas) {
  if (
    (schema.authority !== "asp" && schema.authority !== "provider") ||
    typeof schema.path !== "string" ||
    !/^schemas\/[^/]+\.schema\.json$/u.test(schema.path)
  ) {
    throw new Error("invalid provider schema registration");
  }
  const authorityRoot = schema.authority === "asp" ? repositoryRoot : packageRoot;
  const destination = resolve(packageRoot, "dist", schema.path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(authorityRoot, schema.path), destination);
}

const schemaBundleReceipt = JSON.parse(
  await readFile(resolve(packageRoot, "schemas/.asp-schema-manager-receipt.json"), "utf8"),
);
for (const schema of schemaBundleReceipt.schemas) {
  if (typeof schema.name !== "string" || !/^[^/]+\.schema\.json$/u.test(schema.name)) {
    throw new Error("invalid SchemaManager bundle receipt entry");
  }
  await copyFile(
    resolve(packageRoot, "schemas", schema.name),
    resolve(packageRoot, "dist/schemas", schema.name),
  );
}
await copyFile(
  resolve(packageRoot, "schemas/.asp-schema-manager-receipt.json"),
  resolve(packageRoot, "dist/schemas/.asp-schema-manager-receipt.json"),
);
