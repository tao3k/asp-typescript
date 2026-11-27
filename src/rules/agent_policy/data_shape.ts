import type {
  AspTypeScriptFinding,
  AspTypeScriptRule,
  TypeScriptPublicDataFieldFact,
  TypeScriptPublicDiscriminatedUnionVariantFieldFact,
  TypeScriptPublicTypeAliasFact,
  TypeScriptReasoningModule,
  TypeScriptReasoningTree,
} from "../../model.js";

export const TS_AGENT_R009: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-009",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public data surface exposes primitive semantic fields",
  requirement:
    "Wrap repeated public semantic primitive fields in named domain types or make the raw DTO boundary explicit so agents preserve data invariants instead of extending stringly typed state.",
  labels: { surface: "agent", parser: "native-syntax" },
};

export const TS_AGENT_R010: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-010",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public semantic type alias hides a primitive carrier",
  requirement:
    "Use a branded type, opaque wrapper, or named domain object instead of a primitive type alias for semantic identifiers, tokens, paths, durations, byte sizes, or flags so agents preserve invariants across call sites.",
  labels: { surface: "agent", parser: "native-syntax" },
};

export const TS_AGENT_R011: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-011",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public data model exposes a stringly state field",
  requirement:
    "Use a string-literal union, public enum, branded type, or typed catalog boundary instead of raw string fields for public state, status, kind, mode, phase, type, tag, or category values.",
  labels: { surface: "agent", parser: "native-syntax" },
};

export const TS_AGENT_R012: AspTypeScriptRule = {
  ruleId: "TS-AGENT-POLICY-012",
  packId: "typescript.agent_policy",
  severity: "info",
  title: "Public discriminated union variant exposes primitive semantic payload fields",
  requirement:
    "Move broad public discriminated-union payloads into named domain types or named payload objects so agents preserve event and command invariants instead of extending raw primitive state.",
  labels: { surface: "agent", parser: "native-syntax" },
};

export function evaluateNativeDataShapeAdvice(
  reasoningTree: TypeScriptReasoningTree,
): AspTypeScriptFinding[] {
  return sourceModules(reasoningTree)
    .filter((moduleReport) => moduleReport.layer !== "model")
    .flatMap((moduleReport) => [
      ...publicDataFieldAdvice(moduleReport),
      ...publicTypeAliasAdvice(moduleReport),
      ...publicStringlyStateFieldAdvice(moduleReport),
      ...publicDiscriminatedUnionVariantPayloadAdvice(moduleReport),
    ])
    .sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)));
}

function publicDataFieldAdvice(moduleReport: TypeScriptReasoningModule): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R009;
  return groupedDataFields(moduleReport.publicDataFields).flatMap((fields) => {
    const semanticFields = fields.filter(publicDataFieldContractType);
    const first = semanticFields[0];
    if (first === undefined || semanticFields.length < 3) {
      return [];
    }
    return [
      {
        ruleId: rule.ruleId,
        packId: rule.packId,
        severity: rule.severity,
        title: rule.title,
        summary: `Public ${first.typeKind} '${first.typeName}' exposes primitive semantic fields: ${semanticFields
          .map((field) => `${field.fieldName}: ${publicDataFieldContractType(field)}`)
          .join(", ")}.`,
        location: first.location,
        requirement: rule.requirement,
        ...sourceLineField(first.sourceLine),
        label: "public primitive data fields",
        labels: rule.labels,
      },
    ];
  });
}

function publicTypeAliasAdvice(moduleReport: TypeScriptReasoningModule): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R010;
  return moduleReport.publicTypeAliases.flatMap((alias) => {
    const contractType = publicTypeAliasContractType(alias);
    if (contractType === undefined) {
      return [];
    }
    return [
      {
        ruleId: rule.ruleId,
        packId: rule.packId,
        severity: rule.severity,
        title: rule.title,
        summary: `Public semantic type alias '${alias.aliasName}' maps directly to primitive carrier ${contractType}.`,
        location: alias.location,
        requirement: rule.requirement,
        ...sourceLineField(alias.sourceLine),
        label: "public primitive type alias",
        labels: rule.labels,
      },
    ];
  });
}

function publicStringlyStateFieldAdvice(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  return [
    ...publicDataStringlyStateFieldAdvice(moduleReport.publicDataFields),
    ...publicUnionVariantStringlyStateFieldAdvice(
      moduleReport.publicDiscriminatedUnionVariantFields,
    ),
  ];
}

