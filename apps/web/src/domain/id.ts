/** Generate UUID v4 using the browser's secure-context API. */
export function createId(): string {
  return crypto.randomUUID();
}
