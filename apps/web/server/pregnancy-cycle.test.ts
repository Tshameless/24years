import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './database.ts';
import { ApiError, createService } from './service.ts';
import { emptyFamily, type PregnancyChange, type PregnancyRecord } from '../../../packages/domain/src/family.ts';

test('生命周期同步、角色权限、并发、幂等与完整恢复', async () => {
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
    const owner = await register('cycle_owner');
    const partner = await register('cycle_partner');
    const family = service.mutate(owner, 'create', {
      mode: 'couple',
      familyRole: 'mother',
      data: {
        ...emptyFamily(),
        profile: {
          name: '家', nickname: '我', dueDate: '2026-01-10', quietMode: false,
          familyMode: 'couple', parentRole: 'mother',
        },
      },
    }).family!;
    const manage = (action: string, extra = {}) =>
      service.mutate(owner, action, {
        familyId: family.id,
        revision: service.snapshot(owner).family!.revision,
        ...extra,
      });
    service.mutate(partner, 'join', {
      code: manage('invite').invitation!.code,
      familyRole: 'father',
    });
    const write = (userId: string, change: PregnancyChange, operationId = randomUUID()) =>
      service.mutate(userId, 'records', { familyId: family.id, change, operationId });
    const birth: PregnancyRecord = {
      id: 'pregnancy-outcome',
      type: 'outcome',
      kind: 'birth',
      date: '2026-01-01',
      mode: 'vaginal',
      notes: '',
    };
    const handoff: PregnancyRecord = {
      id: 'postpartum-plan',
      type: 'postpartum',
      date: '2026-01-02',
      supportPerson: '家人',
      recovery: '休息',
      feeding: '',
      questions: '',
      notes: '',
    };
    const change: PregnancyChange = { type: 'pregnancy', before: null, value: birth };
    const operationId = randomUUID();
    write(partner, change, operationId);
    const delivered = service.snapshot(owner).family!;
    write(partner, change, operationId);
    assert.deepEqual(service.snapshot(owner).family, delivered);
    assert.throws(
      () => write(owner, change),
      (e: unknown) => e instanceof ApiError && e.status === 409,
    );
    write(owner, { type: 'pregnancy', before: null, value: handoff });
    const backup = service.snapshot(partner).family!.data;
    assert.throws(() => write(owner, { type: 'pregnancy', before: birth, value: null }));
    assert.deepEqual(service.snapshot(partner).family!.data, backup);
    manage('role', { userId: partner, role: 'viewer' });
    for (const record of [birth, handoff]) {
      assert.throws(
        () => write(partner, { type: 'pregnancy', before: record, value: null }),
        (e: unknown) => e instanceof ApiError && e.status === 403,
      );
    }
    manage('import', { data: emptyFamily(), operationId: randomUUID() });
    manage('import', { data: backup, operationId: randomUUID() });
    assert.deepEqual(service.snapshot(partner).family!.data, backup);
    write(owner, { type: 'pregnancy', before: handoff, value: null });
    write(owner, {
      type: 'pregnancy',
      before: birth,
      value: {
        id: 'pregnancy-outcome',
        type: 'outcome',
        kind: 'ended',
        date: birth.date,
        notes: '',
      },
    });
    assert.equal(service.snapshot(partner).family!.data.profile!.quietMode, true);
  } finally {
    db.close();
  }
});