function publicDataStringlyStateFieldAdvice(
  fields: readonly TypeScriptPublicDataFieldFact[],
): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R011;
  return groupedDataFields(fields).flatMap((group) => {
    const stringlyFields = group.filter((field) => isStringlyStateField(field.fieldName));
    const first = stringlyFields[0];
    if (first === undefined) {
      return [];
    }
    const rawFields = stringlyFields
      .map((field) => [field, rawStringContractType(field.primitiveContractType)] as const)
      .filter(
        (entry): entry is readonly [TypeScriptPublicDataFieldFact, string] =>
          entry[1] !== undefined,
      );
    if (rawFields.length === 0) {
      return [];
    }
    return [
      {
        ruleId: rule.ruleId,
        packId: rule.packId,
        severity: rule.severity,
        title: rule.title,
        summary: `Public ${first.typeKind} '${first.typeName}' exposes stringly state fields: ${rawFields
          .map(([field, contractType]) => `${field.fieldName}: ${contractType}`)
          .join(", ")}.`,
        location: first.location,
        requirement: rule.requirement,
        ...sourceLineField(first.sourceLine),
        label: "public stringly state field",
        labels: rule.labels,
      },
    ];
  });
}

function publicUnionVariantStringlyStateFieldAdvice(
  fields: readonly TypeScriptPublicDiscriminatedUnionVariantFieldFact[],
): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R011;
  return groupedUnionVariantFields(fields).flatMap((group) => {
    const stringlyFields = group.filter((field) => isStringlyStateField(field.fieldName));
    const first = stringlyFields[0];
    if (first === undefined) {
      return [];
    }
    const rawFields = stringlyFields
      .map((field) => [field, rawStringContractType(field.primitiveContractType)] as const)
      .filter(
        (entry): entry is readonly [TypeScriptPublicDiscriminatedUnionVariantFieldFact, string] =>
          entry[1] !== undefined,
      );
    if (rawFields.length === 0) {
      return [];
    }
    return [
      {
        ruleId: rule.ruleId,
        packId: rule.packId,
        severity: rule.severity,
        title: rule.title,
        summary: `Public discriminated union '${first.unionName}' variant '${first.variantName}' exposes stringly state fields: ${rawFields
          .map(([field, contractType]) => `${field.fieldName}: ${contractType}`)
          .join(", ")}.`,
        location: first.location,
        requirement: rule.requirement,
        ...sourceLineField(first.sourceLine),
        label: "public union stringly state field",
        labels: rule.labels,
      },
    ];
  });
}

function publicDiscriminatedUnionVariantPayloadAdvice(
  moduleReport: TypeScriptReasoningModule,
): AspTypeScriptFinding[] {
  const rule = TS_AGENT_R012;
  return groupedUnionVariantFields(moduleReport.publicDiscriminatedUnionVariantFields).flatMap(
    (fields) => {
      const semanticFields = fields.filter(publicUnionVariantFieldContractType);
      const first = semanticFields[0];
      if (first === undefined || semanticFields.length < 2) {
        return [];
      }
      return [
        {
          ruleId: rule.ruleId,
          packId: rule.packId,
          severity: rule.severity,
          title: rule.title,
          summary: `Public discriminated union '${first.unionName}' variant '${first.variantName}' exposes primitive semantic payload fields: ${semanticFields
            .map((field) => `${field.fieldName}: ${publicUnionVariantFieldContractType(field)}`)
            .join(", ")}.`,
          location: first.location,
          requirement: rule.requirement,
          ...sourceLineField(first.sourceLine),
          label: "public union primitive payload",
          labels: rule.labels,
        },
      ];
    },
  );
}

function publicDataFieldContractType(field: TypeScriptPublicDataFieldFact): string | undefined {
  if (isSemanticPublicDataField(field.fieldName)) {
    return field.primitiveContractType ?? field.flagContractType;
  }
  return field.flagContractType !== undefined && isPublicFlagField(field.fieldName)
    ? field.flagContractType
    : undefined;
}

function publicUnionVariantFieldContractType(
  field: TypeScriptPublicDiscriminatedUnionVariantFieldFact,
): string | undefined {
  if (isSemanticPublicDataField(field.fieldName)) {
    return field.primitiveContractType ?? field.flagContractType;
  }
  return field.flagContractType !== undefined && isPublicFlagField(field.fieldName)
    ? field.flagContractType
    : undefined;
}

function publicTypeAliasContractType(alias: TypeScriptPublicTypeAliasFact): string | undefined {
  if (!isSemanticPublicTypeAlias(alias.aliasName) && !isPublicFlagTypeAlias(alias.aliasName)) {
    return undefined;
  }
  return rawPrimitiveAliasContractType(alias.primitiveContractType ?? alias.flagContractType);
}

