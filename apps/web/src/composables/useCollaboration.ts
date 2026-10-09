import { computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue';
import type { FamilyChange, FamilyMode, SessionState } from '@/domain/collaboration';
import type { FamilyData } from '@/domain/family';

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
): Promise<SessionState & { invitation?: { code: string; expiresAt: string } }> {
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
  const lastSynced = shallowRef('');
  let fetching = false;
  let generation = 0;
  let disposed = false;
  let interval: ReturnType<typeof setInterval>;
  const pendingOperations = new Map<string, string>();

  try {
    active.value = enabled && localStorage.getItem(ACTIVE_KEY) === 'true';
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
      return '连接中断 · 未同步';
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
    }

    state.value = { user: next.user, family: next.family };
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

  function failed(reason: unknown) {
    if (reason instanceof RequestError) {
      if (reason.state) {
        receive(reason.state);
      }

      if (reason.status === 401 && active.value) {
        expired.value = true;
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
    if (fetching || busy.value || disposed) {
      return;
    }

    fetching = true;
    const startedAt = generation;

    try {
      const next = await request('session');

      if (startedAt !== generation || disposed) {
        return;
      }

      if (!next.user && active.value) {
        expired.value = true;
        error.value = '登录已过期，请在「我的家庭」重新登录。未保存的输入仍在当前页面。';
      } else {
        receive(next);
      }
    } catch (reason) {
      if (active.value && startedAt === generation && !disposed) {
        failed(reason);
      }
    } finally {
      ready.value = true;
      fetching = false;
    }
  }

  async function run(path: string, body: unknown) {
    if (busy.value) {
      return false;
    }

    busy.value = true;
    generation += 1;
    error.value = '';

    try {
      const next = await request(path, body);
      receive(next);

      if (next.invitation) {
        invitation.value = next.invitation;
      }

      return true;
    } catch (reason) {
      failed(reason);

      return false;
    } finally {
      busy.value = false;
      ready.value = true;
    }
  }

  async function applyChange(change: FamilyChange) {
    const familyId = state.value.family?.id;
    const key = JSON.stringify({ familyId, change });
    const operationId = pendingOperations.get(key) ?? crypto.randomUUID();
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

  onMounted(() => {
    if (enabled) {
      void refresh();
      interval = setInterval(() => void refresh(), 2000);
      window.addEventListener('focus', refresh);
      window.addEventListener('online', refresh);
    }
  });

  onUnmounted(() => {
    disposed = true;
    clearInterval(interval);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
  });

  return {
    state: readonly(state),
    active: readonly(active),
    ready: readonly(ready),
    busy: readonly(busy),
    online: readonly(online),
    expired: readonly(expired),
    error: readonly(error),
    invitation: readonly(invitation),
    lastSynced: readonly(lastSynced),
    role,
    label,
    refresh,
    applyChange,
    logout,
    authenticate: (
      register: boolean,
      credentials: { username: string; password: string; nickname: string },
    ) => run(register ? 'register' : 'login', credentials),
    create: (mode: FamilyMode, data: FamilyData) => run('family/create', { mode, data }),
    join: (code: string) => run('family/join', { code }),
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
