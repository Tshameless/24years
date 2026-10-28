import type { FamilyChange } from './collaboration';

export const OUTBOX_STORAGE_PREFIX = '24years.outbox.v2:';

export interface OutboxEntry {
  id: string;
  familyId: string;
  operationId: string;
  change: FamilyChange;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export class OutboxCapacityError extends Error {
  constructor() {
    super('离线待同步队列已满。');
    this.name = 'OutboxCapacityError';
  }
}

export class OutboxStorageError extends Error {
  constructor() {
    super('离线待同步记录无法保存到本机。');
    this.name = 'OutboxStorageError';
  }
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
    throw new OutboxStorageError();
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

  if (filtered.length >= maxEntries) {
    throw new OutboxCapacityError();
  }

  const updated = [...filtered, entry];
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