function groupedDataFields(
  fields: readonly TypeScriptPublicDataFieldFact[],
): readonly (readonly TypeScriptPublicDataFieldFact[])[] {
  const groups = new Map<string, TypeScriptPublicDataFieldFact[]>();
  for (const field of fields) {
    const key = `${field.typeKind}\0${field.typeName}\0${field.typeLine}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, [field]);
      continue;
    }
    existing.push(field);
  }
  return [...groups.values()];
}

function groupedUnionVariantFields(
  fields: readonly TypeScriptPublicDiscriminatedUnionVariantFieldFact[],
): readonly (readonly TypeScriptPublicDiscriminatedUnionVariantFieldFact[])[] {
  const groups = new Map<string, TypeScriptPublicDiscriminatedUnionVariantFieldFact[]>();
  for (const field of fields) {
    const key = `${field.unionName}\0${field.unionLine}\0${field.variantName}\0${field.variantLine}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, [field]);
      continue;
    }
    existing.push(field);
  }
  return [...groups.values()];
}

function isSemanticPublicDataField(name: string): boolean {
  return (
    isSemanticIdentifier(name) ||
    matchesSemanticFieldName(name, ["path", "url", "uri", "key", "token"]) ||
    hasSemanticSuffix(name, [
      "path",
      "url",
      "uri",
      "key",
      "token",
      "ms",
      "secs",
      "seconds",
      "bytes",
    ])
  );
}

function isSemanticIdentifier(name: string): boolean {
  return name === "id" || name.endsWith("_id") || name.endsWith("Id");
}

function isSemanticPublicTypeAlias(name: string): boolean {
  return (
    name === "Id" ||
    name.endsWith("Id") ||
    name.endsWith("ID") ||
    name.endsWith("Path") ||
    name.endsWith("Url") ||
    name.endsWith("URL") ||
    name.endsWith("Uri") ||
    name.endsWith("URI") ||
    name.endsWith("Key") ||
    name.endsWith("Token") ||
    name.endsWith("Ms") ||
    name.endsWith("Secs") ||
    name.endsWith("Seconds") ||
    name.endsWith("Bytes")
  );
}

function isPublicFlagField(name: string): boolean {
  return (
    name === "enabled" ||
    name === "disabled" ||
    startsWithAny(name, ["is_", "has_", "can_", "allow_", "include_", "should_"]) ||
    /^(is|has|can|allow|include|should|enable|disable)[A-Z]/u.test(name)
  );
}

function isPublicFlagTypeAlias(name: string): boolean {
  return (
    name.endsWith("Flag") ||
    name.endsWith("Enabled") ||
    name.endsWith("Disabled") ||
    name.endsWith("Allowed") ||
    name.endsWith("Included")
  );
}

function isStringlyStateField(name: string): boolean {
  return (
    matchesSemanticFieldName(name, [
      "kind",
      "type",
      "status",
      "state",
      "mode",
      "phase",
      "tag",
      "category",
    ]) ||
    hasSemanticSuffix(name, ["kind", "type", "status", "state", "mode", "phase", "tag", "category"])
  );
}

function matchesSemanticFieldName(name: string, names: readonly string[]): boolean {
  return names.includes(name);
}

function hasSemanticSuffix(name: string, suffixes: readonly string[]): boolean {
  return suffixes.some(
    (suffix) => name.endsWith(`_${suffix}`) || endsWithPascalSuffix(name, suffix),
  );
}

function endsWithPascalSuffix(name: string, suffix: string): boolean {
  const pascalSuffix = `${suffix[0]?.toUpperCase() ?? ""}${suffix.slice(1)}`;
  return pascalSuffix.length > 0 && name.endsWith(pascalSuffix);
}

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function rawPrimitiveAliasContractType(contractType: string | undefined): string | undefined {
  return contractType !== undefined &&
    ["string", "number", "boolean", "bigint", "symbol"].includes(contractType)
    ? contractType
    : undefined;
}

function rawStringContractType(contractType: string | undefined): string | undefined {
  return contractType === "string" ? contractType : undefined;
}

function sourceModules(tree: TypeScriptReasoningTree): readonly TypeScriptReasoningModule[] {
  return tree.modules.filter(
    (moduleReport) =>
      moduleReport.isValid &&
      moduleReport.role !== "test" &&
      moduleReport.role !== "declaration" &&
      moduleReport.role !== "config",
  );
}

function findingSortKey(finding: AspTypeScriptFinding): string {
  return `${finding.ruleId}\0${finding.location.path ?? ""}\0${finding.location.line}\0${finding.summary}`;
}

function sourceLineField(sourceLine: string | undefined): { readonly sourceLine?: string } {
  return sourceLine === undefined ? {} : { sourceLine };
}
