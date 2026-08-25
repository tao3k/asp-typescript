export function decodeJsonObjectEnvelope<T>(input: string, envelopeName: string): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${envelopeName} must be valid JSON: ${detail}`);
  }

  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error(`${envelopeName} must be a JSON object`);
  }

  return decoded as T;
}
