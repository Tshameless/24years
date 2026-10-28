import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initRelationalSchema } from './records-store.ts';

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
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
      family_role TEXT NOT NULL CHECK(family_role IN ('single_parent', 'mother', 'father'))
    );
    CREATE INDEX IF NOT EXISTS members_family ON members(family_id);
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY,
      family_id TEXT UNIQUE NOT NULL REFERENCES families(id),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family_invite_security (
      family_id TEXT PRIMARY KEY REFERENCES families(id),
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS invite_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id TEXT REFERENCES families(id),
      user_id TEXT REFERENCES accounts(id),
      outcome TEXT NOT NULL CHECK(outcome IN ('failed', 'locked', 'expired', 'success')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS invite_audit_family ON invite_audit(family_id, created_at);
    CREATE TABLE IF NOT EXISTS receipts (
      user_id TEXT NOT NULL REFERENCES accounts(id),
      operation_id TEXT NOT NULL,
      family_id TEXT NOT NULL REFERENCES families(id),
      payload_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(user_id, operation_id)
    );
    CREATE INDEX IF NOT EXISTS receipts_created_at ON receipts(created_at);
    CREATE TABLE IF NOT EXISTS import_backups (
      family_id TEXT PRIMARY KEY REFERENCES families(id),
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  initRelationalSchema(db);

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
