import { DatabaseSync } from 'node:sqlite';
import { closeSync, existsSync, mkdirSync, openSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { decodeFamilyMetadata } from '../src/domain/family.ts';
import { decodeFamilyRecords } from './records-store.ts';

// Runtime requires Node 24.9+. The project's Node 22 type definitions predate readOnly.
const readOnlyOptions = { open: true, readOnly: true };

export function verifyDatabase(path: string) {
  if (!existsSync(path)) {
    throw new Error('数据库文件不存在。');
  }

  const db = new DatabaseSync(path, readOnlyOptions);

  try {
    const integrity = db.prepare('PRAGMA integrity_check').all() as Array<Record<string, string>>;

    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') {
      throw new Error('数据库完整性校验失败。');
    }

    if (db.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('数据库关联校验失败。');
    }

    for (const table of ['accounts', 'sessions', 'families', 'members', 'invites', 'receipts']) {
      if (
        !db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
      ) {
        throw new Error('文件不是完整的 24Years 数据库。');
      }
    }

    const families = db.prepare('SELECT id, data FROM families').all() as Array<{
      id: string;
      data: string;
    }>;

    for (const family of families) {
      decodeFamilyMetadata(String(family.data));
      decodeFamilyRecords(db, family.id, String(family.data));
      const owners = db
        .prepare("SELECT count(*) AS count FROM members WHERE family_id = ? AND role = 'owner'")
        .get(family.id) as { count: number };

      if (owners.count !== 1) {
        throw new Error('家庭管理员数据不完整。');
      }

    }

    return {
      families: families.length,
      accounts: (db.prepare('SELECT count(*) AS count FROM accounts').get() as { count: number })
        .count,
    };
  } finally {
    db.close();
  }
}

export function copyDatabase(source: string, destination: string, restore = false) {
  const sourcePath = resolve(source);
  const targetPath = resolve(destination);

  if (
    sourcePath === targetPath ||
    [targetPath, `${targetPath}-wal`, `${targetPath}-shm`].some(existsSync)
  ) {
    throw new Error('目标必须是尚不存在的新文件，不能覆盖正在使用的数据库。');
  }

  verifyDatabase(sourcePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  // Reserve the exact destination; never overwrite an existing backup.
  closeSync(openSync(targetPath, 'wx', 0o600));

  try {
    const sourceDb = new DatabaseSync(sourcePath, readOnlyOptions);

    try {
      sourceDb.exec('PRAGMA busy_timeout = 5000');
      sourceDb.prepare('VACUUM INTO ?').run(targetPath);
    } finally {
      sourceDb.close();
    }

    if (restore) {
      const restored = new DatabaseSync(targetPath);

      try {
        // Restoring old sessions or invites would resurrect revoked access.
        restored.exec(
          'BEGIN; DELETE FROM sessions; DELETE FROM invites; DELETE FROM family_invite_security; DELETE FROM invite_audit; COMMIT;',
        );
        restored.exec('UPDATE accounts SET recovery_hash = NULL');
      } finally {
        restored.close();
      }
    }

    const counts = verifyDatabase(targetPath);

    return { path: targetPath, ...counts, sessionsCleared: restore };
  } catch (error) {
    // Only this function's newly reserved output is removed on failure.
    if (existsSync(targetPath)) {
      unlinkSync(targetPath);
    }

    throw error;
  }
}
