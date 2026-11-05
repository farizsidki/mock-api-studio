export function createId(prefix) {
  if (typeof prefix !== "string" || prefix.length === 0) {
    throw new Error("prefix is required");
  }
  return `${prefix}_${crypto.randomUUID()}`;
}
