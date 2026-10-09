import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import {
  decodeFamily,
  validExpense,
  validProfile,
  validTask,
  type FamilyData,
} from '../src/domain/family.ts';
import type {
  Account,
  FamilyParentRole,
  Member,
  SessionState,
  SharedFamily,
} from '../src/domain/collaboration.ts';
import { transaction } from './database.ts';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function requireValue(condition: unknown, status: number, message: string): asserts condition {
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

type Body = Record<string, unknown>;
type FamilyRow = {
  id: string;
  mode: 'single' | 'couple';
  data: string;
  revision: number;
  updated_at: string;
  updated_by: string;
};

function familyRole(value: unknown, mode: 'single' | 'couple'): FamilyParentRole {
  if (mode === 'single' && value === undefined) {
    return 'single_parent';
  }

  requireValue(
    value === 'single_parent' || value === 'mother' || value === 'father',
    400,
    '家庭身份无效。',
  );
  requireValue(
    mode === 'couple' ? value === 'mother' || value === 'father' : value === 'single_parent',
    400,
    mode === 'couple' ? '多人家庭请选择母亲或父亲。' : '单人家庭使用单人照护者身份。',
  );

  return value;
}

export function createService(db: DatabaseSync) {
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

    transaction(db, () => {
      // Consume once after hashing; simultaneous recovery attempts cannot both succeed.
      const result = db
        .prepare(
          'UPDATE accounts SET password_hash = ?, salt = ?, recovery_hash = NULL WHERE id = ? AND recovery_hash = ?',
        )
        .run(key.toString('hex'), salt, row.id, suppliedHash);
      requireValue(result.changes === 1, 400, '恢复密钥已使用或已更新，请重新核对。');
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    });

    return { user: null, family: null };
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

  function createFamily(userId: string, body: Body) {
    requireValue(!membership(userId), 409, '你已经拥有家庭，请先查看当前家庭。');
    requireValue(body.mode === 'single' || body.mode === 'couple', 400, '请选择单人或多人模式。');
    const selectedFamilyRole = familyRole(body.familyRole, body.mode);
    let data;

    try {
      data = decodeFamily(JSON.stringify(body.data));
    } catch {
      throw new ApiError(400, '档案格式无效，未上传任何记录。');
    }

    if (data.profile) {
      data.profile = { ...data.profile, familyMode: body.mode, parentRole: selectedFamilyRole };
    }

    requireValue(Buffer.byteLength(JSON.stringify(data)) < 800000, 413, '档案超过当前容量上限。');

    const familyId = randomUUID();
    db.prepare('INSERT INTO families VALUES (?, ?, ?, 1, ?, ?)').run(
      familyId,
      body.mode,
      JSON.stringify({ ...data, theme: 'light' }),
      new Date().toISOString(),
      account(userId).nickname,
    );
    db.prepare(
      'INSERT INTO members(user_id, family_id, role, family_role) VALUES (?, ?, ?, ?)',
    ).run(userId, familyId, 'owner', selectedFamilyRole);
  }

  function changeRecords(userId: string, body: Body) {
    const member = authorize(userId, body);
    requireValue(
      typeof body.operationId === 'string' && /^[\w-]{10,100}$/.test(body.operationId),
      400,
      '缺少有效操作编号。',
    );
    const payloadHash = hash(JSON.stringify({ familyId: body.familyId, change: body.change }));
    const receipt = db
      .prepare('SELECT payload_hash FROM receipts WHERE user_id = ? AND operation_id = ?')
      .get(userId, body.operationId) as { payload_hash: string } | undefined;

    if (receipt) {
      requireValue(receipt.payload_hash === payloadHash, 409, '操作编号已被使用，请重新打开编辑。');

      return;
    }

    const family = snapshot(userId).family!;
    const change = body.change as Body | null;
    requireValue(change && typeof change === 'object', 400, '修改内容无效。');
    const { before, value } = change;

    if (change.type === 'profile') {
      requireValue(member.role === 'owner', 403, '只有管理员可以修改家庭档案。');
      requireValue(validProfile(value), 400, '家庭档案格式无效。');
      requireValue(
        isDeepStrictEqual(family.data.profile, before),
        409,
        '家庭档案已被另一台设备修改。',
      );
      const mode = value.familyMode ?? family.mode;
      const currentRole = family.members.find((item) => item.id === userId)!.familyRole;
      const selectedRole = familyRole(
        value.parentRole ?? (mode === 'single' ? 'single_parent' : currentRole),
        mode,
      );
      updateFamilyChoice(userId, family, mode, selectedRole);
      family.data.profile = { ...value, familyMode: mode, parentRole: selectedRole };
    } else {
      requireValue(change.type === 'task' || change.type === 'expense', 400, '不支持的记录类型。');
      const validate = change.type === 'task' ? validTask : validExpense;
      requireValue(
        (before === null || validate(before)) &&
          (value === null || validate(value)) &&
          (before !== null || value !== null),
        400,
        '记录格式无效。',
      );
      const previous = before as { id: string } | null;
      const next = value as { id: string } | null;
      requireValue(!previous || !next || previous.id === next.id, 400, '不能修改记录编号。');
      const key = change.type === 'task' ? 'tasks' : 'expenses';
      const records = family.data[key];
      const id = (previous ?? next)!.id;
      const current = records.find((item) => item.id === id) ?? null;
      requireValue(isDeepStrictEqual(current, before), 409, '这条记录已被另一位成员修改或删除。');
      // Validate the complete result as well, including unique IDs and money bounds.
      const updated = [...records.filter((item) => item.id !== id), ...(value ? [value] : [])];
      family.data = decodeFamily(JSON.stringify({ ...family.data, [key]: updated }));
    }

    requireValue(
      Buffer.byteLength(JSON.stringify(family.data)) < 800000,
      413,
      '家庭记录已达到当前容量上限，请先导出备份。',
    );
    db.prepare('UPDATE families SET data = ? WHERE id = ?').run(
      JSON.stringify(family.data),
      family.id,
    );
    touch(family.id, userId);
    db.prepare('INSERT INTO receipts VALUES (?, ?, ?, ?)').run(
      userId,
      body.operationId,
      family.id,
      payloadHash,
    );
  }

  function updateFamilyChoice(
    userId: string,
    family: SharedFamily,
    mode: 'single' | 'couple',
    selectedRole: FamilyParentRole,
  ) {
    requireValue(
      mode !== 'single' || family.members.length === 1,
      409,
      '请先解除伴侣配对，再切换单人模式。',
    );
    requireValue(
      !family.members.some((item) => item.id !== userId && item.familyRole === selectedRole),
      409,
      '家庭中已有相同家长身份，请选择另一位身份。',
    );
    db.prepare('UPDATE families SET mode = ? WHERE id = ?').run(mode, family.id);
    db.prepare('UPDATE members SET family_role = ? WHERE user_id = ?').run(selectedRole, userId);

    if (mode !== family.mode) {
      db.prepare('DELETE FROM invites WHERE family_id = ?').run(family.id);
    }
  }

  function manage(userId: string, action: string, body: Body) {
    const member = authorize(
      userId,
      body,
      action === 'leave' || action === 'identity' ? 'member' : 'owner',
    );
    const family = snapshot(userId).family!;
    requireValue(body.revision === family.revision, 409, '家庭状态已更新，请同步后重试。');

    if (action === 'mode') {
      requireValue(body.mode === 'single' || body.mode === 'couple', 400, '家庭模式无效。');
      const selectedRole = familyRole(body.familyRole, body.mode);
      updateFamilyChoice(userId, family, body.mode, selectedRole);

      if (family.data.profile) {
        family.data.profile = {
          ...family.data.profile,
          familyMode: body.mode,
          parentRole: selectedRole,
        };
        db.prepare('UPDATE families SET data = ? WHERE id = ?').run(
          JSON.stringify(family.data),
          family.id,
        );
      }
    } else if (action === 'identity') {
      const selectedRole = familyRole(body.familyRole, family.mode);
      updateFamilyChoice(userId, family, family.mode, selectedRole);

      if (member.role === 'owner' && family.data.profile) {
        family.data.profile = {
          ...family.data.profile,
          familyMode: family.mode,
          parentRole: selectedRole,
        };
        db.prepare('UPDATE families SET data = ? WHERE id = ?').run(
          JSON.stringify(family.data),
          family.id,
        );
      }
    } else if (action === 'invite') {
      requireValue(
        family.mode === 'couple' && family.members.length === 1,
        409,
        '请先选择多人模式；当前支持母亲、父亲两位成员。',
      );
      requireValue(
        family.members[0].familyRole === 'mother' || family.members[0].familyRole === 'father',
        400,
        '请先选择你的家庭身份，再邀请另一位家长。',
      );
      const code = String(randomInt(100000, 1000000));
      const expiresAt = Date.now() + 86400000;
      db.prepare('DELETE FROM invites WHERE expires_at <= ? OR family_id = ?').run(
        Date.now(),
        family.id,
      );
      requireValue(
        !db.prepare('SELECT family_id FROM invites WHERE code_hash = ?').get(hash(code)),
        409,
        '邀请码生成冲突，请重试。',
      );
      db.prepare('INSERT INTO invites VALUES (?, ?, ?)').run(hash(code), family.id, expiresAt);
      touch(family.id, userId);

      return { code, expiresAt: new Date(expiresAt).toISOString() };
    } else if (action === 'revoke') {
      db.prepare('DELETE FROM invites WHERE family_id = ?').run(family.id);
    } else if (action === 'role' || action === 'remove') {
      const target = family.members.find((item) => item.id === body.userId);
      requireValue(target && target.role !== 'owner', 400, '请选择另一位家庭成员。');

      if (action === 'role') {
        requireValue(body.role === 'editor' || body.role === 'viewer', 400, '成员权限无效。');
        db.prepare('UPDATE members SET role = ? WHERE user_id = ?').run(body.role, target.id);
      } else {
        db.prepare('DELETE FROM members WHERE user_id = ?').run(target.id);
        db.prepare('DELETE FROM invites WHERE family_id = ?').run(family.id);
      }
    } else if (action === 'leave') {
      requireValue(member.role !== 'owner', 403, '管理员需保留家庭，请通过解除配对管理成员。');
      db.prepare('DELETE FROM members WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM invites WHERE family_id = ?').run(family.id);
    } else {
      throw new ApiError(404, '操作不存在。');
    }

    touch(family.id, userId);
  }

  function join(userId: string, body: Body) {
    requireValue(!membership(userId), 409, '你已经拥有家庭，不能重复加入。');
    requireValue(
      typeof body.code === 'string' && /^\d{6}$/.test(body.code),
      400,
      '请输入 6 位邀请码。',
    );
    const invitation = db
      .prepare('SELECT family_id FROM invites WHERE code_hash = ? AND expires_at > ?')
      .get(hash(body.code), Date.now()) as { family_id: string } | undefined;
    requireValue(invitation, 404, '邀请码无效、已过期或已被使用。');
    const familyId = String(invitation.family_id);
    const family = db.prepare('SELECT mode FROM families WHERE id = ?').get(familyId) as
      | { mode: string }
      | undefined;
    const count = db
      .prepare('SELECT count(*) AS count FROM members WHERE family_id = ?')
      .get(familyId) as { count: number };
    const existingMember = db
      .prepare('SELECT family_role FROM members WHERE family_id = ?')
      .get(familyId) as { family_role: string | null };
    const selectedFamilyRole = familyRole(body.familyRole, 'couple');
    requireValue(
      selectedFamilyRole !== existingMember.family_role,
      409,
      '家庭中已有相同家长身份，请选择另一位身份。',
    );
    requireValue(
      family?.mode === 'couple' && Number(count.count) < 2,
      409,
      '这个家庭已经满员或关闭了配对。',
    );
    db.prepare(
      'INSERT INTO members(user_id, family_id, role, family_role) VALUES (?, ?, ?, ?)',
    ).run(userId, familyId, 'editor', selectedFamilyRole);
    db.prepare('DELETE FROM invites WHERE family_id = ?').run(familyId);
    touch(familyId, userId);
  }

  function mutate(
    userId: string,
    action: string,
    body: Body,
  ): SessionState & {
    invitation?: { code: string; expiresAt: string };
    backupData?: FamilyData;
  } {
    return transaction(db, () => {
      let invitation;

      if (action === 'import-backup') {
        authorize(userId, body, 'owner');
        const row = db
          .prepare('SELECT data FROM import_backups WHERE family_id = ?')
          .get(String(body.familyId)) as { data: string } | undefined;
        requireValue(row, 404, '还没有导入前备份。');

        return { ...snapshot(userId), backupData: decodeFamily(row.data) };
      }

      if (action === 'create') {
        createFamily(userId, body);
      } else if (action === 'join') {
        join(userId, body);
      } else if (action === 'records') {
        changeRecords(userId, body);
      } else if (action === 'import') {
        importFamily(userId, body);
      } else {
        invitation = manage(userId, action, body);
      }

      return { ...snapshot(userId), invitation };
    });
  }

  function importFamily(userId: string, body: Body) {
    authorize(userId, body, 'owner');
    requireValue(
      typeof body.operationId === 'string' && /^[\w-]{10,100}$/.test(body.operationId),
      400,
      '缺少有效操作编号。',
    );
    const payloadHash = hash(
      JSON.stringify({
        action: 'import',
        familyId: body.familyId,
        data: body.data,
        revision: body.revision,
      }),
    );
    const receipt = db
      .prepare('SELECT payload_hash FROM receipts WHERE user_id = ? AND operation_id = ?')
      .get(userId, body.operationId) as { payload_hash: string } | undefined;

    if (receipt) {
      requireValue(receipt.payload_hash === payloadHash, 409, '操作编号已被使用，请重新选择文件。');

      return;
    }

    const family = snapshot(userId).family!;
    requireValue(
      body.revision === family.revision,
      409,
      '预览后家庭已有更新，请重新选择文件并核对。',
    );
    let data;

    try {
      data = decodeFamily(JSON.stringify(body.data));
    } catch {
      throw new ApiError(400, '备份格式无效，未修改任何记录。');
    }

    // A backup contains records, not membership or permission changes.
    if (data.profile) {
      const role = family.members.find((item) => item.id === userId)!.familyRole;
      requireValue(role, 400, '请先补选家庭身份再导入。');
      data.profile = { ...data.profile, familyMode: family.mode, parentRole: role };
    }

    data.theme = family.data.theme;
    requireValue(Buffer.byteLength(JSON.stringify(data)) < 800000, 413, '备份超过当前容量上限。');
    db.prepare(
      'INSERT INTO import_backups VALUES (?, ?, ?) ON CONFLICT(family_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at',
    ).run(family.id, JSON.stringify(family.data), new Date().toISOString());
    db.prepare('UPDATE families SET data = ? WHERE id = ?').run(JSON.stringify(data), family.id);
    touch(family.id, userId);
    db.prepare('INSERT INTO receipts VALUES (?, ?, ?, ?)').run(
      userId,
      body.operationId,
      family.id,
      payloadHash,
    );
  }

  return {
    authenticate,
    rotateRecovery,
    recover,
    deleteAccount,
    userForToken,
    snapshot,
    mutate,
    logout: (token: string) =>
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token)),
  };
}
