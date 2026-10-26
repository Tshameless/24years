import { createId } from '@/domain/id';
import { computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue';
import type {
  FamilyChange,
  FamilyMode,
  FamilyParentRole,
  SessionState,
} from '@/domain/collaboration';
import { canonicalJson, type FamilyData } from '@/domain/family';
import { CLOUD_CACHE_KEY, readCloudCache } from './cloudCache';

const ACTIVE_KEY = '24years.cloud.active';

class RequestError extends Error {
  status: number;
  state?: SessionState;

  constructor(status: number, message: string, state?: SessionState) {
    super(message);
    this.status = status;
    this.state = state;
  }
}

async function request(
  path: string,
  body?: unknown,
): Promise<
  SessionState & {
    invitation?: { code: string; expiresAt: string };
    recoveryKey?: string;
    backupData?: FamilyData;
  }
> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? {} : { 'Content-Type': 'application/json', 'X-24Years-Client': 'web' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new RequestError(response.status, result.message ?? '请求失败，请重试。', result.state);
  }

  return result;
}

export function useCollaboration(enabled = true) {
  const state = shallowRef<SessionState>({ user: null, family: null });
  const ready = shallowRef(!enabled);
  const active = shallowRef(false);
  const busy = shallowRef(false);
  const online = shallowRef(true);
  const expired = shallowRef(false);
  const error = shallowRef('');
  const invitation = shallowRef<{ code: string; expiresAt: string } | null>(null);
  const recoveryKey = shallowRef('');
  const recoveryUsername = shallowRef('');
  const backupData = shallowRef<FamilyData | null>(null);
  const accountNotice = shallowRef('');
  const lastSynced = shallowRef('');
  const cacheWarning = shallowRef('');
  let fetching = false;
  let refreshPending = false;
  let generation = 0;
  let disposed = false;
  let interval: ReturnType<typeof setInterval>;
  let etag = '';
  let retryAt = 0;
  let failures = 0;
  const pendingOperations = new Map<string, string>();

  try {
    active.value = enabled && localStorage.getItem(ACTIVE_KEY) === 'true';

    if (active.value) {
      state.value = readCloudCache() ?? state.value;
      online.value = false;
      ready.value = !!state.value.family;
    }
  } catch {
    // Local storage protection is handled by the family store.
  }

  const role = computed(
    () => state.value.family?.members.find((member) => member.id === state.value.user?.id)?.role,
  );
  const label = computed(() => {
    if (!ready.value) {
      return '正在连接';
    }

    if (!active.value) {
      return '本机记录';
    }

    if (expired.value) {
      return '请重新登录';
    }

    if (!online.value) {
      return state.value.family ? '离线快照 · 仅查看' : '连接中断 · 未同步';
    }

    return busy.value ? '正在保存' : state.value.family ? '已同步' : '已登录 · 待加入家庭';
  });

  function rememberActive(value: boolean) {
    active.value = value;

    try {
      localStorage.setItem(ACTIVE_KEY, String(value));
    } catch {
      // Cookie sessions remain usable even when browser storage is unavailable.
    }
  }

  function receive(next: SessionState) {
    const current = state.value.family;

    if (current && next.family?.id === current.id && next.family.revision < current.revision) {
      return;
    }

    if (next.user?.id !== state.value.user?.id || next.family?.id !== current?.id) {
      invitation.value = null;
      pendingOperations.clear();
      backupData.value = null;

      if (next.user?.id !== state.value.user?.id) {
        recoveryKey.value = '';
      }
    }

    state.value = { user: next.user, family: next.family };
    persistSnapshot();
    lastSynced.value = new Date().toLocaleTimeString('zh-CN');
    online.value = true;
    expired.value = false;

    if (next.user) {
      rememberActive(true);
    }

    if (!next.family?.inviteExpiresAt) {
      invitation.value = null;
    }
  }

  function persistSnapshot() {
    try {
      if (state.value.user && state.value.family) {
        localStorage.setItem(
          CLOUD_CACHE_KEY,
          JSON.stringify({ version: 1, savedAt: Date.now(), state: state.value }),
        );
      } else {
        localStorage.removeItem(CLOUD_CACHE_KEY);
      }

      cacheWarning.value = '';
    } catch {
      cacheWarning.value = '离线快照未能保存，请勿依赖断网刷新查看；可先导出备份。';
    }
  }

  function failed(reason: unknown) {
    if (reason instanceof RequestError) {
      if (reason.state) {
        receive(reason.state);
      }

      if (reason.status === 401 && active.value) {
        expired.value = true;
        state.value = { user: null, family: null };
        persistSnapshot();
        recoveryKey.value = '';
        backupData.value = null;
      }

      error.value =
        reason.status === 409
          ? `${reason.message} 输入已保留，请对照最新记录后重新编辑。`
          : reason.message;
    } else {
      online.value = false;
      error.value =
        '连接失败，尚未确认保存。输入已保留，请恢复连接后重试；离开页面会丢失未保存输入。';
    }
  }

  async function refresh() {
    if (fetching || busy.value || disposed || (ready.value && document.hidden)) {
      return;
    }

    fetching = true;
    refreshPending = false;
    const startedAt = generation;

    try {
      const response = await fetch('/api/session', {
        credentials: 'same-origin',
        headers: etag ? { 'If-None-Match': etag } : {},
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (startedAt !== generation || disposed) {
        return;
      }

      if (response.status === 304) {
        online.value = true;
        failures = 0;
        retryAt = 0;
        lastSynced.value = new Date().toLocaleTimeString('zh-CN');

        return;
      }

      const next = await response.json();

      if (startedAt !== generation || disposed) {
        return;
      }

      if (!response.ok) {
        throw new RequestError(response.status, next.message ?? '请求失败，请重试。');
      }

      etag = response.headers.get('ETag') ?? '';
      failures = 0;
      retryAt = 0;

      if (!next.user && active.value) {
        expired.value = true;
        state.value = { user: null, family: null };
        persistSnapshot();
        recoveryKey.value = '';
        backupData.value = null;
        error.value = '登录已过期或已撤销，请在「我的家庭」重新登录。';
      } else {
        receive(next);
      }
    } catch (reason) {
      failures = Math.min(failures + 1, 5);
      retryAt = Date.now() + Math.min(60000, 2000 * 2 ** failures);

      if (active.value && startedAt === generation && !disposed) {
        failed(reason);
      }
    } finally {
      ready.value = true;
      fetching = false;

      if (refreshPending && !disposed) {
        refreshPending = false;
        void refresh();
      }
    }
  }

  async function run(path: string, body: unknown) {
    if (busy.value) {
      return false;
    }

    if (path.startsWith('family/') && (!ready.value || !online.value || expired.value)) {
      error.value = '当前为只读快照，请恢复连接并同步最新记录后再修改。';

      return false;
    }

    busy.value = true;
    generation += 1;
    const startedAt = generation;
    etag = '';
    error.value = '';
    accountNotice.value = '';

    try {
      const next = await request(path, body);

      if (startedAt !== generation || disposed) {
        return false;
      }

      receive(next);

      if (next.recoveryKey) {
        recoveryKey.value = next.recoveryKey;
      }

      if (next.backupData) {
        backupData.value = next.backupData;
      }

      if (next.invitation) {
        invitation.value = next.invitation;
      }

      return true;
    } catch (reason) {
      if (startedAt === generation && !disposed) {
        failed(reason);
      }

      return false;
    } finally {
      busy.value = false;
      ready.value = true;

      if (refreshPending && !disposed) {
        refreshPending = false;
        void refresh();
      }
    }
  }

  async function applyChange(change: FamilyChange) {
    const familyId = state.value.family?.id;
    const key = canonicalJson({ familyId, change });
    const operationId = pendingOperations.get(key) ?? createId();
    pendingOperations.set(key, operationId);
    const success = await run('family/records', { familyId, change, operationId });

    if (success) {
      pendingOperations.delete(key);
    }

    return success;
  }

  async function logout() {
    if (await run('logout', {})) {
      rememberActive(false);
      expired.value = false;
      error.value = '';

      return true;
    }

    return false;
  }

  async function endAccountAction(path: string, body: unknown) {
    if (!(await run(path, body))) {
      return false;
    }

    rememberActive(false);
    expired.value = false;

    if (path !== 'recover') {
      recoveryKey.value = '';
    } else {
      recoveryUsername.value = (body as { username: string }).username;
    }

    accountNotice.value =
      path === 'recover'
        ? '密码已重置，旧密钥已失效。请先保存新恢复密钥，再用新密码登录。'
        : '账号已注销，本机记录仍保留在此浏览器中。';

    return true;
  }

  function offline() {
    online.value = false;
  }

  function storageChanged(event: StorageEvent) {
    if (event.key !== ACTIVE_KEY && event.key !== CLOUD_CACHE_KEY && event.key !== null) {
      return;
    }

    if (event.key === ACTIVE_KEY) {
      const nextActive = event.newValue === 'true';
      active.value = nextActive;

      if (!nextActive) {
        generation += 1;
        etag = '';
        state.value = { user: null, family: null };
        recoveryKey.value = '';
        invitation.value = null;
        backupData.value = null;
        pendingOperations.clear();
        online.value = true;
        expired.value = false;
        refreshPending = false;

        return;
      }
    }

    const cached = readCloudCache();
    const sameSnapshot =
      cached?.user?.id === state.value.user?.id &&
      cached?.family?.id === state.value.family?.id &&
      cached?.family?.revision === state.value.family?.revision;

    if (sameSnapshot && event.key === CLOUD_CACHE_KEY) {
      return;
    }

    // Do not erase a good local snapshot on every write from a sibling tab.
    // Identity transitions clear sensitive in-memory state before revalidation.
    const identityChanged =
      cached?.user?.id !== state.value.user?.id || cached?.family?.id !== state.value.family?.id;
    generation += 1;
    etag = '';
    online.value = false;

    if (identityChanged || !cached) {
      state.value = cached ?? { user: null, family: null };
      recoveryKey.value = '';
      invitation.value = null;
      backupData.value = null;
      pendingOperations.clear();
    } else if (
      cached.family &&
      state.value.family &&
      cached.family.revision > state.value.family.revision
    ) {
      // A newer read-only snapshot may be shown while the server is checked.
      state.value = cached;
    }

    refreshPending = true;
    void refresh();
  }

  onMounted(() => {
    if (enabled) {
      void refresh();
      interval = setInterval(() => {
        if (!document.hidden && Date.now() >= retryAt) {
          void refresh();
        }
      }, 2000);
      window.addEventListener('focus', refresh);
      window.addEventListener('online', refresh);
      window.addEventListener('offline', offline);
      window.addEventListener('storage', storageChanged);
      document.addEventListener('visibilitychange', refresh);
    }
  });

  onUnmounted(() => {
    disposed = true;
    clearInterval(interval);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', offline);
    window.removeEventListener('storage', storageChanged);
    document.removeEventListener('visibilitychange', refresh);
  });

  return {
    state: readonly(state),
    active: readonly(active),
    ready: readonly(ready),
    busy: readonly(busy),
    online: readonly(online),
    expired: readonly(expired),
    error: readonly(error),
    cacheWarning: readonly(cacheWarning),
    invitation: readonly(invitation),
    lastSynced: readonly(lastSynced),
    recoveryKey: readonly(recoveryKey),
    recoveryUsername: readonly(recoveryUsername),
    backupData: readonly(backupData),
    accountNotice: readonly(accountNotice),
    role,
    label,
    refresh,
    applyChange,
    logout,
    dismissRecoveryKey: () => {
      recoveryKey.value = '';
      recoveryUsername.value = '';
    },
    rotateRecovery: (password: string) => run('account/recovery', { password }),
    changePassword: (currentPassword: string, newPassword: string) =>
      run('account/change-password', { currentPassword, newPassword }),
    recover: (credentials: { username: string; recoveryKey: string; password: string }) =>
      endAccountAction('recover', credentials),
    deleteAccount: (
      password: string,
      confirmation: string,
      familyId: string | null,
      revision: number | null,
    ) => endAccountAction('account/delete', { password, confirmation, familyId, revision }),
    importData: (data: FamilyData, familyId: string, revision: number, operationId: string) =>
      run('family/import', { data, familyId, revision, operationId }),
    authenticate: (
      register: boolean,
      credentials: { username: string; password: string; nickname: string },
    ) => run(register ? 'register' : 'login', credentials),
    create: (mode: FamilyMode, data: FamilyData, familyRole: FamilyParentRole) =>
      run('family/create', { mode, data, familyRole }),
    join: (code: string, familyRole: FamilyParentRole) => run('family/join', { code, familyRole }),
    manage: (action: string, body: Record<string, unknown> = {}) =>
      run(`family/${action}`, {
        ...body,
        familyId: state.value.family?.id,
        revision: state.value.family?.revision,
      }),
    clearError: () => {
      error.value = '';
    },
  };
}
