import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database.ts';
import { ApiError, createService, hash } from './service.ts';
import { createApplication } from './http.ts';
import { emptyFamily, type FamilyTask } from '../src/domain/family.ts';

async function fixture() {
  const db = openDatabase(':memory:');
  const service = createService(db);
  const register = async (username: string) =>
    (
      await service.authenticate(
        { username, password: 'safe-password-2026', nickname: username },
        true,
      )
    ).state.user!.id;
  const owner = await register('owner');
  const partner = await register('partner');
  service.mutate(owner, 'create', { mode: 'couple', familyRole: 'mother', data: emptyFamily() });
  const manage = (action: string, extra = {}) => {
    const family = service.snapshot(owner).family!;

    return service.mutate(owner, action, {
      familyId: family.id,
      revision: family.revision,
      ...extra,
    });
  };
  const familyId = service.snapshot(owner).family!.id;
  const change = (
    userId: string,
    type: string,
    value: unknown,
    before: unknown,
    operationId = randomUUID(),
  ) =>
    service.mutate(userId, 'records', { familyId, change: { type, value, before }, operationId });

  return { db, service, owner, partner, register, manage, change, familyId };
}

const task = (title: string): FamilyTask => ({
  id: randomUUID(),
  title,
  date: '2026-10-09',
  time: '09:00',
  repeat: 'daily',
  completedDates: [],
});
const failsWith = (status: number) => (error: unknown) =>
  error instanceof ApiError && error.status === status;

test('每周计划服务端校验、共享读取与周期修改保留历史', async () => {
  const f = await fixture();

  try {
    const weekly: FamilyTask = {
      ...task('每周计划'),
      repeat: 'weekly',
      weekdays: [1, 3, 5],
      assignee: 'father',
      endDate: '2026-11-01',
    };
    f.change(f.owner, 'task', weekly, null);
    assert.deepEqual(f.service.snapshot(f.owner).family!.data.tasks[0], weekly);
    const code = f.manage('invite').invitation!.code;
    f.service.mutate(f.partner, 'join', { code, familyRole: 'father' });
    assert.deepEqual(f.service.snapshot(f.partner).family!.data.tasks[0], weekly);
    for (const invalid of [
      { ...weekly, assignee: 'admin' },
      { ...weekly, endDate: '2026-10-01' },
    ]) {
      assert.throws(() => f.change(f.owner, 'task', invalid, weekly), failsWith(400));
    }
    for (const weekdays of [[], [0], [8], [1, 1], ['3']]) {
      assert.throws(
        () => f.change(f.owner, 'task', { ...weekly, weekdays }, weekly),
        failsWith(400),
      );
    }
    const completed = { ...weekly, completedDates: ['2026-10-09'] };
    f.change(f.owner, 'task', completed, weekly);
    const { weekdays: _weekdays, ...rest } = completed;
    assert.deepEqual(_weekdays, [1, 3, 5]);
    f.change(f.owner, 'task', { ...rest, repeat: 'daily' }, completed);
    assert.deepEqual(f.service.snapshot(f.owner).family!.data.tasks[0]!.completedDates, [
      '2026-10-09',
    ]);
  } finally {
    f.db.close();
  }
});

