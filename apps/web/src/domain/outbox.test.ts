import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFamilyOutbox,
  enqueueOutboxEntry,
  outboxStorageKey,
  readOutbox,
  removeOutboxEntry,
  writeOutbox,
  type OutboxEntry,
} from './outbox';

describe('outbox', () => {
  const familyId = 'family-test-123';
  const sampleEntry: OutboxEntry = {
    id: 'outbox-1',
    familyId,
    operationId: 'op-1',
    change: {
      type: 'task',
      before: null,
      value: {
        id: 'task-1',
        title: '测试离线任务',
        date: '2026-10-26',
        time: '08:00',
        repeat: 'once',
        completedDates: [],
      },
    },
    createdAt: Date.now(),
    retryCount: 0,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('reads empty list for non-existent outbox and ignores malformed storage', () => {
    expect(readOutbox(familyId)).toEqual([]);
    localStorage.setItem(outboxStorageKey(familyId), '{broken-json');
    expect(readOutbox(familyId)).toEqual([]);
    localStorage.setItem(outboxStorageKey(familyId), JSON.stringify([{ invalid: true }]));
    expect(readOutbox(familyId)).toEqual([]);
  });

  it('writes and reads outbox entries properly', () => {
    writeOutbox(familyId, [sampleEntry]);
    expect(readOutbox(familyId)).toEqual([sampleEntry]);
    writeOutbox(familyId, []);
    expect(localStorage.getItem(outboxStorageKey(familyId))).toBeNull();
  });

  it('enqueues new entries and deduplicates by operationId', () => {
    enqueueOutboxEntry(familyId, sampleEntry);
    expect(readOutbox(familyId)).toHaveLength(1);

    const duplicateOp: OutboxEntry = {
      ...sampleEntry,
      id: 'outbox-2',
      retryCount: 1,
    };
    enqueueOutboxEntry(familyId, duplicateOp);
    const entries = readOutbox(familyId);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe('outbox-2');
    expect(entries[0]!.retryCount).toBe(1);
  });

  it('removes entries by id or operationId and clears family outbox', () => {
    enqueueOutboxEntry(familyId, sampleEntry);
    removeOutboxEntry(familyId, 'op-1');
    expect(readOutbox(familyId)).toEqual([]);

    enqueueOutboxEntry(familyId, sampleEntry);
    clearFamilyOutbox(familyId);
    expect(readOutbox(familyId)).toEqual([]);
  });
});
