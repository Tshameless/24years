import type { DatabaseSync } from 'node:sqlite';
import { decodeFamily } from '../src/domain/family.ts';
import type {
  Account,
  FamilyDelta,
  Member,
  SessionState,
  SharedFamily,
} from '../src/domain/collaboration.ts';
import { ApiError, createAccountHandlers, hash, requireValue, type Body } from './auth.ts';
import { createFamilyMutations } from './family-mutations.ts';
import { readDeltaChanges } from './records-store.ts';

export { ApiError, hash };

type FamilyRow = {
  id: string;
  mode: 'single' | 'couple';
  data: string;
  revision: number;
  updated_at: string;
  updated_by: string;
};

export function createService(db: DatabaseSync) {
  function sessionTag(userId: string | null) {
    const metadata = userId
      ? db
          .prepare(
            `
      SELECT a.id, a.username, a.nickname, m.family_id, m.role, m.family_role,
        f.revision, i.expires_at
      FROM accounts a LEFT JOIN members m ON m.user_id = a.id
      LEFT JOIN families f ON f.id = m.family_id
      LEFT JOIN invites i ON i.family_id = f.id AND i.expires_at > ? AND m.role = 'owner'
      WHERE a.id = ?`,
          )
          .get(Date.now(), userId)
      : null;

    return `"${hash(JSON.stringify(metadata))}"`;
  }

  function account(id: string): Account {
    return db
      .prepare('SELECT id, username, nickname FROM accounts WHERE id = ?')
      .get(id) as unknown as Account;
  }

  function membership(userId: string) {
    return db.prepare('SELECT family_id, role FROM members WHERE user_id = ?').get(userId) as
      | { family_id: string; role: Member['role'] }
      | undefined;
  }

  function snapshot(userId: string): SessionState {
    const member = membership(userId);

    if (!member) {
      return { user: account(userId), family: null };
    }

    const row = db
      .prepare('SELECT * FROM families WHERE id = ?')
      .get(member.family_id) as unknown as FamilyRow;
    const invite = db
      .prepare('SELECT expires_at FROM invites WHERE family_id = ? AND expires_at > ?')
      .get(row.id, Date.now()) as { expires_at: number } | undefined;
    const family: SharedFamily = {
      id: row.id,
      mode: row.mode,
      revision: row.revision,
      data: decodeFamily(row.data),
      members: db
        .prepare(
          "SELECT a.id, a.username, a.nickname, m.role, m.family_role AS familyRole FROM members m JOIN accounts a ON a.id = m.user_id WHERE m.family_id = ? ORDER BY m.role = 'owner' DESC, a.id",
        )
        .all(row.id) as unknown as Member[],
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      inviteExpiresAt:
        member.role === 'owner' && invite
          ? new Date(Number(invite.expires_at)).toISOString()
          : null,
    };

    return { user: account(userId), family };
  }

  function touch(familyId: string, userId: string) {
    db.prepare(
      'UPDATE families SET revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ?',
    ).run(new Date().toISOString(), account(userId).nickname, familyId);
  }

  function authorize(userId: string, body: Body, permission: 'owner' | 'edit' | 'member' = 'edit') {
    const member = membership(userId);
    requireValue(
      member && member.family_id === body.familyId,
      403,
      '你已不属于这个家庭，请同步后重试。',
    );
    requireValue(
      permission === 'member' ||
        member.role === 'owner' ||
        (permission === 'edit' && member.role === 'editor'),
      403,
      permission === 'owner' ? '只有管理员可以执行此操作。' : '你当前是仅查看成员，不能修改记录。',
    );

    return member;
  }

  function changesSince(userId: string, fromRevision: number): FamilyDelta | null {
    const member = membership(userId);

    if (!member) {
      return null;
    }

    const row = db
      .prepare('SELECT id, mode, revision, updated_at, updated_by FROM families WHERE id = ?')
      .get(member.family_id) as Omit<FamilyRow, 'data'> | undefined;

    if (!row) {
      return null;
    }

    const invite = db
      .prepare('SELECT expires_at FROM invites WHERE family_id = ? AND expires_at > ?')
      .get(row.id, Date.now()) as { expires_at: number } | undefined;
    const members = db
      .prepare(
        "SELECT a.id, a.username, a.nickname, m.role, m.family_role AS familyRole FROM members m JOIN accounts a ON a.id = m.user_id WHERE m.family_id = ? ORDER BY m.role = 'owner' DESC, a.id",
      )
      .all(row.id) as unknown as Member[];
    const delta = readDeltaChanges(db, row.id, fromRevision, row.revision);

    return {
      familyId: row.id,
      fromRevision,
      revision: row.revision,
      mode: row.mode,
      members,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      inviteExpiresAt:
        member.role === 'owner' && invite
          ? new Date(Number(invite.expires_at)).toISOString()
          : null,
      reset: delta.reset,
      entries: delta.entries,
    };
  }

  const accountHandlers = createAccountHandlers(db, account, snapshot);
  const { mutate } = createFamilyMutations({
    db,
    account,
    membership,
    snapshot,
    touch,
    authorize,
  });

  return {
    sessionTag,
    ...accountHandlers,
    snapshot,
    changesSince,
    mutate,
  };
}
