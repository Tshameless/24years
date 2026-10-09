import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
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
  service.mutate(owner, 'create', { mode: 'couple', data: emptyFamily() });
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

test('邀请仅可使用一次、限制两人、支持撤销和过期', async () => {
  const f = await fixture();

  try {
    const first = f.manage('invite').invitation!;
    f.manage('revoke');
    assert.throws(() => f.service.mutate(f.partner, 'join', { code: first.code }), failsWith(404));
    const expired = f.manage('invite').invitation!;
    f.db.prepare('UPDATE invites SET expires_at = 0 WHERE code_hash = ?').run(hash(expired.code));
    assert.throws(
      () => f.service.mutate(f.partner, 'join', { code: expired.code }),
      failsWith(404),
    );
    const code = f.manage('invite').invitation!.code;
    const third = await f.register('third');
    const results = await Promise.allSettled(
      [f.partner, third].map(async (id) => f.service.mutate(id, 'join', { code })),
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
    f.service.mutate(f.partner, 'join', { code: f.manage('invite').invitation!.code });
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
    f.service.mutate(f.partner, 'join', { code: f.manage('invite').invitation!.code });
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
    f.service.mutate(f.partner, 'join', { code: f.manage('invite').invitation!.code });
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
