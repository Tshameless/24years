import { randomInt, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import {
  applyPregnancyChange,
  canonicalJson,
  decodeFamily,
  PregnancyChangeError,
  validExpense,
  validProfile,
  validTask,
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
import { familyBytes, MAX_CLOUD_BYTES } from '../src/domain/capacity.ts';
import { transaction } from './database.ts';
import { ApiError, hash, requireValue, type Body } from './auth.ts';
import {
  recordDeltaEntries,
  recordResetChange,
  syncFamilyTables,
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
      familyBytes(data) < MAX_CLOUD_BYTES,
      413,
      '档案超过云端 800 KB 容量上限，可继续在本机保存。',
    );

    const familyId = randomUUID();
    const now = new Date().toISOString();
    const initialData: FamilyData = { ...data, theme: 'light' };
    db.prepare('INSERT INTO families VALUES (?, ?, ?, 1, ?, ?)').run(
      familyId,
      body.mode,
      JSON.stringify(initialData),
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
      upsertPregnancyRow(db, family.id, recordId, pregnancyChange.value, now);
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
      const updated = [...records.filter((item) => item.id !== id), ...(value ? [value] : [])];
      family.data = { ...family.data, [key]: updated as never };

      if (change.type === 'task') {
        upsertTaskRow(db, family.id, id, value as FamilyTask | null, now);
        deltaEntries.push({ recordType: 'task', recordId: id, value });
      } else {
        upsertExpenseRow(db, family.id, id, value as Expense | null, false, now);
        deltaEntries.push({ recordType: 'expense', recordId: id, value });
      }
    }

    requireValue(
      familyBytes(family.data) < MAX_CLOUD_BYTES,
      413,
      '家庭记录已达到当前容量上限，请先导出备份。',
    );
    db.prepare('UPDATE families SET data = ? WHERE id = ?').run(
      JSON.stringify(family.data),
      family.id,
    );
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
      recordDeltaEntries(db, family.id, family.revision + 1, [
        { recordType: 'profile', recordId: 'profile', value: family.data.profile },
      ]);

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
    recordDeltaEntries(db, family.id, family.revision + 1, [
      { recordType: 'profile', recordId: 'profile', value: family.data.profile },
    ]);
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
      familyBytes(data) < MAX_CLOUD_BYTES,
      413,
      '备份内容超过云端 800 KB 容量上限，可退出账号后恢复到本机。',
    );
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO import_backups VALUES (?, ?, ?) ON CONFLICT(family_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at',
    ).run(family.id, JSON.stringify(family.data), now);
    db.prepare('UPDATE families SET data = ? WHERE id = ?').run(JSON.stringify(data), family.id);
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

  return { mutate };
}
