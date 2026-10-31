import { reactive } from 'vue';

import {
  applyPendingFamilyChange,
  roleLabels,
  type FamilyChange,
  type MemberRole,
} from '@24years/domain/collaboration';
import { decodeFamily, type FamilyData } from '@24years/domain/family';
import {
  clearFamilyOutbox,
  enqueueOutboxEntry,
  readOutbox,
  removeOutboxEntry,
  type OutboxEntry,
} from '@24years/domain/outbox';

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
    // 本地数据已被整体替换，队列里残留变更的 before 全部失效；
    // 留着会在下次同步时拿旧 before 去比对新数据，结果全被打回或错配，必须清掉。
    clearFamilyOutbox(outboxKey());
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
    // 本机离线时攒下的队列已经整份写进新家庭了，不留残留。
    clearFamilyOutbox('local');
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

/** 当前账号在这个家庭里的角色。 */
function myRole(): MemberRole | null {
  const myId = authStore.account?.id;

  if (!myId) {
    return null;
  }

  const mine = collabStore.members.find((member) => member.ownerId === myId);

  return mine ? (mine.role as MemberRole) : null;
}

/**
 * viewer 只能看：本地改动不会被推上云端。
 * 云端另有 RLS 兜底（families_update_member 已限定 owner/editor），
 * 这里只是为了让用户在改之前就知道改了没用。
 */
export function canEdit(): boolean {
  const role = myRole();

  return role === 'owner' || role === 'editor';
}

/** 成员角色用领域层文案，避免两端措辞漂移。 */
export function memberRoleLabel(role: string): string {
  return role in roleLabels ? roleLabels[role as MemberRole] : role;
}

/** 待发队列按家庭隔离；还没接入云空间时用一个本机固定键。 */
function outboxKey(): string {
  return collabStore.spaceId === null ? 'local' : String(collabStore.spaceId);
}

/**
 * 本地数据发生变更时由 store/family 触发，拿到的是**变更明细**。
 * 先落本机队列保证离线不丢，再合并短时间内的连续输入一次性上传。
 */
