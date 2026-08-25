import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderTypeScriptReasoningTree, runTypeScriptProjectHarness } from "../../src/index.js";
import { relativePath } from "./path_helpers.js";

test("project runner preserves tsconfig allowJs native file selection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asp-typescript-allow-js-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@example/allow-js", type: "module" }),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        allowJs: true,
        checkJs: true,
        jsx: "preserve",
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*", "vite.config.mjs"],
    }),
  );
  fs.writeFileSync(path.join(root, "src", "plain.js"), "export const value = 1;\n");
  fs.writeFileSync(path.join(root, "src", "main.mjs"), "export const run = () => undefined;\n");
  fs.writeFileSync(path.join(root, "src", "index.js"), 'export { value } from "./plain.js";\n');
  fs.writeFileSync(
    path.join(root, "src", "view.jsx"),
    'import { value } from "./plain.js";\nexport const View = <main>{value}</main>;\n',
  );
  fs.writeFileSync(
    path.join(root, "src", "view.test.jsx"),
    'import { View } from "./view.jsx";\nexport const rendered = View;\n',
  );
  fs.writeFileSync(path.join(root, "vite.config.mjs"), "export default {};\n");

  const report = runTypeScriptProjectHarness(root);
  const rendered = renderTypeScriptReasoningTree(report);

  assert.deepEqual(
    report.modules.map((moduleReport) => ({
      path: relativePath(root, moduleReport.path),
      scriptKind: moduleReport.scriptKind,
    })),
    [
      { path: "src/index.js", scriptKind: "js" },
      { path: "src/main.mjs", scriptKind: "mjs" },
      { path: "src/plain.js", scriptKind: "js" },
      { path: "src/view.jsx", scriptKind: "jsx" },
      { path: "src/view.test.jsx", scriptKind: "jsx" },
      { path: "vite.config.mjs", scriptKind: "mjs" },
    ],
  );
  const roleByPath = new Map(
    report.reasoningTree.modules.map((moduleReport) => [
      relativePath(root, moduleReport.path),
      moduleReport.role,
    ]),
  );
  assert.deepEqual(Object.fromEntries(roleByPath), {
    "src/index.js": "facade",
    "src/main.mjs": "entrypoint",
    "src/plain.js": "source",
    "src/view.jsx": "source",
    "src/view.test.jsx": "test",
    "vite.config.mjs": "config",
  });
  assert.match(rendered, /^Modules: source=5 roots=2 branches=5 deps=2/u);
  assert.match(
    rendered,
    /src\/index\.js \[root, facade\] owner=src imports=relative:1 exports=value -> export:src\/plain\.js/u,
  );
  assert.match(rendered, /src\/main\.mjs \[root, entrypoint\] owner=src\/main exports=run/u);
  assert.match(rendered, /src\/view\.jsx --relative\/import--> src\/plain\.js/u);
  assert.match(rendered, /vite\.config\.mjs \[config\] owner=vite\.config exports=default/u);
  assert.doesNotMatch(rendered, /src\/view\.test\.jsx/u);
});