test('建档保存家庭类型和父母身份，身份不改变权限且错误加入不消耗邀请', async () => {
  const f = await fixture();

  try {
    const newcomer = await f.register('newparent');
    assert.throws(
      () => f.service.mutate(newcomer, 'create', { mode: 'couple', data: emptyFamily() }),
      failsWith(400),
    );
    const profile = {
      name: '爸爸的家',
      nickname: '爸爸',
      dueDate: '2027-01-26',
      quietMode: false,
      familyMode: 'couple',
      parentRole: 'father',
    };
    const created = f.service.mutate(newcomer, 'create', {
      mode: 'couple',
      familyRole: 'father',
      data: { ...emptyFamily(), profile },
    }).family!;
    assert.equal(created.members[0].familyRole, 'father');
    assert.equal(created.members[0].role, 'owner');
    assert.equal(created.data.profile!.parentRole, 'father');
    const code = f.service.mutate(newcomer, 'invite', {
      familyId: created.id,
      revision: created.revision,
    }).invitation!.code;
    assert.throws(
      () => f.service.mutate(f.partner, 'join', { code, familyRole: 'father' }),
      failsWith(409),
    );
    assert.throws(
      () => f.service.mutate(f.partner, 'join', { code, familyRole: 'single_parent' }),
      failsWith(400),
    );
    const paired = f.service.mutate(f.partner, 'join', { code, familyRole: 'mother' }).family!;
    assert.equal(paired.members.find((item) => item.id === f.partner)!.familyRole, 'mother');
    assert.equal(paired.members.find((item) => item.id === f.partner)!.role, 'editor');
    assert.throws(
      () =>
        f.service.mutate(newcomer, 'records', {
          familyId: paired.id,
          operationId: randomUUID(),
          change: {
            type: 'profile',
            before: paired.data.profile,
            value: { ...paired.data.profile, familyMode: 'single', parentRole: 'single_parent' },
          },
        }),
      failsWith(409),
    );
    assert.equal(f.service.snapshot(newcomer).family!.mode, 'couple');
  } finally {
    f.db.close();
  }
});

test('档案中切换家庭类型与身份原子保存，旧邀请码撤销', async () => {
  const f = await fixture();

  try {
    const code = f.manage('invite').invitation!.code;
    const profile = {
      name: '独立小家',
      nickname: '小叶',
      dueDate: '2027-01-26',
      quietMode: false,
      familyMode: 'single',
      parentRole: 'single_parent',
    };
    f.change(f.owner, 'profile', profile, null);
    const family = f.service.snapshot(f.owner).family!;
    assert.equal(family.mode, 'single');
    assert.equal(family.members[0].familyRole, 'single_parent');
    assert.equal(family.inviteExpiresAt, null);
    assert.throws(
      () => f.service.mutate(f.partner, 'join', { code, familyRole: 'father' }),
      failsWith(404),
    );
    f.change(
      f.owner,
      'profile',
      { ...profile, familyMode: 'couple', parentRole: 'father' },
      family.data.profile,
    );
    assert.equal(f.service.snapshot(f.owner).family!.mode, 'couple');
    assert.equal(f.service.snapshot(f.owner).family!.members[0].familyRole, 'father');
  } finally {
    f.db.close();
  }
});

test('旧数据库升级保留记录和权限，多人成员不猜测父母身份，可自行补选', async () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-migration-'));
  const file = join(directory, 'old.sqlite');
  let db = openDatabase(file);

  try {
    let service = createService(db);
    const owner = (
      await service.authenticate(
        { username: 'oldowner', nickname: '旧成员', password: 'old-password-2026' },
        true,
      )
    ).state.user!.id;
    service.mutate(owner, 'create', {
      mode: 'couple',
      familyRole: 'father',
      data: { ...emptyFamily(), tasks: [task('旧计划')] },
    });
    db.close();
    const legacy = new DatabaseSync(file);
    legacy.exec(
      'ALTER TABLE members DROP COLUMN family_role; ALTER TABLE accounts DROP COLUMN recovery_hash; DROP TABLE import_backups;',
    );
    legacy.close();
    db = openDatabase(file);
    service = createService(db);
    const family = service.snapshot(owner).family!;
    assert.equal(family.members[0].familyRole, null);
    assert.equal(family.members[0].role, 'owner');
    assert.equal(family.data.tasks[0].title, '旧计划');
    service.mutate(owner, 'identity', {
      familyId: family.id,
      revision: family.revision,
      familyRole: 'father',
    });
    db.close();
    db = openDatabase(file);
    service = createService(db);
    assert.equal(service.snapshot(owner).family!.members[0].familyRole, 'father');
  } finally {
    db.close();
    rmSync(directory, { recursive: true });
  }
});

