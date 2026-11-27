import type { AspTypeScriptReport } from "../model.js";

export function renderAspTypeScriptJson(report: AspTypeScriptReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
