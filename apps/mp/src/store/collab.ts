import { reactive } from 'vue';

import { decodeFamily } from '@24years/domain/family';

import { getCloud } from '@/utils/cloud';

import { authStore, isSignedIn, restoreSession } from './auth';
import { familyStore, replaceFamily } from './family';

const SPACE_STORAGE_KEY = '24years.space.v1';

/** 去掉了容易看错的 0/O、1/I，便于口头转述。 */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const PUSH_DEBOUNCE_MS = 1200;

export interface FamilyMember {
  ownerId: string;
  displayName: string;
  role: string;
  joinedAt: string;
}

interface FamilyRow {
  id: number;
  name: string;
  invite_code: string;
  /** 原始 JSON 快照，结构与版本由 decodeFamily 校验。 */
  payload: unknown;
  version: number;
  owner_id: string;
}

interface MemberRow {
  family_id: number;
  owner_id: string;
  display_name: string | null;
  role: string;
  joined_at: string;
}

interface CollabState {
  ready: boolean;
  loading: boolean;
  syncing: boolean;
  spaceId: number | null;
  spaceName: string;
  inviteCode: string;
  /** 服务端版本号，写入时用它做乐观并发检测。 */
  version: number;
  members: FamilyMember[];
  error: string;
  conflict: boolean;
  lastSyncedAt: string;
}

export const collabStore = reactive<CollabState>({
  ready: false,
  loading: false,
  syncing: false,
  spaceId: null,
  spaceName: '',
  inviteCode: '',
  version: 0,
  members: [],
  error: '',
  conflict: false,
  lastSyncedAt: '',
});

/** 冲突时暂存的远端快照，等用户在两个版本间做选择。 */
let pendingRemote: { payload: unknown; version: number } | null = null;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let suppressPush = false;

function readStoredSpaceId(): number | null {
  const raw = uni.getStorageSync(SPACE_STORAGE_KEY);
  const value = Number(raw);

  return raw && Number.isFinite(value) ? value : null;
}

function rememberSpaceId(id: number | null): void {
  if (id === null) {
    uni.removeStorageSync(SPACE_STORAGE_KEY);

    return;
  }

  uni.setStorageSync(SPACE_STORAGE_KEY, String(id));
}

function generateInviteCode(): string {
  let code = '';

  for (let index = 0; index < 8; index += 1) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }

  return code;
}

function toRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * 用远端数据覆盖本地。
 * suppressPush 保证「拉下来的数据不会被立刻当成本地改动推回去」。
 */
function applyRemote(payload: unknown, version: number): void {
  suppressPush = true;

  try {
    replaceFamily(decodeFamily(JSON.stringify(payload)));
  } finally {
    suppressPush = false;
  }

  collabStore.version = version;
}

async function loadMembers(spaceId: number): Promise<void> {
  const { data, error } = await getCloud()
    .database.from('family_members')
    .select('family_id, owner_id, display_name, role, joined_at')
    .eq('family_id', spaceId)
    .order('joined_at', { ascending: true });

  if (error) {
    collabStore.error = error.message;

    return;
  }

  collabStore.members = toRows<MemberRow>(data).map((row) => ({
    ownerId: row.owner_id,
    displayName: row.display_name ?? '',
    role: row.role,
    joinedAt: String(row.joined_at).slice(0, 10),
  }));
}

/** 拉取家庭数据本体。首次进入与手动刷新都走这里。 */
export async function pullSpace(): Promise<void> {
  const spaceId = collabStore.spaceId;

  if (!spaceId) {
    return;
  }

  collabStore.loading = true;

  try {
    const { data, error } = await getCloud()
      .database.from('families')
      .select('id, name, invite_code, payload, version, owner_id')
      .eq('id', spaceId)
      .maybeSingle();

    if (error) {
      collabStore.error = error.message;

      return;
    }

    if (!data) {
      collabStore.error = '找不到可用的家庭空间，可能已被移除';

      return;
    }

    const row = data as FamilyRow;

    collabStore.spaceName = row.name;
    collabStore.inviteCode = row.invite_code;
    collabStore.error = '';
    collabStore.lastSyncedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    applyRemote(row.payload, row.version);
    await loadMembers(spaceId);
  } finally {
    collabStore.loading = false;
  }
}

/** 定位当前账号所属的家庭：优先上次用过的，其次按成员关系取最早加入的。 */
async function resolveSpace(): Promise<void> {
  const stored = readStoredSpaceId();

  if (stored !== null) {
    collabStore.spaceId = stored;
    await pullSpace();

    if (!collabStore.error) {
      return;
    }

    collabStore.spaceId = null;
    collabStore.error = '';
  }

  const { data, error } = await getCloud()
    .database.from('family_members')
    .select('family_id')
    .order('joined_at', { ascending: true })
    .limit(1);

  if (error) {
    collabStore.error = error.message;

    return;
  }

  const first = toRows<{ family_id: number }>(data)[0];

  if (!first?.family_id) {
    return;
  }

  collabStore.spaceId = first.family_id;
  rememberSpaceId(first.family_id);
  await pullSpace();
}

/** App 启动入口：恢复会话 → 定位家庭 → 拉数据。 */
export async function bootstrapCollaboration(): Promise<void> {
  await restoreSession();

  if (isSignedIn()) {
    await resolveSpace();
  }

  collabStore.ready = true;
}

