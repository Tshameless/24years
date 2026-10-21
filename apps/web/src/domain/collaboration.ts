import type { FamilyData, FamilyProfile, FamilyTask, Expense, PregnancyChange } from './family';

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
