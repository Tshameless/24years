import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './database.ts';
import { ApiError, createService } from './service.ts';
import { emptyFamily, type PregnancyChange } from '../src/domain/family.ts';

test('孕期协作支持幂等原子入账、冲突回滚、只读权限和备份恢复', async () => {
  const db = openDatabase(':memory:');

  try {
    const service = createService(db);
    const register = async (username: string) =>
      (
        await service.authenticate(
          { username, password: 'safe-password-2026', nickname: username },
          true,
        )
      ).state.user!.id;
    const owner = await register('pregnancy_owner');
    const partner = await register('pregnancy_partner');
    const family = service.mutate(owner, 'create', {
      mode: 'couple',
      familyRole: 'mother',
      data: emptyFamily(),
    }).family!;
    const manage = (action: string, extra = {}) =>
      service.mutate(owner, action, {
        familyId: family.id,
        revision: service.snapshot(owner).family!.revision,
        ...extra,
      });
    const code = manage('invite').invitation!.code;
    service.mutate(partner, 'join', { code, familyRole: 'father' });
    const write = (userId: string, change: PregnancyChange, operationId = randomUUID()) =>
      service.mutate(userId, 'records', { familyId: family.id, change, operationId });
    const before = {
      id: 'visit',
      type: 'checkup' as const,
      title: '产检',
      date: '2026-10-21',
      notes: '',
      completed: false,
    };
    write(partner, { type: 'pregnancy', before: null, value: before });
    const change: PregnancyChange = {
      type: 'pregnancy',
      before,
      value: { ...before, completed: true },
      expense: {
        id: 'checkup-visit',
        title: '产检',
        date: before.date,
        kind: 'expense',
        category: '产检医疗',
        amountCents: 10000,
        reimbursedCents: 1000,
      },
    };
    const fail = (status: number) => (e: unknown) => e instanceof ApiError && e.status === status;
    const previous = service.snapshot(owner).family!;
    assert.throws(
      () => write(owner, { ...change, expense: { ...change.expense!, reimbursedCents: 20000 } }),
      fail(400),
    );
    assert.deepEqual(service.snapshot(owner).family, previous);
    const operationId = randomUUID();
    write(owner, change, operationId);
    write(owner, change, operationId);
    assert.equal(service.snapshot(partner).family!.data.expenses.length, 1);
    assert.equal(service.snapshot(partner).family!.revision, previous.revision + 1);
    assert.throws(() => write(partner, change), fail(409));
    // Role management is a separate permission path from record validation.
    manage('role', { userId: partner, role: 'viewer' });
    assert.throws(
      () =>
        write(partner, {
          type: 'pregnancy',
          before: null,
          value: {
            id: 'vital',
            type: 'vital',
            date: before.date,
            metric: 'weight',
            value: 60,
            secondary: null,
            notes: '',
          },
        }),
      fail(403),
    );
    const backup = service.snapshot(owner).family!.data;
    manage('import', { data: emptyFamily(), operationId: randomUUID() });
    manage('import', { data: backup, operationId: randomUUID() });
    assert.deepEqual(
      service.snapshot(partner).family!.data.pregnancyRecords,
      backup.pregnancyRecords,
    );
    assert.deepEqual(service.snapshot(partner).family!.data.expenses, backup.expenses);
  } finally {
    db.close();
  }
});
