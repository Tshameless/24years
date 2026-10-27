export const MAX_CLOUD_BYTES = 800000;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export const MAX_FAMILY_COLLECTION_RECORDS = 10000;

export function withinFamilyCollectionLimits(data: {
  tasks: readonly unknown[];
  expenses: readonly unknown[];
  pregnancyRecords?: readonly unknown[];
  children?: readonly { growthRecords?: readonly unknown[] }[];
}): boolean {
  return (
    data.tasks.length <= MAX_FAMILY_COLLECTION_RECORDS &&
    data.expenses.length <= MAX_FAMILY_COLLECTION_RECORDS &&
    (data.pregnancyRecords?.length ?? 0) <= MAX_FAMILY_COLLECTION_RECORDS &&
    (data.children?.length ?? 0) <= MAX_FAMILY_COLLECTION_RECORDS &&
    (data.children ?? []).reduce((total, child) => total + (child.growthRecords?.length ?? 0), 0) <=
      MAX_FAMILY_COLLECTION_RECORDS
  );
}

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
