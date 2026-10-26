import { randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import {
  applyPregnancyChange,
  canonicalJson,
  decodeFamily,
  PregnancyChangeError,
  validChild,
  validExpense,
  validProfile,
  validTask,
  type Child,
  type Expense,
  type FamilyData,
  type FamilyTask,
  type PregnancyChange,
} from '../src/domain/family.ts';
import type {
  Account,
  FamilyDeltaRecordType,
  FamilyParentRole,
  Member,
  SessionState,
  SharedFamily,
} from '../src/domain/collaboration.ts';
import { familyBlobBytes, MAX_CLOUD_BYTES } from '../src/domain/capacity.ts';
import { transaction } from './database.ts';
import { ApiError, hash, requireValue, type Body } from './auth.ts';
import {
  recordDeltaEntries,
  recordResetChange,
  familyBlobData,
  readRelationalRecord,
  syncFamilyTables,
  upsertChildRow,
  upsertExpenseRow,
  upsertPregnancyRow,
  upsertTaskRow,
} from './records-store.ts';

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

export function createFamilyMutations(options: {
  db: DatabaseSync;
  account: (id: string) => Account;
  membership: (userId: string) => { family_id: string; role: Member['role'] } | undefined;
  snapshot: (userId: string) => SessionState;
  touch: (familyId: string, userId: string) => void;
  authorize: (
    userId: string,
    body: Body,
    permission?: 'owner' | 'edit' | 'member',
  ) => { family_id: string; role: Member['role'] };
}) {
  const { db, account, membership, snapshot, touch, authorize } = options;
  const inviteLockThreshold = 8;
  const inviteLockDurationMs = 15 * 60 * 1000;

  function recordInviteFailure(
    userId: string,
    familyId: string | undefined,
    outcome: 'failed' | 'locked' | 'expired',
  ) {
    if (!familyId || !/^[\w-]{10,100}$/.test(familyId)) {
      return;
    }

    const now = Date.now();
    const security = db
      .prepare('SELECT failed_attempts, locked_until FROM family_invite_security WHERE family_id = ?')
      .get(familyId) as { failed_attempts: number; locked_until: number } | undefined;
    const locked = Number(security?.locked_until ?? 0) > now;
    const attempts = locked ? Number(security?.failed_attempts ?? inviteLockThreshold) : Number(security?.failed_attempts ?? 0) + 1;
    const lockedUntil = attempts >= inviteLockThreshold ? now + inviteLockDurationMs : 0;
    db.prepare(
      `INSERT INTO family_invite_security(family_id, failed_attempts, locked_until, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(family_id) DO UPDATE SET failed_attempts = excluded.failed_attempts,
         locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
    ).run(familyId, attempts, lockedUntil, now);
    db.prepare('INSERT INTO invite_audit(family_id, user_id, outcome, created_at) VALUES (?, ?, ?, ?)').run(
      familyId,
      userId,
      locked || lockedUntil > now ? 'locked' : outcome,
      now,
    );
  }

  function recordInviteSuccess(userId: string, familyId: string) {
    const now = Date.now();
    db.prepare('DELETE FROM family_invite_security WHERE family_id = ?').run(familyId);
    db.prepare('INSERT INTO invite_audit(family_id, user_id, outcome, created_at) VALUES (?, ?, ?, ?)').run(
      familyId,
      userId,
      'success',
      now,
    );
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

    requireValue(
      familyBlobBytes(data) < MAX_CLOUD_BYTES,
      413,
      '档案超过云端 800 KB 容量上限，可继续在本机保存。',
    );

    const familyId = randomUUID();
    const now = new Date().toISOString();
    const initialData: FamilyData = { ...data, theme: 'light' };
    db.prepare('INSERT INTO families VALUES (?, ?, ?, 1, ?, ?)').run(
      familyId,
      body.mode,
      JSON.stringify(familyBlobData(initialData)),
      now,
      account(userId).nickname,
    );
    db.prepare(
      'INSERT INTO members(user_id, family_id, role, family_role) VALUES (?, ?, ?, ?)',
    ).run(userId, familyId, 'owner', selectedFamilyRole);
    syncFamilyTables(db, familyId, initialData, now);
    recordResetChange(db, familyId, 1);
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

  function changeRecords(userId: string, body: Body) {
    const member = authorize(userId, body);
    requireValue(
      typeof body.operationId === 'string' && /^[\w-]{10,100}$/.test(body.operationId),
      400,
      '缺少有效操作编号。',
    );
    const payloadHash = hash(canonicalJson({ familyId: body.familyId, change: body.change }));
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
    const now = new Date().toISOString();
    const deltaEntries: Array<{
      recordType: FamilyDeltaRecordType;
      recordId: string;
      value: unknown;
    }> = [];

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
      deltaEntries.push({ recordType: 'profile', recordId: 'profile', value: family.data.profile });
    } else if (change.type === 'pregnancy') {
      const previousProfile = family.data.profile;
      const pregnancyChange = change as unknown as PregnancyChange;

      try {
        family.data = applyPregnancyChange(family.data, pregnancyChange);
      } catch (reason) {
        if (reason instanceof PregnancyChangeError) {
          throw new ApiError(reason.status, reason.message);
        }

        throw reason;
      }

      const recordId = (pregnancyChange.before ?? pregnancyChange.value)!.id;
      const currentPosition = pregnancyChange.before
        ? (
            db
              .prepare(
                'SELECT position FROM family_pregnancy_records WHERE family_id = ? AND id = ?',
              )
              .get(family.id, recordId) as { position: number } | undefined
          )?.position
        : undefined;
      upsertPregnancyRow(
        db,
        family.id,
        recordId,
        pregnancyChange.value,
        now,
        currentPosition,
      );
      deltaEntries.push({
        recordType: 'pregnancy',
        recordId,
        value: pregnancyChange.value,
      });

      if (pregnancyChange.expense) {
        upsertExpenseRow(
          db,
          family.id,
          pregnancyChange.expense.id,
          pregnancyChange.expense,
          true,
          now,
        );
        deltaEntries.push({
          recordType: 'expense_prepend',
          recordId: pregnancyChange.expense.id,
          value: pregnancyChange.expense,
        });
      }

      if (!isDeepStrictEqual(previousProfile, family.data.profile)) {
        deltaEntries.push({
          recordType: 'profile',
          recordId: 'profile',
          value: family.data.profile,
        });
      }
    } else if (change.type === 'child') {
      requireValue(
        (before === null || validChild(before)) &&
          (value === null || validChild(value)) &&
          (before !== null || value !== null),
        400,
        '孩子记录格式无效。',
      );
      const previous = before as { id: string } | null;
      const next = value as { id: string } | null;
      requireValue(!previous || !next || previous.id === next.id, 400, '不能修改孩子记录编号。');
      const id = (previous ?? next)!.id;
      const currentRow = readRelationalRecord<Child>(db, 'family_children', family.id, id);
      const current = currentRow?.value ?? null;
      requireValue(
        isDeepStrictEqual(current, before),
        409,
        '这条孩子记录已被另一位成员修改或删除。',
      );
      upsertChildRow(
        db,
        family.id,
        id,
        value as Child | null,
        now,
        currentRow?.position,
      );
      deltaEntries.push({ recordType: 'child', recordId: id, value });
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
      const id = (previous ?? next)!.id;
      const table = change.type === 'task' ? 'family_tasks' : 'family_expenses';
      const currentRow = readRelationalRecord<FamilyTask | Expense>(db, table, family.id, id);
      const current = currentRow?.value ?? null;
      requireValue(isDeepStrictEqual(current, before), 409, '这条记录已被另一位成员修改或删除。');

      if (change.type === 'task') {
        upsertTaskRow(
          db,
          family.id,
          id,
          value as FamilyTask | null,
          now,
          currentRow?.position,
        );
        deltaEntries.push({ recordType: 'task', recordId: id, value });
      } else {
        upsertExpenseRow(
          db,
          family.id,
          id,
          value as Expense | null,
          false,
          now,
          currentRow?.position,
        );
        deltaEntries.push({ recordType: 'expense', recordId: id, value });
      }
    }

    requireValue(
      familyBlobBytes(family.data) < MAX_CLOUD_BYTES,
      413,
      '家庭记录已达到当前容量上限，请先导出备份。',
    );
    const compactData = JSON.stringify(familyBlobData(family.data));
    const storedData = db
      .prepare('SELECT data FROM families WHERE id = ?')
      .get(family.id) as { data: string } | undefined;
    // Task, expense, child and pregnancy collection edits are row-local. Only
    // persist the blob when low-frequency metadata (for example profile) changed.
    if (storedData?.data !== compactData) {
      db.prepare('UPDATE families SET data = ? WHERE id = ?').run(compactData, family.id);
    }
    touch(family.id, userId);
    recordDeltaEntries(db, family.id, family.revision + 1, deltaEntries);
    db.prepare(
      'INSERT INTO receipts(user_id, operation_id, family_id, payload_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, body.operationId, family.id, payloadHash, Date.now());
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
          JSON.stringify(familyBlobData(family.data)),
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
          JSON.stringify(familyBlobData(family.data)),
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
      const code = randomBytes(9).toString('base64url').slice(0, 12);
      const expiresAt = Date.now() + 15 * 60 * 1000;
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
      recordDeltaEntries(db, family.id, family.revision + 1, [
        { recordType: 'profile', recordId: 'profile', value: family.data.profile },
      ]);

      return { code, expiresAt: new Date(expiresAt).toISOString(), familyId: family.id };
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
    recordDeltaEntries(db, family.id, family.revision + 1, [
      { recordType: 'profile', recordId: 'profile', value: family.data.profile },
    ]);
  }

  function join(userId: string, body: Body) {
    requireValue(!membership(userId), 409, '你已经拥有家庭，不能重复加入。');
    requireValue(
      typeof body.code === 'string' && /^[A-Za-z0-9_-]{12}$/.test(body.code),
      400,
      '请输入 12 位邀请码。',
    );

    if (body.familyId !== undefined) {
      requireValue(
        typeof body.familyId === 'string' && /^[\w-]{10,100}$/.test(body.familyId),
        400,
        '家庭邀请链接无效。',
      );
    }

    const requestedFamilyId = typeof body.familyId === 'string' ? body.familyId : undefined;
    const security = requestedFamilyId
      ? (db
          .prepare('SELECT locked_until FROM family_invite_security WHERE family_id = ?')
          .get(requestedFamilyId) as { locked_until: number } | undefined)
      : undefined;
    requireValue(
      !security || Number(security.locked_until) <= Date.now(),
      429,
      '该家庭配对尝试过多，请 15 分钟后重试。',
    );

    const invitation = db
      .prepare(
        'SELECT family_id FROM invites WHERE code_hash = ? AND expires_at > ? AND (? IS NULL OR family_id = ?)',
      )
      .get(hash(body.code), Date.now(), body.familyId ?? null, body.familyId ?? null) as
      | { family_id: string }
      | undefined;

    if (!invitation) {
      throw new ApiError(404, '邀请码无效、已过期或已被使用。');
    }

    const familyId = String(invitation.family_id);
    const family = db
      .prepare('SELECT mode, revision, data FROM families WHERE id = ?')
      .get(familyId) as { mode: string; revision: number; data: string } | undefined;
    const count = db
      .prepare('SELECT count(*) AS count FROM members WHERE family_id = ?')
      .get(familyId) as { count: number };
    const existingMember = db
      .prepare('SELECT family_role FROM members WHERE family_id = ?')
      .get(familyId) as { family_role: string | null };
    const selectedFamilyRole = familyRole(body.familyRole, 'couple');
    requireValue(selectedFamilyRole !== existingMember.family_role, 409, '家庭中已有相同家长身份，请选择另一位身份。');
    requireValue(
      family?.mode === 'couple' && Number(count.count) < 2,
      409,
      '这个家庭已经满员或关闭了配对。',
    );
    db.prepare(
      'INSERT INTO members(user_id, family_id, role, family_role) VALUES (?, ?, ?, ?)',
    ).run(userId, familyId, 'editor', selectedFamilyRole);
    db.prepare('DELETE FROM invites WHERE family_id = ?').run(familyId);
    recordInviteSuccess(userId, familyId);
    touch(familyId, userId);
    recordDeltaEntries(db, familyId, family.revision + 1, [
      {
        recordType: 'profile',
        recordId: 'profile',
        value: decodeFamily(family.data).profile,
      },
    ]);
  }

  function importFamily(userId: string, body: Body) {
    authorize(userId, body, 'owner');
    requireValue(
      typeof body.operationId === 'string' && /^[\w-]{10,100}$/.test(body.operationId),
      400,
      '缺少有效操作编号。',
    );
    const payloadHash = hash(
      canonicalJson({
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
    requireValue(
      familyBlobBytes(data) < MAX_CLOUD_BYTES,
      413,
      '备份内容超过云端 800 KB 容量上限，可退出账号后恢复到本机。',
    );
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO import_backups VALUES (?, ?, ?) ON CONFLICT(family_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at',
    ).run(family.id, JSON.stringify(family.data), now);
    db.prepare('UPDATE families SET data = ? WHERE id = ?').run(
      JSON.stringify(familyBlobData(data)),
      family.id,
    );
    syncFamilyTables(db, family.id, data, now);
    touch(family.id, userId);
    recordResetChange(db, family.id, family.revision + 1);
    db.prepare(
      'INSERT INTO receipts(user_id, operation_id, family_id, payload_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, body.operationId, family.id, payloadHash, Date.now());
  }

  function mutate(
    userId: string,
    action: string,
    body: Body,
  ): SessionState & {
    invitation?: { code: string; expiresAt: string };
    backupData?: FamilyData;
  } {
    try {
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
    } catch (error) {
      if (action === 'join') {
        const familyId = typeof body.familyId === 'string' ? body.familyId : undefined;
        recordInviteFailure(
          userId,
          familyId,
          error instanceof ApiError && error.status === 429 ? 'locked' : 'failed',
        );
      }

      throw error;
    }
  }

  return { mutate };
}
