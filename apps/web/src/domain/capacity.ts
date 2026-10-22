export const MAX_CLOUD_BYTES = 800000;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

export function familyBytes(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length;
}
