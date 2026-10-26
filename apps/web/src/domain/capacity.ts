export const MAX_CLOUD_BYTES = 800000;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

export function familyBytes(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length;
}

/**
 * Size of the legacy `families.data` blob. High-volume collections are stored
 * in relational tables, so they must not consume the profile blob's quota.
 * This keeps the quota useful for metadata while allowing records to grow
 * beyond the original MVP limit.
 */
export function familyBlobBytes(data: object): number {
  const blob = { ...(data as Record<string, unknown>) };
  delete blob.tasks;
  delete blob.expenses;
  delete blob.pregnancyRecords;
  delete blob.children;

  return familyBytes(blob);
}
