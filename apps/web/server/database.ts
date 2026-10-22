import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      recovery_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES accounts(id),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK(mode IN ('single', 'couple')),
      data TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      user_id TEXT PRIMARY KEY REFERENCES accounts(id),
      family_id TEXT NOT NULL REFERENCES families(id),
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer'))
    );
    CREATE INDEX IF NOT EXISTS members_family ON members(family_id);
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY,
      family_id TEXT UNIQUE NOT NULL REFERENCES families(id),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      user_id TEXT NOT NULL REFERENCES accounts(id),
      operation_id TEXT NOT NULL,
      family_id TEXT NOT NULL REFERENCES families(id),
      payload_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(user_id, operation_id)
    );
    CREATE TABLE IF NOT EXISTS import_backups (
      family_id TEXT PRIMARY KEY REFERENCES families(id),
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // The first collaboration release only stored permission roles. Keep existing
  // databases usable while adding the family position selected during onboarding.
  const columns = db.prepare('PRAGMA table_info(members)').all() as Array<{ name: string }>;

  const accountColumns = db.prepare('PRAGMA table_info(accounts)').all() as Array<{
    name: string;
  }>;

  const receiptColumns = db.prepare('PRAGMA table_info(receipts)').all() as Array<{
    name: string;
  }>;

  if (!accountColumns.some((column) => column.name === 'recovery_hash')) {
    db.exec('ALTER TABLE accounts ADD COLUMN recovery_hash TEXT');
  }

  if (!receiptColumns.some((column) => column.name === 'created_at')) {
    db.exec('ALTER TABLE receipts ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
    db.prepare('UPDATE receipts SET created_at = ? WHERE created_at = 0').run(Date.now());
  }

  db.exec('CREATE INDEX IF NOT EXISTS receipts_created_at ON receipts(created_at)');

  if (!columns.some((column) => column.name === 'family_role')) {
    db.exec(`
      ALTER TABLE members ADD COLUMN family_role TEXT CHECK(family_role IN ('single_parent', 'mother', 'father'));
      UPDATE members SET family_role = 'single_parent'
      WHERE family_id IN (SELECT id FROM families WHERE mode = 'single');
    `);
  }

  return db;
}

export function transaction<T>(db: DatabaseSync, action: () => T): T {
  db.exec('BEGIN IMMEDIATE');

  try {
    const result = action();
    db.exec('COMMIT');

    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
