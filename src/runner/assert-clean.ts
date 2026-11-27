import { defaultAspTypeScriptConfig } from "../config.js";
import { renderAssertionMessage, renderAspTypeScriptAgentCompactText } from "../render.js";
import { advisoryFindings, isAspTypeScriptClean } from "../model.js";
import { runAspTypeScript } from "./run-project.js";
import type { AspTypeScriptEmbeddedOptions } from "./run-project.js";
import type { AspTypeScriptConfig, AspTypeScriptReport } from "../model.js";

export { type AspTypeScriptEmbeddedOptions } from "./run-project.js";

export function assertAspTypeScriptClean(
  projectRootInput: string | URL,
  config: AspTypeScriptConfig = defaultAspTypeScriptConfig(),
): AspTypeScriptReport {
  const report = runAspTypeScript(projectRootInput, config);
  if (!isAspTypeScriptClean(report)) {
    throw new Error(renderAssertionMessage(report));
  }
  return report;
}

export function assertAspTypeScriptAgentClean(
  projectRootInput: string | URL,
  config: AspTypeScriptConfig = defaultAspTypeScriptConfig(),
): AspTypeScriptReport {
  const report = assertAspTypeScriptClean(projectRootInput, config);
  if (advisoryFindings(report).length > 0) {
    throw new Error(renderAspTypeScriptAgentCompactText(report));
  }
  return report;
}

export function assertAspTypeScriptEmbeddedClean(
  projectRootInput: string | URL,
  options: AspTypeScriptEmbeddedOptions = {},
): AspTypeScriptReport {
  const report = runAspTypeScript(
    projectRootInput,
    options.config ?? defaultAspTypeScriptConfig(),
    { collectSemanticDiagnostics: options.collectSemanticDiagnostics ?? false },
  );
  if (!isAspTypeScriptClean(report)) {
    throw new Error(renderAssertionMessage(report));
  }
  if (options.emitAdvice !== false) {
    const advice = renderAspTypeScriptAgentCompactText(report, {
      findings: "advice",
    });
    if (advice) {
      const writeAdvice = options.writeAdvice ?? ((message: string) => console.error(message));
      writeAdvice(advice);
    }
  }
  return report;
}
