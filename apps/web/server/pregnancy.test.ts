import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './database.ts';
import { ApiError, createService } from './service.ts';
import {
  emptyFamily,
  decodeFamily,
  type PregnancyChange,
  type PregnancyRecord,
} from '../../../packages/domain/src/family.ts';

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
    const vital: PregnancyRecord = {
      id: 'measurement',
      type: 'vital',
      date: before.date,
      time: '08:30',
      context: '晨起',
      metric: 'weight',
      value: 65,
      secondary: null,
      notes: '',
    };
    write(partner, { type: 'pregnancy', before: null, value: vital });
    assert.deepEqual(
      service.snapshot(owner).family!.data.pregnancyRecords!.find((item) => item.id === vital.id),
      vital,
    );
    const vitalSnapshot = service.snapshot(owner).family!;
    for (const invalid of [{ time: '24:00' }, { context: 'a'.repeat(81) }]) {
      assert.throws(
        () => write(owner, { type: 'pregnancy', before: vital, value: { ...vital, ...invalid } }),
        fail(400),
      );
      assert.deepEqual(service.snapshot(owner).family, vitalSnapshot);
    }
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
    const packing = {
      id: 'purchase',
      type: 'packing' as const,
      category: '证件',
      quantity: 2,
      assignee: 'father' as const,
      title: '资料袋',
      date: before.date,
      notes: '',
      completed: false,
    };
    write(partner, { type: 'pregnancy', before: null, value: packing });
    assert.deepEqual(
      service.snapshot(owner).family!.data.pregnancyRecords!.find((item) => item.id === packing.id),
      packing,
    );
    for (const quantity of [0, -1, 1.5, 10000]) {
      assert.throws(
        () => write(owner, { type: 'pregnancy', before: packing, value: { ...packing, quantity } }),
        fail(400),
      );
    }
    const purchase: PregnancyChange = {
      type: 'pregnancy',
      before: packing,
      value: { ...packing, completed: true },
      expense: {
        id: 'packing-purchase',
        title: packing.title,
        date: packing.date,
        kind: 'expense',
        category: '待产准备',
        amountCents: 1234,
        reimbursedCents: 0,
      },
    };
    const purchaseOperation = randomUUID();
    const purchaseBefore = service.snapshot(owner).family!;
    assert.throws(
      () => write(owner, { ...purchase, expense: { ...purchase.expense!, reimbursedCents: 1 } }),
      fail(400),
    );
    assert.deepEqual(service.snapshot(owner).family, purchaseBefore);
    write(owner, purchase, purchaseOperation);
    write(owner, purchase, purchaseOperation);
    assert.equal(
      service
        .snapshot(partner)
        .family!.data.expenses.filter((item) => item.id === 'packing-purchase').length,
      1,
    );
    assert.throws(() => write(partner, purchase), fail(409));
    // Role management is a separate permission path from record validation.
    const care: PregnancyRecord[] = [
      {
        id: 'bonding',
        type: 'bonding',
        date: before.date,
        title: '读诗',
        minutes: 10,
        notes: '一起陪伴',
      },
      {
        id: 'mood', type: 'mood', date: before.date, title: '平静',
        visibility: 'shared', notes: '散步',
      },
      {
        id: 'packing',
        type: 'packing',
        date: before.date,
        title: '资料袋',
        completed: false,
        notes: '玄关',
      },
      {
        id: 'movement',
        type: 'movement',
        date: before.date,
        time: '09:30',
        minutes: 30,
        count: 0,
        notes: '观察记录',
      },
    ];
    for (const value of care) {
      write(partner, { type: 'pregnancy', before: null, value });
      assert.deepEqual(
        service.snapshot(owner).family!.data.pregnancyRecords!.find((item) => item.id === value.id),
        value,
      );
      assert.throws(() => write(owner, { type: 'pregnancy', before: null, value }), fail(409));
    }
    const movement = care.find((item) => item.type === 'movement')!;

    if (movement.type === 'movement') {
      for (const patch of [{ count: -1 }, { count: 1.5 }, { minutes: 0 }, { time: '24:00' }]) {
        assert.throws(
          () =>
            write(owner, { type: 'pregnancy', before: movement, value: { ...movement, ...patch } }),
          fail(400),
        );
      }
      assert.deepEqual(
        service
          .snapshot(partner)
          .family!.data.pregnancyRecords!.find((item) => item.id === movement.id),
        movement,
      );
    }

    assert.throws(() =>
      decodeFamily(
        JSON.stringify({ ...emptyFamily(), pregnancyRecords: [{ ...care[0], minutes: -1 }] }),
      ),
    );
    assert.throws(() =>
      decodeFamily(
        JSON.stringify({ ...emptyFamily(), pregnancyRecords: [{ ...care[1], title: 'invalid' }] }),
      ),
    );
    assert.throws(() =>
      decodeFamily(
        JSON.stringify({ ...emptyFamily(), pregnancyRecords: [{ ...care[2], completed: 'yes' }] }),
      ),
    );
    manage('role', { userId: partner, role: 'viewer' });
    for (const value of care) {
      assert.throws(
        () => write(partner, { type: 'pregnancy', before: value, value: null }),
        fail(403),
      );
    }
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