test('邀请仅可使用一次、限制两人、支持撤销和过期', async () => {
  const f = await fixture();

  try {
    const first = f.manage('invite').invitation!;
    f.manage('revoke');
    assert.throws(
      () => f.service.mutate(f.partner, 'join', { code: first.code, familyRole: 'father' }),
      failsWith(404),
    );
    const expired = f.manage('invite').invitation!;
    f.db.prepare('UPDATE invites SET expires_at = 0 WHERE code_hash = ?').run(hash(expired.code));
    assert.throws(
      () => f.service.mutate(f.partner, 'join', { code: expired.code, familyRole: 'father' }),
      failsWith(404),
    );
    const code = f.manage('invite').invitation!.code;
    const third = await f.register('third');
    const results = await Promise.allSettled(
      [f.partner, third].map(async (id) =>
        f.service.mutate(id, 'join', { code, familyRole: 'father' }),
      ),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(f.service.snapshot(f.owner).family!.members.length, 2);
    assert.throws(() => f.manage('mode', { mode: 'single' }), failsWith(409));
    assert.throws(() => f.manage('invite'), failsWith(409));
  } finally {
    f.db.close();
  }
});

test('权限由服务端强制执行、撤销成员立即失去访问、跨家庭隔离', async () => {
  const f = await fixture();

  try {
    f.service.mutate(f.partner, 'join', {
      code: f.manage('invite').invitation!.code,
      familyRole: 'father',
    });
    f.change(f.partner, 'task', task('伴侣计划'), null);
    assert.throws(
      () =>
        f.change(
          f.partner,
          'profile',
          { name: '越权', nickname: '人', dueDate: '2027-01-26', quietMode: false },
          null,
        ),
      failsWith(403),
    );
    assert.throws(
      () =>
        f.service.mutate(f.partner, 'invite', {
          familyId: f.familyId,
          revision: f.service.snapshot(f.owner).family!.revision,
        }),
      failsWith(403),
    );
    f.manage('role', { userId: f.partner, role: 'viewer' });
    assert.throws(() => f.change(f.partner, 'task', task('只读写入'), null), failsWith(403));
    const stranger = await f.register('stranger');
    assert.equal(f.service.snapshot(stranger).family, null);
    assert.throws(() => f.change(stranger, 'task', task('跨家庭写入'), null), failsWith(403));
    f.manage('remove', { userId: f.partner });
    assert.equal(f.service.snapshot(f.partner).family, null);
    assert.throws(() => f.change(f.partner, 'task', task('已移除'), null), failsWith(403));
    assert.equal(f.service.snapshot(f.owner).family!.data.tasks.length, 1);
    f.manage('mode', { mode: 'single' });
    assert.equal(f.service.snapshot(f.owner).family!.mode, 'single');
  } finally {
    f.db.close();
  }
});

test('独立记录可合并，同一记录并发保护，重试幂等且无重复记账', async () => {
  const f = await fixture();

  try {
    f.service.mutate(f.partner, 'join', {
      code: f.manage('invite').invitation!.code,
      familyRole: 'father',
    });
    const original = task('共同计划');
    const operation = randomUUID();
    f.change(f.owner, 'task', original, null, operation);
    f.change(f.owner, 'task', original, null, operation);
    assert.equal(f.service.snapshot(f.owner).family!.data.tasks.length, 1);
    f.change(f.partner, 'task', task('独立计划'), null);
    const edited = { ...original, title: '伴侣已修改' };
    f.change(f.partner, 'task', edited, original);
    assert.throws(
      () => f.change(f.owner, 'task', { ...original, title: '旧草稿' }, original),
      failsWith(409),
    );
    assert.throws(() => f.change(f.owner, 'task', null, original), failsWith(409));
    assert.equal(
      f.service.snapshot(f.owner).family!.data.tasks.find((item) => item.id === original.id)!.title,
      edited.title,
    );
    assert.throws(
      () => f.change(f.owner, 'task', task('篡改操作'), null, operation),
      failsWith(409),
    );
    const expense = {
      id: randomUUID(),
      title: '产检',
      date: '2026-10-09',
      kind: 'expense',
      category: '产检医疗',
      amountCents: 10010,
      reimbursedCents: 2005,
    };
    const expenseOp = randomUUID();
    f.change(f.partner, 'expense', expense, null, expenseOp);
    f.change(f.partner, 'expense', expense, null, expenseOp);
    f.change(f.owner, 'expense', { ...expense, amountCents: 9000 }, expense);
    assert.throws(
      () => f.change(f.owner, 'expense', { ...expense, reimbursedCents: 20000 }, expense),
      failsWith(400),
    );
    assert.equal(f.service.snapshot(f.partner).family!.data.expenses.length, 1);
  } finally {
    f.db.close();
  }
});

test('仅查看成员可主动退出，历史记录保留，管理员不能退出丢弃家庭', async () => {
  const f = await fixture();

  try {
    f.service.mutate(f.partner, 'join', {
      code: f.manage('invite').invitation!.code,
      familyRole: 'father',
    });
    f.change(f.partner, 'task', task('退出前的计划'), null);
    const family = f.manage('role', { userId: f.partner, role: 'viewer' }).family!;
    assert.throws(
      () => f.service.mutate(f.owner, 'leave', { familyId: family.id, revision: family.revision }),
      failsWith(403),
    );
    f.service.mutate(f.partner, 'leave', { familyId: family.id, revision: family.revision });
    assert.equal(f.service.snapshot(f.partner).family, null);
    assert.equal(f.service.snapshot(f.owner).family!.data.tasks.length, 1);
    assert.equal(f.service.snapshot(f.owner).family!.members.length, 1);
  } finally {
    f.db.close();
  }
});

test('数据库重启后账号、会话与家庭数据仍在，旧档案上传保留数据', async () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-api-'));
  const file = join(directory, 'test.sqlite');
  let db = openDatabase(file);

  try {
    let service = createService(db);
    const { token, state } = await service.authenticate(
      { username: 'persist', nickname: '测试', password: 'persist-password' },
      true,
    );
    const data = { ...emptyFamily(), tasks: [task('旧计划')] };
    service.mutate(state.user!.id, 'create', { mode: 'single', data });
    db.close();
    db = openDatabase(file);
    service = createService(db);
    assert.equal(service.userForToken(token), state.user!.id);
    assert.equal(service.snapshot(state.user!.id).family!.data.tasks[0].title, '旧计划');
    const login = await service.authenticate(
      { username: 'PERSIST', password: 'persist-password' },
      false,
    );
    assert.equal(login.state.family!.data.tasks.length, 1);
    service.logout(token);
    assert.equal(service.userForToken(token), null);
  } finally {
    db.close();
    rmSync(directory, { recursive: true });
  }
});

