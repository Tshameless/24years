import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { copyDatabase, verifyDatabase } from './backup.ts';
import { openDatabase } from './database.ts';
import { createService } from './service.ts';
import { emptyFamily } from '../src/domain/family.ts';

test('在线 WAL 数据库一致性备份、恢复可登录且不恢复旧会话或邀请', async () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-backup-'));
  const source = join(directory, 'source.sqlite');
  const backup = join(directory, 'backup.sqlite');
  const restored = join(directory, 'restored.sqlite');
  const db = openDatabase(source);

  try {
    db.exec('PRAGMA wal_autocheckpoint = 0');
    const service = createService(db);
    const credentials = { username: 'backupuser', nickname: '小叶', password: 'backup-password' };
    const account = await service.authenticate(credentials, true);
    const userId = account.state.user!.id;
    const family = service.mutate(userId, 'create', {
      mode: 'couple',
      familyRole: 'mother',
      data: {
        ...emptyFamily(),
        tasks: [
          {
            id: 'task-in-wal',
            title: '备份前计划',
            date: '2026-10-09',
            time: '08:00',
            repeat: 'once',
            completedDates: [],
          },
        ],
      },
    }).family!;
    service.mutate(userId, 'invite', { familyId: family.id, revision: family.revision });
    assert.equal(copyDatabase(source, backup).accounts, 1);
    const savedBytes = readFileSync(backup);
    assert.throws(() => copyDatabase(source, backup), /目标必须/);
    assert.throws(() => copyDatabase(source, source), /目标必须/);
    assert.deepEqual(readFileSync(backup), savedBytes);
    assert.equal(copyDatabase(backup, restored, true).sessionsCleared, true);
    const recovered = openDatabase(restored);

    try {
      const recoveryService = createService(recovered);
      assert.equal(recoveryService.userForToken(account.token), null);
      await assert.rejects(() =>
        recoveryService.recover({
          username: credentials.username,
          recoveryKey: account.state.recoveryKey,
          password: 'changed-password',
        }),
      );
      const login = await recoveryService.authenticate(credentials, false);
      assert.equal(login.state.family!.data.tasks[0].title, '备份前计划');
      assert.equal(login.state.family!.inviteExpiresAt, null);
      assert.deepEqual(verifyDatabase(restored), { families: 1, accounts: 1 });
    } finally {
      recovered.close();
    }
  } finally {
    db.close();
    rmSync(directory, { recursive: true });
  }
});

test('拒绝损坏或非项目数据库，已有目标保持原样', () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-backup-invalid-'));

  try {
    const invalid = join(directory, 'broken.sqlite');
    writeFileSync(invalid, 'not-a-database');
    assert.throws(() => verifyDatabase(invalid));
    const other = join(directory, 'other.sqlite');
    const db = new DatabaseSync(other);
    db.exec('CREATE TABLE unrelated (id INTEGER)');
    db.close();
    assert.throws(() => verifyDatabase(other), /不是完整/);
    assert.throws(() => copyDatabase(other, invalid), /目标必须/);
    assert.equal(readFileSync(invalid, 'utf8'), 'not-a-database');
  } finally {
    rmSync(directory, { recursive: true });
  }
});
