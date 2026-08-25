export interface SourceLineRange {
  readonly lineStart: number;
  readonly lineEnd: number;
}

export interface StructuralItemSelector {
  readonly ownerPath: string;
  readonly itemKind: string;
  readonly itemName: string;
}

export function ownerPathFromQuerySelector(selector: string | undefined): string | undefined {
  if (selector === undefined) return undefined;
  if (querySelectorHasGlob(selector)) return undefined;
  const structural = structuralItemSelectorFromQuerySelector(selector);
  if (structural !== undefined) return structural.ownerPath;
  const normalized = selector.replace(/\\/gu, "/").replace(/^owner:/u, "");
  return normalized.replace(/:\d+(?::|-)\d+$/u, "");
}

export function selectorHasLineRange(
  selector: string | undefined,
  ownerPath: string | undefined,
): boolean {
  if (selector === undefined || ownerPath === undefined) return false;
  return sourceSelectorLineRange(selector, ownerPath) !== undefined;
}

export function sourceSelectorLineRange(
  selector: string,
  ownerPath: string,
): SourceLineRange | undefined {
  if (structuralItemSelectorFromQuerySelector(selector) !== undefined) return undefined;
  const normalized = selector.replace(/\\/gu, "/").replace(/^owner:/u, "");
  const match = /:(\d+)(?::|-)(\d+)$/u.exec(normalized);
  if (match === null) return undefined;
  const selectedOwnerPath = normalized.slice(0, match.index);
  if (selectedOwnerPath !== ownerPath) return undefined;
  const lineStart = Number.parseInt(match[1]!, 10);
  const lineEnd = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) return undefined;
  return {
    lineStart: Math.min(lineStart, lineEnd),
    lineEnd: Math.max(lineStart, lineEnd),
  };
}

export function querySelectorHasGlob(selector: string): boolean {
  return /[*?[{}\]]/u.test(selector);
}

export function structuralItemSelectorFromQuerySelector(
  selector: string | undefined,
): StructuralItemSelector | undefined {
  if (selector === undefined) return undefined;
  const normalized = selector.replace(/\\/gu, "/");
  const prefix = "typescript://";
  const rest = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  const [ownerPath, itemFragment] = rest.split("#item/");
  if (ownerPath === undefined || itemFragment === undefined || ownerPath.length === 0) {
    return undefined;
  }
  const [itemKind, ...nameParts] = itemFragment.split("/");
  const itemName = nameParts.join("/");
  if (itemKind === undefined || itemKind.length === 0 || itemName.length === 0) {
    return undefined;
  }
  return {
    ownerPath,
    itemKind,
    itemName: decodeURIComponent(itemName),
  };
}
