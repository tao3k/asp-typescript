#!/usr/bin/env node

import { chmod, copyFile } from "node:fs/promises";
import { build } from "esbuild";

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
await copyFile(
  "provider/asp-provider-registration.json",
  "dist/provider/asp-provider-registration.json",
);
