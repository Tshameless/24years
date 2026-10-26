import type { DatabaseSync } from 'node:sqlite';
import {
  decodeFamily,
  type Expense,
  type FamilyData,
  type FamilyTask,
  type PregnancyRecord,
} from '../src/domain/family.ts';
import type { FamilyDeltaEntry, FamilyDeltaRecordType } from '../src/domain/collaboration.ts';

export function initRelationalSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_tasks (
      family_id TEXT NOT NULL REFERENCES families(id),
      id TEXT NOT NULL,
      position INTEGER NOT NULL,
      date TEXT NOT NULL,
      repeat TEXT NOT NULL,
      assignee TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (family_id, id)
    );
    CREATE INDEX IF NOT EXISTS family_tasks_order ON family_tasks(family_id, position);
    CREATE INDEX IF NOT EXISTS family_tasks_date ON family_tasks(family_id, date);

    CREATE TABLE IF NOT EXISTS family_expenses (
      family_id TEXT NOT NULL REFERENCES families(id),
      id TEXT NOT NULL,
      position INTEGER NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      reimbursed_cents INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (family_id, id)
    );
    CREATE INDEX IF NOT EXISTS family_expenses_order ON family_expenses(family_id, position);
    CREATE INDEX IF NOT EXISTS family_expenses_date ON family_expenses(family_id, date);
    CREATE INDEX IF NOT EXISTS family_expenses_category ON family_expenses(family_id, category);

    CREATE TABLE IF NOT EXISTS family_pregnancy_records (
      family_id TEXT NOT NULL REFERENCES families(id),
      id TEXT NOT NULL,
      position INTEGER NOT NULL,
      type TEXT NOT NULL,
      date TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (family_id, id)
    );
    CREATE INDEX IF NOT EXISTS family_pregnancy_order ON family_pregnancy_records(family_id, position);
    CREATE INDEX IF NOT EXISTS family_pregnancy_type ON family_pregnancy_records(family_id, type);

    CREATE TABLE IF NOT EXISTS family_changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id TEXT NOT NULL REFERENCES families(id),
      revision INTEGER NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      value TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS family_changes_lookup ON family_changes(family_id, revision, seq);
    CREATE INDEX IF NOT EXISTS family_changes_created_at ON family_changes(created_at);
  `);

  const rows = db.prepare('SELECT id, data, revision, updated_at FROM families').all() as Array<{
    id: string;
    data: string;
    revision: number;
    updated_at: string;
  }>;

  for (const row of rows) {
    try {
      const data = decodeFamily(row.data);
      const taskCount = (
        db
          .prepare('SELECT count(*) AS count FROM family_tasks WHERE family_id = ?')
          .get(row.id) as { count: number }
      ).count;
      const expenseCount = (
        db
          .prepare('SELECT count(*) AS count FROM family_expenses WHERE family_id = ?')
          .get(row.id) as { count: number }
      ).count;
      const pregnancyCount = (
        db
          .prepare('SELECT count(*) AS count FROM family_pregnancy_records WHERE family_id = ?')
          .get(row.id) as { count: number }
      ).count;

      if (
        taskCount !== data.tasks.length ||
        expenseCount !== data.expenses.length ||
        pregnancyCount !== (data.pregnancyRecords?.length ?? 0)
      ) {
        syncFamilyTables(db, row.id, data, row.updated_at);
        recordResetChange(db, row.id, row.revision);
      }
    } catch {
      // Invalid or corrupted test fixtures are left untouched for validator tests.
    }
  }

  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (2, ?)').run(
    new Date().toISOString(),
  );
}

function recordDate(record: PregnancyRecord): string | null {
  return 'date' in record ? record.date : null;
}

export function syncFamilyTables(
  db: DatabaseSync,
  familyId: string,
  data: FamilyData,
  updatedAt = new Date().toISOString(),
) {
  db.prepare('DELETE FROM family_tasks WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM family_expenses WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM family_pregnancy_records WHERE family_id = ?').run(familyId);

  const insertTask = db.prepare(
    'INSERT INTO family_tasks(family_id, id, position, date, repeat, assignee, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const [index, task] of data.tasks.entries()) {
    insertTask.run(
      familyId,
      task.id,
      index,
      task.date,
      task.repeat,
      task.assignee ?? null,
      JSON.stringify(task),
      updatedAt,
    );
  }

  const insertExpense = db.prepare(
    'INSERT INTO family_expenses(family_id, id, position, date, category, kind, amount_cents, reimbursed_cents, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const [index, expense] of data.expenses.entries()) {
    insertExpense.run(
      familyId,
      expense.id,
      index,
      expense.date,
      expense.category,
      expense.kind,
      expense.amountCents,
      expense.reimbursedCents,
      JSON.stringify(expense),
      updatedAt,
    );
  }

  const insertPregnancy = db.prepare(
    'INSERT INTO family_pregnancy_records(family_id, id, position, type, date, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (const [index, record] of (data.pregnancyRecords ?? []).entries()) {
    insertPregnancy.run(
      familyId,
      record.id,
      index,
      record.type,
      recordDate(record),
      JSON.stringify(record),
      updatedAt,
    );
  }
}

export function upsertTaskRow(
  db: DatabaseSync,
  familyId: string,
  id: string,
  value: FamilyTask | null,
  updatedAt = new Date().toISOString(),
) {
  db.prepare('DELETE FROM family_tasks WHERE family_id = ? AND id = ?').run(familyId, id);

  if (value) {
    const nextPos = (
      db
        .prepare(
          'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM family_tasks WHERE family_id = ?',
        )
        .get(familyId) as { next: number }
    ).next;
    db.prepare(
      'INSERT INTO family_tasks(family_id, id, position, date, repeat, assignee, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      familyId,
      value.id,
      nextPos,
      value.date,
      value.repeat,
      value.assignee ?? null,
      JSON.stringify(value),
      updatedAt,
    );
  }
}

export function upsertExpenseRow(
  db: DatabaseSync,
  familyId: string,
  id: string,
  value: Expense | null,
  prepend = false,
  updatedAt = new Date().toISOString(),
) {
  db.prepare('DELETE FROM family_expenses WHERE family_id = ? AND id = ?').run(familyId, id);

  if (value) {
    const nextPos = prepend
      ? (
          db
            .prepare(
              'SELECT COALESCE(MIN(position), 1) - 1 AS next FROM family_expenses WHERE family_id = ?',
            )
            .get(familyId) as { next: number }
        ).next
      : (
          db
            .prepare(
              'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM family_expenses WHERE family_id = ?',
            )
            .get(familyId) as { next: number }
        ).next;
    db.prepare(
      'INSERT INTO family_expenses(family_id, id, position, date, category, kind, amount_cents, reimbursed_cents, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      familyId,
      value.id,
      nextPos,
      value.date,
      value.category,
      value.kind,
      value.amountCents,
      value.reimbursedCents,
      JSON.stringify(value),
      updatedAt,
    );
  }
}

export function upsertPregnancyRow(
  db: DatabaseSync,
  familyId: string,
  id: string,
  value: PregnancyRecord | null,
  updatedAt = new Date().toISOString(),
) {
  db.prepare('DELETE FROM family_pregnancy_records WHERE family_id = ? AND id = ?').run(
    familyId,
    id,
  );

  if (value) {
    const nextPos = (
      db
        .prepare(
          'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM family_pregnancy_records WHERE family_id = ?',
        )
        .get(familyId) as { next: number }
    ).next;
    db.prepare(
      'INSERT INTO family_pregnancy_records(family_id, id, position, type, date, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      familyId,
      value.id,
      nextPos,
      value.type,
      recordDate(value),
      JSON.stringify(value),
      updatedAt,
    );
  }
}

export function recordResetChange(db: DatabaseSync, familyId: string, revision: number) {
  db.prepare('DELETE FROM family_changes WHERE family_id = ?').run(familyId);
  db.prepare(
    'INSERT INTO family_changes(family_id, revision, record_type, record_id, value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(familyId, revision, 'reset', 'family', null, Date.now());
}

export function recordDeltaEntries(
  db: DatabaseSync,
  familyId: string,
  revision: number,
  entries: Array<{ recordType: FamilyDeltaRecordType; recordId: string; value: unknown }>,
) {
  const insert = db.prepare(
    'INSERT INTO family_changes(family_id, revision, record_type, record_id, value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const now = Date.now();

  for (const entry of entries) {
    insert.run(
      familyId,
      revision,
      entry.recordType,
      entry.recordId,
      entry.value === null ? null : JSON.stringify(entry.value),
      now,
    );
  }
}

export function deleteFamilyTables(db: DatabaseSync, familyId: string) {
  db.prepare('DELETE FROM family_tasks WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM family_expenses WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM family_pregnancy_records WHERE family_id = ?').run(familyId);
  db.prepare('DELETE FROM family_changes WHERE family_id = ?').run(familyId);
}

export function readDeltaChanges(
  db: DatabaseSync,
  familyId: string,
  fromRevision: number,
  currentRevision: number,
): { reset: boolean; entries: FamilyDeltaEntry[] } {
  if (!Number.isInteger(fromRevision) || fromRevision < 1 || fromRevision > currentRevision) {
    return { reset: true, entries: [] };
  }

  if (fromRevision === currentRevision) {
    return { reset: false, entries: [] };
  }

  const rows = db
    .prepare(
      'SELECT revision, record_type, record_id, value FROM family_changes WHERE family_id = ? AND revision > ? ORDER BY revision ASC, seq ASC',
    )
    .all(familyId, fromRevision) as Array<{
    revision: number;
    record_type: string;
    record_id: string;
    value: string | null;
  }>;

  if (!rows.length || rows.some((row) => row.record_type === 'reset')) {
    return { reset: true, entries: [] };
  }

  const revisions = new Set(rows.map((row) => row.revision));
  for (let rev = fromRevision + 1; rev <= currentRevision; rev += 1) {
    if (!revisions.has(rev)) {
      return { reset: true, entries: [] };
    }
  }

  return {
    reset: false,
    entries: rows.map((row) => ({
      revision: row.revision,
      recordType: row.record_type as FamilyDeltaRecordType,
      recordId: row.record_id,
      value: row.value === null ? null : JSON.parse(row.value),
    })),
  };
}
