import type { AspTypeScriptRule } from "../../../model.js";

export const TS_EXT_SHADCN_R001: AspTypeScriptRule = {
  ruleId: "TS-EXT-SHADCN-R001",
  packId: "typescript.extension_policy",
  severity: "error",
  title: "shadcn/ui extension requires the tailwindcss dependency",
  requirement:
    "When project config enables the shadcn extension, the project should declare tailwindcss so the component registry and theming policy can validate against real source dependencies.",
  labels: { surface: "extension", parser: "package-json", extension: "shadcn" },
};

export const TS_EXT_SHADCN_R002: AspTypeScriptRule = {
  ruleId: "TS-EXT-SHADCN-R002",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "shadcn/ui component should use cn() utility for class merging",
  requirement:
    "shadcn/ui components should use the `cn()` helper from `@/lib/utils` for className merging to ensure Tailwind class conflict resolution via tailwind-merge and clsx.",
  labels: { surface: "extension", parser: "reasoning-tree", extension: "shadcn" },
};

export const TS_EXT_SHADCN_R003: AspTypeScriptRule = {
  ruleId: "TS-EXT-SHADCN-R003",
  packId: "typescript.extension_policy",
  severity: "info",
  title: "shadcn/ui registry schema should use Zod for configuration validation",
  requirement:
    "Registry configuration files should define Zod schemas for validation. Pattern from shadcn/ui: every config has a corresponding Zod schema with .strict() and .refine() for runtime type safety.",
  labels: { surface: "extension", parser: "reasoning-tree", extension: "shadcn" },
};
