import type { FamilyData, FamilyProfile, FamilyTask, Expense } from './family';

export type FamilyMode = 'single' | 'couple';
export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface Account {
  id: string;
  username: string;
  nickname: string;
}

export interface Member extends Account {
  role: MemberRole;
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
  | { type: 'profile'; value: FamilyProfile; before: FamilyProfile | null }
  | { type: 'task'; value: FamilyTask | null; before: FamilyTask | null }
  | { type: 'expense'; value: Expense | null; before: Expense | null };

export const roleLabels: Record<MemberRole, string> = {
  owner: '管理员',
  editor: '共同编辑',
  viewer: '仅查看',
};