test('HTTP 会话 cookie、CSRF 来源检查、未授权写入和登录限制', async () => {
  const app = createApplication({ database: ':memory:', origin: 'http://trusted.test' });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown, headers = {}) =>
    fetch(`${base}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-24Years-Client': 'web', ...headers },
      body: JSON.stringify(body),
    });

  try {
    assert.equal((await post('family/create', {})).status, 401);
    assert.equal((await post('register', {}, { Origin: 'http://evil.test' })).status, 403);
    const credentials = { username: 'httpuser', nickname: '测试', password: 'http-password' };
    const registered = await post('register', credentials);
    assert.equal(registered.status, 200);
    const cookie = registered.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    const session = await fetch(`${base}/api/session`, {
      headers: { Cookie: cookie.split(';')[0] },
    });
    assert.equal((await session.json()).user.username, credentials.username);
    assert.equal((await post('login', { ...credentials, password: 'wrong-password' })).status, 401);

    for (let index = 0; index < 11; index += 1) {
      await post('login', { username: 'limited', password: 'wrong-password' });
    }

    assert.equal(
      (await post('login', { username: 'limited', password: 'wrong-password' })).status,
      401,
    );
    assert.equal(
      (await post('login', { username: 'limited', password: 'wrong-password' })).status,
      429,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      app.server.close((error) => (error ? reject(error) : resolve())),
    );
    app.db.close();
  }
});

test('恢复密钥仅存摘要、更新后旧密钥失效，并发恢复仅一次成功且会话全部撤销', async () => {
  const db = openDatabase(':memory:');
  const service = createService(db);

  try {
    const original = { username: 'recoverable', nickname: '小叶', password: 'old-password-2026' };
    const registered = await service.authenticate(original, true);
    const userId = registered.state.user!.id;
    const firstKey = registered.state.recoveryKey!;
    assert.match(firstKey, /^[\w-]{43}$/);
    assert.equal(
      (
        db.prepare('SELECT recovery_hash FROM accounts WHERE id = ?').get(userId) as {
          recovery_hash: string | null;
        }
      ).recovery_hash,
      hash(firstKey),
    );
    assert.equal('recoveryKey' in service.snapshot(userId), false);
    const another = await service.authenticate(original, false);
    await assert.rejects(
      () => service.rotateRecovery(userId, { password: 'wrong-password' }),
      failsWith(400),
    );
    const rotated = await service.rotateRecovery(userId, { password: original.password });
    await assert.rejects(
      () =>
        service.recover({
          username: original.username,
          recoveryKey: firstKey,
          password: 'new-password-2026',
        }),
      failsWith(400),
    );
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        service.recover({
          username: original.username,
          recoveryKey: rotated.recoveryKey,
          password: 'new-password-2026',
        }),
      ),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const recovered = results.find((result) => result.status === 'fulfilled')!;
    assert.equal(recovered.status, 'fulfilled');
    const nextKey = recovered.value.recoveryKey;
    assert.match(nextKey, /^[\w-]{43}$/);
    assert.notEqual(nextKey, rotated.recoveryKey);
    assert.equal(service.userForToken(registered.token), null);
    assert.equal(service.userForToken(another.token), null);
    await assert.rejects(() => service.authenticate(original, false), failsWith(401));
    assert.equal(
      (await service.authenticate({ ...original, password: 'new-password-2026' }, false)).state
        .user!.id,
      userId,
    );
    assert.equal(
      (
        db.prepare('SELECT recovery_hash FROM accounts WHERE id = ?').get(userId) as {
          recovery_hash: string | null;
        }
      ).recovery_hash,
      hash(nextKey),
    );
    await assert.rejects(
      () =>
        service.recover({
          username: original.username,
          recoveryKey: rotated.recoveryKey,
          password: 'another-password',
        }),
      failsWith(400),
    );
    const nextRecovery = await service.recover({
      username: original.username,
      recoveryKey: nextKey,
      password: 'another-password',
    });
    assert.notEqual(nextRecovery.recoveryKey, nextKey);
  } finally {
    db.close();
  }
});

test('已登录修改密码保留当前会话并撤销其他会话', async () => {
  const db = openDatabase(':memory:');
  const service = createService(db);
  const original = { username: 'changeable', nickname: '小改', password: 'old-password-2026' };

  try {
    const current = await service.authenticate(original, true);
    const other = await service.authenticate(original, false);
    const userId = current.state.user!.id;

    const state = await service.changePassword(userId, current.token, {
      currentPassword: original.password,
      newPassword: 'new-password-2026',
    });
    assert.equal(state.user!.id, userId);
    assert.equal(service.userForToken(current.token), userId);
    assert.equal(service.userForToken(other.token), null);
    await assert.rejects(() => service.authenticate(original, false), failsWith(401));
    assert.equal(
      (await service.authenticate({ ...original, password: 'new-password-2026' }, false)).state
        .user!.id,
      userId,
    );
  } finally {
    db.close();
  }
});

test('共享档案导入需管理员、拒绝过时预览，原子备份且重试不重复替换', async () => {
  const f = await fixture();

  try {
    f.service.mutate(f.partner, 'join', {
      code: f.manage('invite').invitation!.code,
      familyRole: 'father',
    });
    const before = f.service.snapshot(f.owner).family!;
    const body = {
      familyId: before.id,
      revision: before.revision,
      operationId: randomUUID(),
      data: {
        ...emptyFamily(),
        tasks: [task('恢复的计划')],
        profile: {
          name: '备份家庭',
          nickname: '小叶',
          dueDate: '2027-01-26',
          quietMode: false,
          familyMode: 'single',
          parentRole: 'single_parent',
        },
      },
    };
    assert.throws(() => f.service.mutate(f.partner, 'import', body), failsWith(403));
    assert.throws(() => f.service.mutate(f.partner, 'import-backup', body), failsWith(403));
    f.change(f.partner, 'task', task('预览后新增'), null);
    assert.throws(() => f.service.mutate(f.owner, 'import', body), failsWith(409));
    const latest = f.service.snapshot(f.owner).family!;
    const currentBody = { ...body, revision: latest.revision };
    const imported = f.service.mutate(f.owner, 'import', currentBody).family!;
    assert.equal(imported.data.tasks[0].title, '恢复的计划');
    assert.equal(imported.mode, 'couple');
    assert.equal(imported.data.profile!.parentRole, 'mother');
    assert.deepEqual(imported.members, latest.members);
    assert.deepEqual(f.service.mutate(f.owner, 'import-backup', body).backupData, latest.data);
    f.change(f.partner, 'task', task('导入后新增'), null);
    f.service.mutate(f.owner, 'import', currentBody);
    assert.equal(f.service.snapshot(f.owner).family!.data.tasks.length, 2);
    assert.deepEqual(f.service.mutate(f.owner, 'import-backup', body).backupData, latest.data);
    assert.throws(
      () => f.service.mutate(f.owner, 'import', { ...currentBody, data: emptyFamily() }),
      failsWith(409),
    );
    assert.throws(
      () =>
        f.service.mutate(f.owner, 'import', {
          ...currentBody,
          revision: f.service.snapshot(f.owner).family!.revision,
          operationId: randomUUID(),
          data: { bad: true },
        }),
      failsWith(400),
    );
    assert.equal(f.service.snapshot(f.owner).family!.data.tasks.length, 2);
  } finally {
    f.db.close();
  }
});

test('注销先核对密码和家庭版本，管理员注销将家庭交给剩余成员', async () => {
  const f = await fixture();

  try {
    f.service.mutate(f.partner, 'join', {
      code: f.manage('invite').invitation!.code,
      familyRole: 'father',
    });
    f.change(
      f.owner,
      'profile',
      {
        name: '一起的家',
        nickname: '原管理员',
        dueDate: '2027-01-26',
        quietMode: false,
        familyMode: 'couple',
        parentRole: 'mother',
      },
      null,
    );
    f.change(f.partner, 'task', task('共享历史'), null);
    const family = f.service.snapshot(f.owner).family!;
    const body = {
      password: 'safe-password-2026',
      confirmation: 'owner',
      familyId: family.id,
      revision: family.revision,
    };
    await assert.rejects(
      () => f.service.deleteAccount(f.owner, { ...body, password: 'wrong-password' }),
      failsWith(400),
    );
    await assert.rejects(
      () => f.service.deleteAccount(f.owner, { ...body, confirmation: 'partner' }),
      failsWith(400),
    );
    await assert.rejects(
      () => f.service.deleteAccount(f.owner, { ...body, revision: family.revision - 1 }),
      failsWith(409),
    );
    f.manage('role', { userId: f.partner, role: 'viewer' });
    await f.service.deleteAccount(f.owner, {
      ...body,
      revision: f.service.snapshot(f.owner).family!.revision,
    });
    const remaining = f.service.snapshot(f.partner).family!;
    assert.equal(remaining.members.length, 1);
    assert.equal(remaining.members[0].role, 'owner');
    assert.equal(remaining.data.tasks[0].title, '共享历史');
    assert.equal(remaining.data.profile!.parentRole, 'father');
    assert.equal(remaining.data.profile!.nickname, 'partner');
    assert.equal(f.db.prepare('SELECT id FROM accounts WHERE id = ?').get(f.owner), undefined);
    assert.equal(
      f.db.prepare('SELECT user_id FROM sessions WHERE user_id = ?').get(f.owner),
      undefined,
    );
    assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length, 0);
    await f.service.deleteAccount(f.partner, {
      password: 'safe-password-2026',
      confirmation: 'partner',
      familyId: remaining.id,
      revision: remaining.revision,
    });
    assert.equal(f.db.prepare('SELECT id FROM families').all().length, 0);
    assert.equal(f.db.prepare('SELECT user_id FROM receipts').all().length, 0);
  } finally {
    f.db.close();
  }
});

test('普通成员注销保留家庭和历史，唯一成员注销清除家庭及导入前副本', async () => {
  const f = await fixture();

  try {
    f.service.mutate(f.partner, 'join', {
      code: f.manage('invite').invitation!.code,
      familyRole: 'father',
    });
    f.change(f.partner, 'task', task('保留历史'), null);
    let family = f.service.snapshot(f.partner).family!;
    await f.service.deleteAccount(f.partner, {
      password: 'safe-password-2026',
      confirmation: 'partner',
      familyId: family.id,
      revision: family.revision,
    });
    family = f.service.snapshot(f.owner).family!;
    assert.equal(family.members[0].role, 'owner');
    assert.equal(family.data.tasks[0].title, '保留历史');
    f.service.mutate(f.owner, 'import', {
      familyId: family.id,
      revision: family.revision,
      operationId: randomUUID(),
      data: emptyFamily(),
    });
    family = f.service.snapshot(f.owner).family!;
    assert.equal(f.db.prepare('SELECT family_id FROM import_backups').all().length, 1);
    await f.service.deleteAccount(f.owner, {
      password: 'safe-password-2026',
      confirmation: 'owner',
      familyId: family.id,
      revision: family.revision,
    });
    assert.equal(f.db.prepare('SELECT family_id FROM import_backups').all().length, 0);
    assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    f.db.close();
  }
});

test('恢复与注销 HTTP 接口限制尝试次数、检查来源并清除会话 Cookie', async () => {
  const app = createApplication({
    database: ':memory:',
    origin: 'https://family.test',
    secureCookie: true,
  });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-24Years-Client': 'web',
        Origin: 'https://family.test',
        ...headers,
      },
      body: JSON.stringify(body),
    });

  try {
    assert.equal((await post('account/delete', {})).status, 401);
    assert.equal((await post('recover', {}, { Origin: 'https://evil.test' })).status, 403);
    const credentials = {
      username: 'http_recovery',
      nickname: '恢复测试',
      password: 'initial-password',
    };
    const registration = await post('register', credentials);
    const cookie = registration.headers.get('set-cookie')!.split(';')[0];
    assert.match(registration.headers.get('set-cookie')!, /Secure/);
    const registered = await registration.json();
    const reset = await post('recover', {
      username: credentials.username,
      recoveryKey: registered.recoveryKey,
      password: 'replacement-password',
    });
    assert.equal(reset.status, 200);
    const resetState = await reset.json();
    assert.match(resetState.recoveryKey, /^[\w-]{43}$/);
    assert.notEqual(resetState.recoveryKey, registered.recoveryKey);
    assert.match(reset.headers.get('set-cookie')!, /Max-Age=0/);
    assert.equal(
      (await post('account/recovery', { password: credentials.password }, { Cookie: cookie }))
        .status,
      401,
    );
    const loggedIn = await post('login', { ...credentials, password: 'replacement-password' });
    const nextCookie = loggedIn.headers.get('set-cookie')!.split(';')[0];
    const deleted = await post(
      'account/delete',
      {
        password: 'replacement-password',
        confirmation: credentials.username,
        familyId: null,
        revision: null,
      },
      { Cookie: nextCookie },
    );
    assert.equal(deleted.status, 200);
    assert.match(deleted.headers.get('set-cookie')!, /Max-Age=0/);
    assert.equal(
      (await post('login', { ...credentials, password: 'replacement-password' })).status,
      401,
    );

    for (let attempt = 0; attempt < 6; attempt += 1) {
      assert.equal(
        (
          await post('recover', {
            username: 'missing',
            recoveryKey: 'a'.repeat(43),
            password: 'replacement-password',
          })
        ).status,
        400,
      );
    }

    assert.equal(
      (
        await post('recover', {
          username: 'missing',
          recoveryKey: 'a'.repeat(43),
          password: 'replacement-password',
        })
      ).status,
      429,
    );
  } finally {
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
    app.db.close();
  }
});
