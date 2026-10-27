import {
  decodeFamily,
  applyPregnancyChange,
  sameValue,
  type Child,
  type FamilyData,
  type FamilyProfile,
  type FamilyTask,
  type Expense,
  type PregnancyChange,
  type PregnancyRecord,
} from './family.ts';

export type FamilyMode = 'single' | 'couple';
export type FamilyParentRole = 'single_parent' | 'mother' | 'father';
export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface Account {
  id: string;
  username: string;
  nickname: string;
}

export interface Member extends Account {
  role: MemberRole;
  familyRole: FamilyParentRole | null;
}

export interface SharedFamily {
  id: string;
  mode: FamilyMode;
  revision: number;
  data: FamilyData;
  members: Member[];
  updatedAt: string;
  updatedBy: string;
  inviteExpiresAt: string | null;
}

export interface SessionState {
  user: Account | null;
  family: SharedFamily | null;
}

export type FamilyChange =
  | PregnancyChange
  | { type: 'profile'; value: FamilyProfile; before: FamilyProfile | null }
  | { type: 'task'; value: FamilyTask | null; before: FamilyTask | null }
  | { type: 'expense'; value: Expense | null; before: Expense | null }
  | { type: 'child'; value: Child | null; before: Child | null };

function applyPendingRecord<T extends { id: string }>(
  records: readonly T[],
  change: { value: T | null; before: T | null },
  prepend = false,
): T[] | null {
  const id = change.before?.id ?? change.value?.id;

  if (!id || (!change.before && !change.value)) {
    return null;
  }

  const current = records.find((item) => item.id === id) ?? null;

  if (!sameValue(current, change.before)) {
    return sameValue(current, change.value) ? [...records] : null;
  }

  if (change.value === null) {
    return records.filter((item) => item.id !== id);
  }

  const updated = records.map((item) => (item.id === id ? change.value! : item));

  if (!change.before) {
    return prepend ? [change.value, ...updated] : [...updated, change.value];
  }

  return updated;
}

export function applyPendingFamilyChange(
  data: FamilyData,
  change: FamilyChange,
): FamilyData | null {
  if (change.type === 'pregnancy') {
    try {
      return applyPregnancyChange(data, change);
    } catch {
      return null;
    }
  }

  if (change.type === 'profile') {
    return sameValue(data.profile, change.before)
      ? { ...data, profile: change.value }
      : sameValue(data.profile, change.value)
        ? data
        : null;
  }

  if (change.type === 'task') {
    const tasks = applyPendingRecord(data.tasks, change);

    return tasks ? { ...data, tasks } : null;
  }

  if (change.type === 'expense') {
    const expenses = applyPendingRecord(data.expenses, change, true);

    return expenses ? { ...data, expenses } : null;
  }

  const children = applyPendingRecord(data.children ?? [], change);

  return children ? { ...data, children } : null;
}

export type FamilyDeltaRecordType =
  | 'profile'
  | 'task'
  | 'expense'
  | 'expense_prepend'
  | 'pregnancy'
  | 'child';

export interface FamilyDeltaEntry {
  revision: number;
  recordType: FamilyDeltaRecordType;
  recordId: string;
  value: unknown;
}

export interface FamilyDelta {
  familyId: string;
  fromRevision: number;
  revision: number;
  mode: FamilyMode;
  members: Member[];
  updatedAt: string;
  updatedBy: string;
  inviteExpiresAt: string | null;
  reset: boolean;
  entries: FamilyDeltaEntry[];
}

function replaceRecord<T extends { id: string }>(records: T[], id: string, value: T | null): T[] {
  const index = records.findIndex((item) => item.id === id);

  if (index >= 0) {
    records.splice(index, 1);

    if (value) {
      records.splice(index, 0, value);
    }
  } else if (value) {
    records.push(value);
  }

  return records;
}

export function applyFamilyDelta(current: SharedFamily, delta: FamilyDelta): SharedFamily | null {
  if (
    delta.reset ||
    current.id !== delta.familyId ||
    current.revision !== delta.fromRevision ||
    delta.revision < delta.fromRevision
  ) {
    return null;
  }

  let profile = current.data.profile;
  let tasks = [...current.data.tasks];
  let expenses = [...current.data.expenses];
  let pregnancyRecords = current.data.pregnancyRecords
    ? [...current.data.pregnancyRecords]
    : undefined;
  let children = current.data.children ? [...current.data.children] : undefined;

  for (const entry of delta.entries) {
    if (entry.recordType === 'profile') {
      profile = (entry.value as FamilyProfile | null) ?? null;
    } else if (entry.recordType === 'task') {
      tasks = replaceRecord(tasks, entry.recordId, (entry.value as FamilyTask | null) ?? null);
    } else if (entry.recordType === 'expense') {
      expenses = replaceRecord(expenses, entry.recordId, (entry.value as Expense | null) ?? null);
    } else if (entry.recordType === 'expense_prepend') {
      const expense = (entry.value as Expense | null) ?? null;
      expenses = expenses.filter((item) => item.id !== entry.recordId);

      if (expense) {
        expenses.unshift(expense);
      }
    } else if (entry.recordType === 'pregnancy') {
      const base = pregnancyRecords ?? [];
      pregnancyRecords = replaceRecord(
        base,
        entry.recordId,
        (entry.value as PregnancyRecord | null) ?? null,
      );
    } else if (entry.recordType === 'child') {
      const base = children ?? [];
      children = replaceRecord(base, entry.recordId, (entry.value as Child | null) ?? null);
    } else {
      return null;
    }
  }

  try {
    const candidate: FamilyData = {
      ...current.data,
      profile,
      tasks,
      expenses,
      ...(pregnancyRecords !== undefined ? { pregnancyRecords } : {}),
      ...(children !== undefined ? { children } : {}),
    };
    const validated = decodeFamily(JSON.stringify(candidate));

    return {
      id: current.id,
      mode: delta.mode,
      revision: delta.revision,
      data: validated,
      members: delta.members,
      updatedAt: delta.updatedAt,
      updatedBy: delta.updatedBy,
      inviteExpiresAt: delta.inviteExpiresAt,
    };
  } catch {
    return null;
  }
}

export const roleLabels: Record<MemberRole, string> = {
  owner: '管理员',
  editor: '共同编辑',
  viewer: '仅查看',
};

export const familyRoleLabels: Record<FamilyParentRole, string> = {
  single_parent: '单人照护者',
  mother: '母亲',
  father: '父亲',
};