export async function createSpace(name: string): Promise<boolean> {
  if (!isSignedIn()) {
    collabStore.error = '请先登录再开启家庭共享';

    return false;
  }

  collabStore.loading = true;

  try {
    const inviteCode = generateInviteCode();
    const { data, error } = await getCloud()
      .database.from('families')
      .insert({
        invite_code: inviteCode,
        name: name.trim() || '我的家庭',
        payload: familyStore.data,
        version: 1,
      })
      .select('id, name, invite_code, version');

    if (error) {
      collabStore.error = error.message;

      return false;
    }

    const row = toRows<FamilyRow>(data)[0];

    if (!row) {
      collabStore.error = '创建家庭空间失败，请确认已登录';

      return false;
    }

    const membership = await getCloud()
      .database.from('family_members')
      .insert({
        family_id: row.id,
        display_name: authStore.account?.name || null,
        role: 'owner',
      });

    if (membership.error) {
      collabStore.error = membership.error.message;

      return false;
    }

    collabStore.spaceId = row.id;
    collabStore.spaceName = row.name;
    collabStore.inviteCode = row.invite_code;
    collabStore.version = row.version;
    collabStore.conflict = false;
    collabStore.error = '';
    rememberSpaceId(row.id);
    await loadMembers(row.id);

    return true;
  } finally {
    collabStore.loading = false;
  }
}

export async function joinSpace(rawCode: string): Promise<boolean> {
  const code = rawCode.trim().toUpperCase();

  if (!isSignedIn()) {
    collabStore.error = '请先登录再加入家庭';

    return false;
  }

  if (!code) {
    collabStore.error = '请输入家人给你的邀请码';

    return false;
  }

  collabStore.loading = true;

  try {
    const { data, error } = await getCloud().database.rpc('join_family', { p_invite_code: code });

    if (error) {
      collabStore.error = error.message.includes('invite code not found')
        ? '邀请码不正确或已失效'
        : error.message;

      return false;
    }

    const row = toRows<{ target_family_id: number }>(data)[0];

    if (!row?.target_family_id) {
      collabStore.error = '加入失败，服务端未返回家庭空间';

      return false;
    }

    collabStore.spaceId = row.target_family_id;
    collabStore.version = 0;
    collabStore.conflict = false;
    collabStore.error = '';
    rememberSpaceId(row.target_family_id);
    await pullSpace();

    return true;
  } finally {
    collabStore.loading = false;
  }
}

/**
 * 本地数据发生变更时由 store/family 触发。
 * 合并短时间内的连续改动，避免每敲一次就写一次云端。
 */
export function scheduleCloudPush(): void {
  if (suppressPush || !collabStore.spaceId || collabStore.conflict) {
    return;
  }

  if (!isSignedIn()) {
    return;
  }

  if (pushTimer) {
    clearTimeout(pushTimer);
  }

  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushFamily();
  }, PUSH_DEBOUNCE_MS);
}

async function fetchCurrentRow(): Promise<FamilyRow | null> {
  const spaceId = collabStore.spaceId;

  if (!spaceId) {
    return null;
  }

  const { data, error } = await getCloud()
    .database.from('families')
    .select('id, name, invite_code, payload, version, owner_id')
    .eq('id', spaceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as FamilyRow;
}

async function pushFamily(): Promise<void> {
  const spaceId = collabStore.spaceId;

  if (!spaceId || collabStore.syncing) {
    return;
  }

  if (!isSignedIn()) {
    collabStore.error = '登录状态已失效，云同步暂停';

    return;
  }

  collabStore.syncing = true;

  try {
    const nextVersion = collabStore.version + 1;
    const { data, error } = await getCloud()
      .database.from('families')
      .update({
        payload: familyStore.data,
        version: nextVersion,
        updated_by: authStore.account?.id ?? null,
      })
      .eq('id', spaceId)
      .eq('version', collabStore.version)
      .select('id, version');

    if (error) {
      collabStore.error = error.message;

      return;
    }

    if (toRows<{ id: number; version: number }>(data).length === 0) {
      // 版本号对不上：家人刚在这台设备之前写了一次，进入人工选择。
      const remote = await fetchCurrentRow();

      if (remote) {
        pendingRemote = { payload: remote.payload, version: remote.version };
      }

      collabStore.conflict = true;
      uni.showToast({
        title: '家人刚更新过同一份数据，请在「我的 · 家庭共享」选择保留哪个版本',
        icon: 'none',
        duration: 3000,
      });

      return;
    }

    collabStore.version = nextVersion;
    collabStore.conflict = false;
    collabStore.error = '';
    collabStore.lastSyncedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  } finally {
    collabStore.syncing = false;
  }
}

/** 冲突解决：取家人那边的版本。 */
export async function keepRemoteVersion(): Promise<void> {
  if (pendingRemote) {
    applyRemote(pendingRemote.payload, pendingRemote.version);
  }

  pendingRemote = null;
  collabStore.conflict = false;
}

/** 冲突解决：以这台设备的数据覆盖云端。 */
export async function keepLocalVersion(): Promise<void> {
  const remote = await fetchCurrentRow();

  pendingRemote = null;
  collabStore.conflict = false;

  if (remote) {
    collabStore.version = remote.version;
  }

  await pushFamily();
}

export function hasPendingConflict(): boolean {
  return collabStore.conflict;
}

export async function signOutCollaboration(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }

  pendingRemote = null;
  collabStore.conflict = false;
  collabStore.ready = false;
  collabStore.spaceId = null;
  collabStore.spaceName = '';
  collabStore.inviteCode = '';
  collabStore.members = [];
  collabStore.version = 0;
  collabStore.error = '';
  rememberSpaceId(null);
}
