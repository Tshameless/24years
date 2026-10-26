import type { FamilyChange } from './collaboration';

export const OUTBOX_STORAGE_PREFIX = '24years.outbox.v1:';

export interface OutboxEntry {
  id: string;
  familyId: string;
  operationId: string;
  change: FamilyChange;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export function outboxStorageKey(familyId: string): string {
  return `${OUTBOX_STORAGE_PREFIX}${familyId}`;
}

export function readOutbox(familyId: string): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(outboxStorageKey(familyId));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is OutboxEntry =>
      Boolean(
        entry &&
          typeof entry.id === 'string' &&
          entry.familyId === familyId &&
          typeof entry.operationId === 'string' &&
          entry.change &&
          typeof entry.change === 'object' &&
          typeof entry.createdAt === 'number',
      ),
    );
  } catch {
    return [];
  }
}

export function writeOutbox(familyId: string, entries: OutboxEntry[]): void {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(outboxStorageKey(familyId));
    } else {
      localStorage.setItem(outboxStorageKey(familyId), JSON.stringify(entries));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function enqueueOutboxEntry(
  familyId: string,
  entry: OutboxEntry,
  maxEntries = 50,
): OutboxEntry[] {
  const current = readOutbox(familyId);
  const filtered = current.filter(
    (item) => item.id !== entry.id && item.operationId !== entry.operationId,
  );
  const updated = [...filtered, entry].slice(-maxEntries);
  writeOutbox(familyId, updated);

  return updated;
}

export function removeOutboxEntry(familyId: string, entryIdOrOperationId: string): OutboxEntry[] {
  const current = readOutbox(familyId);
  const updated = current.filter(
    (item) => item.id !== entryIdOrOperationId && item.operationId !== entryIdOrOperationId,
  );
  writeOutbox(familyId, updated);

  return updated;
}

export function clearFamilyOutbox(familyId: string): void {
  try {
    localStorage.removeItem(outboxStorageKey(familyId));
  } catch {
    // Ignore storage errors
  }
}
