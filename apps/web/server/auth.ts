import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Account, SessionState } from '../src/domain/collaboration.ts';
import { transaction } from './database.ts';
import { deleteFamilyTables, recordDeltaEntries } from './records-store.ts';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function requireValue(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) {
    throw new ApiError(status, message);
  }
}

function passwordHash(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export type Body = Record<string, unknown>;

export function createAccountHandlers(
  db: DatabaseSync,
  account: (id: string) => Account,
  snapshot: (userId: string) => SessionState,
) {
  async function authenticate(body: Body, register: boolean) {
    requireValue(
      typeof body.username === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(body.username),
      400,
      '账号需为 3–32 位字母、数字或下划线。',
    );
    requireValue(
      typeof body.password === 'string' &&
        body.password.length >= 10 &&
        body.password.length <= 128,
      400,
      '密码需为 10–128 个字符。',
    );
    const username = body.username.toLowerCase();
    const existing = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username) as
      | { id: string; salt: string; password_hash: string }
      | undefined;
    let userId: string;
    let recoveryKey: string | undefined;

    if (register) {
      requireValue(
        typeof body.nickname === 'string' &&
          body.nickname.trim().length > 0 &&
          body.nickname.length <= 20,
        400,
        '请填写不超过 20 字的称呼。',
      );
      requireValue(!existing, 409, '这个账号已被使用，请更换账号或登录。');
      const salt = randomBytes(16).toString('hex');
      const key = await passwordHash(body.password, salt);
      userId = randomUUID();

      // Hashing is asynchronous; recheck uniqueness before inserting.
      requireValue(
        !db.prepare('SELECT id FROM accounts WHERE username = ?').get(username),
        409,
        '这个账号已被使用。',
      );
      recoveryKey = randomBytes(32).toString('base64url');
      db.prepare(
        'INSERT INTO accounts(id, username, nickname, password_hash, salt, recovery_hash) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(userId, username, body.nickname.trim(), key.toString('hex'), salt, hash(recoveryKey));
    } else {
      const key = await passwordHash(
        body.password,
        String(existing?.salt ?? '24years-invalid-account'),
      );
      requireValue(
        existing && timingSafeEqual(key, Buffer.from(String(existing.password_hash), 'hex')),
        401,
        '账号或密码不正确。',
      );
      userId = String(existing.id);
      requireValue(
        db
          .prepare('SELECT id FROM accounts WHERE id = ? AND password_hash = ?')
          .get(userId, existing.password_hash),
        401,
        '密码已更新，请使用新密码登录。',
      );
    }

    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
      hash(token),
      userId,
      Date.now() + 30 * 86400000,
    );

    return { token, state: { ...snapshot(userId), ...(recoveryKey ? { recoveryKey } : {}) } };
  }

  async function verifyPassword(userId: string, password: unknown) {
    requireValue(
      typeof password === 'string' && password.length >= 10 && password.length <= 128,
      400,
      '请填写当前密码。',
    );
    const row = db.prepare('SELECT salt, password_hash FROM accounts WHERE id = ?').get(userId) as
      | { salt: string; password_hash: string }
      | undefined;
    const key = await passwordHash(password, row?.salt ?? '24years-invalid-account');
    requireValue(
      row && timingSafeEqual(key, Buffer.from(row.password_hash, 'hex')),
      400,
      '当前密码不正确。',
    );
    requireValue(
      db
        .prepare('SELECT id FROM accounts WHERE id = ? AND password_hash = ?')
        .get(userId, row.password_hash),
      401,
      '账号已发生变更，请重新登录。',
    );

    return row.password_hash;
  }

  async function rotateRecovery(userId: string, body: Body) {
    const verifiedHash = await verifyPassword(userId, body.password);
    const recoveryKey = randomBytes(32).toString('base64url');
    const result = db
      .prepare('UPDATE accounts SET recovery_hash = ? WHERE id = ? AND password_hash = ?')
      .run(hash(recoveryKey), userId, verifiedHash);
    requireValue(result.changes === 1, 401, '账号已发生变更，请重新登录。');

    return { ...snapshot(userId), recoveryKey };
  }

  async function changePassword(userId: string, currentToken: string, body: Body) {
    const verifiedHash = await verifyPassword(userId, body.currentPassword);
    requireValue(
      typeof body.newPassword === 'string' &&
        body.newPassword.length >= 10 &&
        body.newPassword.length <= 128,
      400,
      '新密码需为 10–128 个字符。',
    );
    requireValue(body.newPassword !== body.currentPassword, 400, '新密码不能与当前密码相同。');
    const salt = randomBytes(16).toString('hex');
    const key = await passwordHash(body.newPassword, salt);
    const currentTokenHash = hash(currentToken);

    transaction(db, () => {
      const result = db
        .prepare(
          'UPDATE accounts SET password_hash = ?, salt = ? WHERE id = ? AND password_hash = ?',
        )
        .run(key.toString('hex'), salt, userId, verifiedHash);
      requireValue(result.changes === 1, 401, '账号已发生变更，请重新登录。');
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(
        userId,
        currentTokenHash,
      );
    });

    return snapshot(userId);
  }

  async function recover(body: Body) {
    requireValue(
      typeof body.username === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(body.username),
      400,
      '请填写有效账号。',
    );
    requireValue(
      typeof body.recoveryKey === 'string' && /^[\w-]{43}$/.test(body.recoveryKey),
      400,
      '请填写完整的恢复密钥。',
    );
    requireValue(
      typeof body.password === 'string' &&
        body.password.length >= 10 &&
        body.password.length <= 128,
      400,
      '新密码需为 10–128 个字符。',
    );
    const row = db
      .prepare('SELECT id, recovery_hash FROM accounts WHERE username = ?')
      .get(body.username.toLowerCase()) as { id: string; recovery_hash: string | null } | undefined;
    const suppliedHash = hash(body.recoveryKey);
    const valid = timingSafeEqual(
      Buffer.from(suppliedHash, 'hex'),
      Buffer.from(row?.recovery_hash ?? hash('invalid'), 'hex'),
    );
    requireValue(row && row.recovery_hash && valid, 400, '账号或恢复密钥不正确。');
    const salt = randomBytes(16).toString('hex');
    const key = await passwordHash(body.password, salt);

    const recoveryKey = randomBytes(32).toString('base64url');
    transaction(db, () => {
      // Consume once after hashing; simultaneous recovery attempts cannot both succeed.
      const result = db
        .prepare(
          'UPDATE accounts SET password_hash = ?, salt = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?',
        )
        .run(key.toString('hex'), salt, hash(recoveryKey), row.id, suppliedHash);
      requireValue(result.changes === 1, 400, '恢复密钥已使用或已更新，请重新核对。');
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    });

    return { user: null, family: null, recoveryKey };
  }

  async function deleteAccount(userId: string, body: Body) {
    const verifiedHash = await verifyPassword(userId, body.password);

    return transaction(db, () => {
      requireValue(
        db
          .prepare('SELECT id FROM accounts WHERE id = ? AND password_hash = ?')
          .get(userId, verifiedHash),
        401,
        '账号已发生变更，请重新登录。',
      );
      requireValue(
        body.confirmation === account(userId).username,
        400,
        '请输入完整账号以确认注销。',
      );
      const family = snapshot(userId).family;
      requireValue(
        (family?.id ?? null) === body.familyId && (family?.revision ?? null) === body.revision,
        409,
        '家庭状态已变化，请核对后重新确认注销。',
      );

      if (family) {
        const member = family.members.find((item) => item.id === userId)!;
        const remaining = family.members.find((item) => item.id !== userId);
        db.prepare('DELETE FROM invites WHERE family_id = ?').run(family.id);
        db.prepare('DELETE FROM members WHERE user_id = ?').run(userId);

        if (!remaining) {
          deleteFamilyTables(db, family.id);
          db.prepare('DELETE FROM receipts WHERE family_id = ?').run(family.id);
          db.prepare('DELETE FROM import_backups WHERE family_id = ?').run(family.id);
          db.prepare('DELETE FROM families WHERE id = ?').run(family.id);
        } else {
          if (member.role === 'owner') {
            db.prepare("UPDATE members SET role = 'owner' WHERE user_id = ?").run(remaining.id);

            if (family.data.profile) {
              family.data.profile.nickname = remaining.nickname;

              if (remaining.familyRole) {
                family.data.profile.parentRole = remaining.familyRole;
              } else {
                delete family.data.profile.parentRole;
                delete family.data.profile.familyMode;
              }

              db.prepare('UPDATE families SET data = ? WHERE id = ?').run(
                JSON.stringify(family.data),
                family.id,
              );
            }
          }

          db.prepare(
            'UPDATE families SET revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ?',
          ).run(new Date().toISOString(), '已注销成员', family.id);
          recordDeltaEntries(db, family.id, family.revision + 1, [
            { recordType: 'profile', recordId: 'profile', value: family.data.profile },
          ]);
        }
      }

      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM receipts WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM accounts WHERE id = ?').run(userId);

      return { user: null, family: null };
    });
  }

  function userForToken(token: string) {
    const session = db
      .prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .get(hash(token), Date.now()) as { user_id: string } | undefined;

    return session ? String(session.user_id) : null;
  }

  return {
    authenticate,
    rotateRecovery,
    changePassword,
    recover,
    deleteAccount,
    userForToken,
    logout: (token: string) =>
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token)),
  };
}