export function scheduleCloudPush(changes: FamilyChange[]): void {
  if (suppressPush || !collabStore.spaceId || collabStore.conflict) {
    return;
  }

  if (!isSignedIn() || !canEdit()) {
    return;
  }

  const key = outboxKey();
  const now = Date.now();

  changes.forEach((change, index) => {
    const id = `${now}-${index}`;

    try {
      enqueueOutboxEntry(key, {
        id,
        familyId: key,
        operationId: id,
        change,
        createdAt: now,
        retryCount: 0,
      });
    } catch {
      uni.showToast({ title: '离线待同步记录过多，请先联网同步', icon: 'none' });
    }
  });

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

/**
 * 增量上传：把本机待发队列里的变更**逐条应用到云端最新数据之上**，再写回。
 *
 * 这是双人同时编辑不丢数据的关键。A 改账本、B 改孕期记录时，
 * 两条变更作用在不同记录上，各自的 before 都能对上、都能应用成功，
 * 于是两边的改动都留下；只有改了同一条记录的同一字段才会真的冲突。
 *
 * 旧实现直接拿本地整份快照覆盖，会让先写入的一方改动被静默吞掉。
 */
async function pushFamily(): Promise<void> {
  const spaceId = collabStore.spaceId;

  if (!spaceId || collabStore.syncing) {
    return;
  }

  if (!isSignedIn() || !canEdit()) {
    return;
  }

  const key = outboxKey();
  const entries = readOutbox(key);

  if (entries.length === 0) {
    return;
  }

  collabStore.syncing = true;

  try {
    const remote = await fetchCurrentRow();

    if (!remote) {
      collabStore.error = '读不到云端档案，稍后自动重试';

      return;
    }

    let base: FamilyData;

    try {
      base = decodeFamily(JSON.stringify(remote.payload));
    } catch {
      collabStore.error = '云端档案格式异常，已暂停同步';

      return;
    }

    let merged = base;
    const applied: string[] = [];
    const blocked: OutboxEntry[] = [];

    for (const entry of entries) {
      const next = applyPendingFamilyChange(merged, entry.change);

      if (next) {
        merged = next;
        applied.push(entry.id);
      } else {
        blocked.push(entry);
      }
    }

    if (applied.length === 0) {
      // 一条都没能应用：确实和家人改在了同一处，交人工裁决。
      pendingRemote = { payload: remote.payload, version: remote.version };
      collabStore.conflict = true;
      uni.showToast({
        title: '家人也改了同一处，请在「我的 · 家庭共享」选择保留哪个版本',
        icon: 'none',
        duration: 3000,
      });

      return;
    }

    const nextVersion = remote.version + 1;
    const { data, error } = await getCloud()
      .database.from('families')
      .update({
        payload: merged,
        version: nextVersion,
        updated_by: authStore.account?.id ?? null,
      })
      .eq('id', spaceId)
      .eq('version', remote.version)
      .select('id, version');

    if (error) {
      collabStore.error = error.message;

      return;
    }

    if (toRows<{ id: number }>(data).length === 0) {
      // 写回这一瞬间又被家人抢先了：队列原样保留，下一轮重放。
      return;
    }

    // 只清掉真正上去的条目，被挡住的留着下次重试，不丢数据。
    applied.forEach((entryId) => removeOutboxEntry(key, entryId));

    collabStore.version = nextVersion;
    collabStore.error = '';
    collabStore.lastSyncedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    if (blocked.length > 0) {
      // 部分合并成功：能合的已经合了，剩下的仍需用户裁决。
      pendingRemote = { payload: merged, version: nextVersion };
      collabStore.conflict = true;
      uni.showToast({
        title: '部分改动与他人重叠，请在「我的 · 家庭共享」确认',
        icon: 'none',
        duration: 3000,
      });
    }
  } finally {
    collabStore.syncing = false;
  }
}

/** 冲突解决：取家人那边的版本，本机这一轮的待发改动作废。 */
export async function keepRemoteVersion(): Promise<void> {
  if (pendingRemote) {
    applyRemote(pendingRemote.payload, pendingRemote.version);
    clearFamilyOutbox(outboxKey());
  }

  pendingRemote = null;
  collabStore.conflict = false;
}

/**
 * 冲突解决：以这台设备为准整份覆写云端。
 * 这是用户明确裁决后的动作，会丢掉对方在这轮冲突范围内的改动——
 * 所以必须让用户自己点，绝不能自动替他选。
 */
export async function keepLocalVersion(): Promise<void> {
  pendingRemote = null;
  collabStore.conflict = false;
  clearFamilyOutbox(outboxKey());

  await forcePush();
}

/** 整份覆写，跳过增量合并：用户已明确选择以本机为准。 */
async function forcePush(): Promise<void> {
  const spaceId = collabStore.spaceId;

  if (!spaceId || collabStore.syncing || !isSignedIn()) {
    return;
  }

  const remote = await fetchCurrentRow();

  if (!remote) {
    collabStore.error = '读不到云端档案，无法覆盖';

    return;
  }

  collabStore.syncing = true;

  try {
    const nextVersion = remote.version + 1;
    const { data, error } = await getCloud()
      .database.from('families')
      .update({
        payload: familyStore.data,
        version: nextVersion,
        updated_by: authStore.account?.id ?? null,
      })
      .eq('id', spaceId)
      .eq('version', remote.version)
      .select('id, version');

    if (error) {
      collabStore.error = error.message;

      return;
    }

    if (toRows<{ id: number }>(data).length === 0) {
      collabStore.error = '覆盖时云端又被更新了，请重试';

      return;
    }

    collabStore.version = nextVersion;
    collabStore.error = '';
    collabStore.lastSyncedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  } finally {
    collabStore.syncing = false;
  }
}

export function hasPendingConflict(): boolean {
  return collabStore.conflict;
}

export async function signOutCollaboration(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }

  // 换账号前清干净，残留队列会串到下一个账号的写入里。
  clearFamilyOutbox(outboxKey());

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
