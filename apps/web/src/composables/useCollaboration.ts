import { createId } from '@/domain/id';
import { computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue';
import {
  applyFamilyDelta,
  type FamilyChange,
  type FamilyMode,
  type FamilyParentRole,
  type SessionState,
} from '@/domain/collaboration';
import { canonicalJson, type FamilyData } from '@/domain/family';
import {
  clearFamilyOutbox,
  enqueueOutboxEntry,
  OutboxCapacityError,
  OutboxStorageError,
  readOutbox,
  removeOutboxEntry,
  type OutboxEntry,
} from '@/domain/outbox';
import { CLOUD_CACHE_KEY, readCloudCache } from './cloudCache';
import { parseCloudResponse, request, RequestError } from './cloudClient';

const ACTIVE_KEY = '24years.cloud.active';

export function useCollaboration(enabled = true) {
  const state = shallowRef<SessionState>({ user: null, family: null });
  const ready = shallowRef(!enabled);
  const active = shallowRef(false);
  const busy = shallowRef(false);
  const online = shallowRef(true);
  const expired = shallowRef(false);
  const error = shallowRef('');
  const invitation = shallowRef<{ code: string; expiresAt: string; familyId: string } | null>(null);
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
  let eventSource: EventSource | null = null;
  let sseConnected = false;
  let lastPollAt = 0;
  let mutationQueue: Promise<unknown> = Promise.resolve();
  let etag = '';
  let retryAt = 0;
  let failures = 0;
  const pendingOperations = new Map<string, string>();
  const outboxEntries = shallowRef<OutboxEntry[]>([]);
  const outboxCount = computed(() => outboxEntries.value.length);
  let flushingOutbox = false;

  function refreshOutbox() {
    const familyId = state.value.family?.id;
    outboxEntries.value = familyId ? readOutbox(familyId) : [];
  }

  function closeEventStream() {
    sseConnected = false;

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function syncEventStream() {
    if (
      !enabled ||
      disposed ||
      typeof EventSource === 'undefined' ||
      !online.value ||
      !active.value ||
      !state.value.user ||
      expired.value ||
      document.hidden
    ) {
      closeEventStream();

      return;
    }

    if (eventSource) {
      return;
    }

    try {
      const source = new EventSource('/api/events');
      eventSource = source;
      const markConnected = () => {
        if (eventSource === source && !disposed) {
          sseConnected = true;

          if (outboxEntries.value.length > 0) {
            void flushOutbox();
          }
        }
      };
      source.addEventListener('open', markConnected);
      source.addEventListener('ready', markConnected);
      source.addEventListener('sync', (event) => {
        if (eventSource === source && !disposed) {
          retryAt = 0;

          if (event instanceof MessageEvent && typeof event.data === 'string') {
            try {
              const payload = JSON.parse(event.data);

              if (
                !fetching &&
                !busy.value &&
                state.value.user &&
                state.value.family &&
                payload?.delta &&
                typeof payload.etag === 'string'
              ) {
                const patched = applyFamilyDelta(state.value.family, payload.delta);

                if (patched) {
                  etag = payload.etag;
                  receive({ user: state.value.user, family: patched });

                  return;
                }
              }
            } catch {
              // Fall back to full session refresh when event data is not a delta payload.
            }
          }

          void refresh();
        }
      });
      source.addEventListener('error', () => {
        if (eventSource === source) {
          closeEventStream();
        }
      });
    } catch {
      closeEventStream();
    }
  }

  try {
    active.value = enabled && localStorage.getItem(ACTIVE_KEY) === 'true';

    if (active.value) {
      state.value = readCloudCache() ?? state.value;
      online.value = false;
      ready.value = !!state.value.family;
      refreshOutbox();
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
      if (outboxEntries.value.length > 0) {
        return `离线 · ${outboxEntries.value.length} 条待同步`;
      }

      return state.value.family ? '离线快照 · 可排队保存' : '连接中断 · 未同步';
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
    refreshOutbox();
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

    syncEventStream();

    if (outboxEntries.value.length > 0) {
      void flushOutbox();
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
    refreshPending = false;

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
        closeEventStream();
      }

      error.value =
        reason.status === 409
          ? `${reason.message} 输入已保留，请对照最新记录后重新编辑。`
          : reason.message;
    } else {
      online.value = false;
      closeEventStream();
      error.value =
        '连接失败，尚未确认保存。输入已保留，请恢复连接后重试；离开页面会丢失未保存输入。';
    }
  }

  async function refresh() {
    if (disposed || (ready.value && document.hidden)) {
      return;
    }

    if (fetching) {
      refreshPending = true;

      return;
    }

    if (busy.value) {
      return;
    }

    fetching = true;
    refreshPending = false;
    lastPollAt = Date.now();
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
        syncEventStream();

        if (outboxEntries.value.length > 0) {
          void flushOutbox();
        }

        return;
      }

      const next = await parseCloudResponse(response);

      if (startedAt !== generation || disposed) {
        return;
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
        closeEventStream();
        error.value = '登录已过期或已撤销，请在「我的家庭」重新登录。';
      } else {
        if ('delta' in next) {
          throw new TypeError('Invalid session payload');
        }

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

      if ('delta' in next) {
        const current = state.value.family;
        const patched = current ? applyFamilyDelta(current, next.delta) : null;

        if (!patched) {
          refreshPending = true;

          return true;
        }

        receive({ user: next.user ?? state.value.user, family: patched });
      } else {
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
      }

      return true;
    } catch (reason) {
      refreshPending = false;

      if (startedAt === generation && !disposed) {
        failed(reason);
      }

      return false;
    } finally {
      busy.value = false;
      ready.value = true;
    }
  }

  async function flushOutbox(): Promise<boolean> {
    if (flushingOutbox || disposed || !online.value || busy.value || !state.value.family) {
      return false;
    }

    flushingOutbox = true;

    try {
      const familyId = state.value.family.id;
      const entries = readOutbox(familyId);

      if (entries.length === 0) {
        outboxEntries.value = [];

        return true;
      }

      for (const entry of entries) {
        if (!online.value || disposed || state.value.family?.id !== familyId) {
          break;
        }

        const success = await run('family/records', {
          familyId: entry.familyId,
          change: entry.change,
          operationId: entry.operationId,
        });

        if (success) {
          removeOutboxEntry(familyId, entry.id);
          refreshOutbox();
        } else if (expired.value || error.value.includes('重新编辑')) {
          removeOutboxEntry(familyId, entry.id);
          refreshOutbox();
        } else {
          break;
        }
      }

      return outboxEntries.value.length === 0;
    } finally {
      flushingOutbox = false;
    }
  }

  async function applyChange(change: FamilyChange) {
    const task = mutationQueue.then(async () => {
      const familyId = state.value.family?.id;

      if (!familyId) {
        return false;
      }

      const key = canonicalJson({ familyId, change });
      const operationId = pendingOperations.get(key) ?? createId();
      pendingOperations.set(key, operationId);
      const success = await run('family/records', { familyId, change, operationId });

      if (success) {
        pendingOperations.delete(key);
        removeOutboxEntry(familyId, operationId);
        refreshOutbox();
      } else if (!online.value) {
        try {
          enqueueOutboxEntry(familyId, {
            id: createId(),
            familyId,
            operationId,
            change,
            createdAt: Date.now(),
            retryCount: 1,
          });
          refreshOutbox();
        } catch (reason) {
          pendingOperations.delete(key);
          error.value =
            reason instanceof OutboxCapacityError || reason instanceof OutboxStorageError
              ? reason.message
              : '离线修改未能保存，请恢复连接后重试。';
          refreshOutbox();
        }
      }

      return success;
    });
    mutationQueue = task.catch(() => false);

    return task;
  }

  async function logout() {
    const currentFamilyId = state.value.family?.id;

    if (await run('logout', {})) {
      rememberActive(false);
      expired.value = false;
      error.value = '';
      closeEventStream();

      if (currentFamilyId) {
        clearFamilyOutbox(currentFamilyId);
      }

      outboxEntries.value = [];

      return true;
    }

    return false;
  }

  async function endAccountAction(path: string, body: unknown) {
    const currentFamilyId = state.value.family?.id;

    if (!(await run(path, body))) {
      return false;
    }

    rememberActive(false);
    expired.value = false;
    closeEventStream();

    if (currentFamilyId) {
      clearFamilyOutbox(currentFamilyId);
    }

    outboxEntries.value = [];

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
    closeEventStream();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      closeEventStream();
    } else {
      syncEventStream();
      void refresh();
    }
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
        outboxEntries.value = [];
        online.value = true;
        expired.value = false;
        refreshPending = false;
        closeEventStream();

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

    refreshOutbox();

    refreshPending = true;
    void refresh();
  }

  function handleOnline() {
    void refresh();

    if (outboxEntries.value.length > 0) {
      void flushOutbox();
    }
  }

  onMounted(() => {
    if (enabled) {
      void refresh();
      interval = setInterval(() => {
        const now = Date.now();
        const pollInterval = sseConnected ? 30000 : 2000;

        if (!document.hidden && now >= retryAt && now - lastPollAt >= pollInterval) {
          void refresh();
        }
      }, 2000);
      window.addEventListener('focus', refresh);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', offline);
      window.addEventListener('storage', storageChanged);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  onUnmounted(() => {
    disposed = true;
    closeEventStream();
    clearInterval(interval);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', offline);
    window.removeEventListener('storage', storageChanged);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    join: (code: string, familyRole: FamilyParentRole, familyId?: string) =>
      run('family/join', { code, familyRole, ...(familyId ? { familyId } : {}) }),
    manage: (action: string, body: Record<string, unknown> = {}) =>
      run(`family/${action}`, {
        ...body,
        familyId: state.value.family?.id,
        revision: state.value.family?.revision,
      }),
    clearError: () => {
      error.value = '';
    },
    outboxCount: readonly(outboxCount),
    flushOutbox,
  };
}
