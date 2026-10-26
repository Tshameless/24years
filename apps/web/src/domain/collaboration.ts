import {
  decodeFamily,
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
  | { type: 'expense'; value: Expense | null; before: Expense | null };

export type FamilyDeltaRecordType =
  | 'profile'
  | 'task'
  | 'expense'
  | 'expense_prepend'
  | 'pregnancy';

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

  for (const entry of delta.entries) {
    if (entry.recordType === 'profile') {
      profile = (entry.value as FamilyProfile | null) ?? null;
    } else if (entry.recordType === 'task') {
      tasks = [
        ...tasks.filter((item) => item.id !== entry.recordId),
        ...(entry.value ? [entry.value as FamilyTask] : []),
      ];
    } else if (entry.recordType === 'expense') {
      expenses = [
        ...expenses.filter((item) => item.id !== entry.recordId),
        ...(entry.value ? [entry.value as Expense] : []),
      ];
    } else if (entry.recordType === 'expense_prepend') {
      expenses = [
        ...(entry.value ? [entry.value as Expense] : []),
        ...expenses.filter((item) => item.id !== entry.recordId),
      ];
    } else if (entry.recordType === 'pregnancy') {
      const base = pregnancyRecords ?? [];
      pregnancyRecords = [
        ...base.filter((item) => item.id !== entry.recordId),
        ...(entry.value ? [entry.value as PregnancyRecord] : []),
      ];
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
