import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useCollaboration } from './useCollaboration';
import { CLOUD_CACHE_KEY, readCloudCache } from './cloudCache';
import { readOutbox } from '@/domain/outbox';
import { emptyFamily } from '@/domain/family';
import type { SessionState } from '@/domain/collaboration';

function snapshot(id = 'user', revision = 1): SessionState {
  const user = { id, username: id, nickname: '家长' };

  return {
    user,
    family: {
      id: `family-${id}`,
      mode: 'single',
      revision,
      data: emptyFamily(),
      members: [{ ...user, role: 'owner', familyRole: 'single_parent' }],
      updatedAt: new Date().toISOString(),
      updatedBy: id,
      inviteExpiresAt: null,
    },
  };
}

function cache(state: SessionState, savedAt = Date.now()) {
  localStorage.setItem('24years.cloud.active', 'true');
  localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ version: 1, savedAt, state }));
}

function mountCloud() {
  let cloud!: ReturnType<typeof useCollaboration>;
  const wrapper = mount(
    defineComponent({
      setup() {
        cloud = useCollaboration();

        return () => null;
      },
    }),
  );

  return { cloud, wrapper };
}

it('restores a read-only cloud snapshot on offline cold start and clears it on expired login', async () => {
  const state = snapshot();
  cache(state);
  const fetcher = vi.fn().mockRejectedValue(new TypeError('offline'));
  vi.stubGlobal('fetch', fetcher);
  const { cloud, wrapper } = mountCloud();

  try {
    expect(cloud.ready.value).toBe(true);
    expect(cloud.state.value).toEqual(state);
    await flushPromises();
    expect(cloud.online.value).toBe(false);
    expect(await cloud.manage('invite')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ user: null, family: null })));
    await cloud.refresh();
    expect(cloud.state.value.family).toBeNull();
    expect(cloud.expired.value).toBe(true);
    expect(localStorage.getItem(CLOUD_CACHE_KEY)).toBeNull();
  } finally {
    wrapper.unmount();
  }
});

it('rejects expired, malformed and mismatched snapshots', () => {
  cache(snapshot(), Date.now() - 30 * 86400000);
  expect(readCloudCache()).toBeNull();
  const state = snapshot();
  state.user!.id = 'another-account';
  cache(state);
  expect(readCloudCache()).toBeNull();
  localStorage.setItem(CLOUD_CACHE_KEY, '{broken');
  expect(readCloudCache()).toBeNull();
});

it('persists a successful session and removes its snapshot on logout', async () => {
  const state = snapshot();
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(state))));
  vi.stubGlobal('fetch', fetcher);
  const { cloud, wrapper } = mountCloud();

  try {
    await flushPromises();
    expect(readCloudCache()).toEqual(state);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ user: null, family: null })));
    expect(await cloud.logout()).toBe(true);
    expect(readCloudCache()).toBeNull();
    expect(localStorage.getItem('24years.cloud.active')).toBe('false');
  } finally {
    wrapper.unmount();
  }
});

it('ignores a stale in-flight response after another tab switches accounts', async () => {
  cache(snapshot('old'));
  let resolve!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockRejectedValue(new TypeError('offline'));
  vi.stubGlobal('fetch', fetcher);
  const { cloud, wrapper } = mountCloud();

  try {
    cache(snapshot('new'));
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: CLOUD_CACHE_KEY,
        newValue: localStorage.getItem(CLOUD_CACHE_KEY),
      }),
    );
    expect(cloud.state.value.user!.id).toBe('new');
    resolve(new Response(JSON.stringify(snapshot('old', 9))));
    await flushPromises();
    expect(cloud.state.value.user!.id).toBe('new');
    expect(cloud.online.value).toBe(false);
    expect(readCloudCache()!.user!.id).toBe('new');
  } finally {
    wrapper.unmount();
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('reuses ETag without decoding 304 and pauses hidden polling', async () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const decode = vi.fn();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ user: null, family: null }), {
        headers: { ETag: '"session"' },
      }),
    )
    .mockResolvedValue({ status: 304, json: decode });
  vi.stubGlobal('fetch', fetcher);
  const { wrapper } = mountCloud();

  try {
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher.mock.calls[1][1].headers).toEqual({ 'If-None-Match': '"session"' });
    expect(decode).not.toHaveBeenCalled();
    hidden.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(3);
  } finally {
    wrapper.unmount();
  }
});

it('preserves cached family when a captive portal or gateway returns non-session responses', async () => {
  const state = snapshot();
  cache(state);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response('<html>captive portal</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    .mockResolvedValueOnce(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  vi.stubGlobal('fetch', fetcher);
  const { cloud, wrapper } = mountCloud();

  try {
    await flushPromises();
    expect(cloud.online.value).toBe(false);
    expect(cloud.expired.value).toBe(false);
    expect(cloud.state.value).toEqual(state);
    expect(readCloudCache()).toEqual(state);

    await cloud.refresh();
    expect(cloud.online.value).toBe(false);
    expect(cloud.expired.value).toBe(false);
    expect(cloud.state.value).toEqual(state);
    expect(readCloudCache()).toEqual(state);
  } finally {
    wrapper.unmount();
  }
});

it('throttles polling while SSE is connected, syncs on server push and queues rapid record changes', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const listeners = new Map<string, () => void>();
  class FakeEventSource {
    close = vi.fn();
    addEventListener(type: string, callback: () => void) {
      listeners.set(type, callback);
    }
  }
  vi.stubGlobal('EventSource', FakeEventSource);
  const state = snapshot('sse-user', 1);
  const fetcher = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/session') {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          headers: { ETag: `"rev-${state.family!.revision}"` },
        }),
      );
    }

    state.family!.revision += 1;

    return Promise.resolve(new Response(JSON.stringify(state)));
  });
  vi.stubGlobal('fetch', fetcher);
  const { cloud, wrapper } = mountCloud();

  try {
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);
    listeners.get('open')?.();

    // While SSE is connected, 2s polling is suppressed.
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Server push triggers an immediate session refresh when no delta payload is attached.
    listeners.get('sync')?.();
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Server push with a valid delta applies in-memory without an extra /api/session fetch.
    const deltaTask = {
      id: 'delta-task',
      title: 'SSE增量任务',
      date: '2026-10-26',
      time: '08:00',
      repeat: 'once' as const,
      completedDates: [],
    };
    (listeners.get('sync') as unknown as (event: MessageEvent) => void)?.(
      new MessageEvent('sync', {
        data: JSON.stringify({
          etag: '"rev-2"',
          delta: {
            familyId: state.family!.id,
            fromRevision: 1,
            revision: 2,
            mode: state.family!.mode,
            members: state.family!.members,
            updatedAt: state.family!.updatedAt,
            updatedBy: state.family!.updatedBy,
            inviteExpiresAt: null,
            reset: false,
            entries: [
              { revision: 2, recordType: 'task', recordId: deltaTask.id, value: deltaTask },
            ],
          },
        }),
      }),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cloud.state.value.family?.revision).toBe(2);
    expect(cloud.state.value.family?.data.tasks).toEqual([deltaTask]);
    state.family!.revision = 2;

    // Concurrent record mutations queue sequentially instead of dropping the second call.
    const firstTask = {
      id: 't1',
      title: '第一项',
      date: '2026-10-26',
      time: '09:00',
      repeat: 'once' as const,
      completedDates: [],
    };
    const secondTask = {
      id: 't2',
      title: '第二项',
      date: '2026-10-26',
      time: '10:00',
      repeat: 'once' as const,
      completedDates: [],
    };
    const results = await Promise.all([
      cloud.applyChange({ type: 'task', before: null, value: firstTask }),
      cloud.applyChange({ type: 'task', before: null, value: secondTask }),
    ]);
    expect(results).toEqual([true, true]);
    expect(cloud.state.value.family?.revision).toBe(4);
  } finally {
    wrapper.unmount();
  }
});

it('persists failed mutations to outbox and automatically flushes when online', async () => {
  const state = snapshot('outbox-user', 1);
  let shouldFail = true;
  const fetcher = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/session') {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          headers: { ETag: `"rev-${state.family!.revision}"` },
        }),
      );
    }

    if (shouldFail) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    state.family!.revision += 1;

    return Promise.resolve(new Response(JSON.stringify(state)));
  });
  vi.stubGlobal('fetch', fetcher);
  const { cloud, wrapper } = mountCloud();

  try {
    await flushPromises();
    expect(cloud.ready.value).toBe(true);
    expect(cloud.outboxCount.value).toBe(0);

    const task = {
      id: 'outbox-task',
      title: '离线待同步任务',
      date: '2026-10-26',
      time: '11:00',
      repeat: 'once' as const,
      completedDates: [],
    };

    // First attempt fails due to network disconnection
    const result = await cloud.applyChange({ type: 'task', before: null, value: task });
    expect(result).toBe(true);
    expect(cloud.online.value).toBe(false);
    expect(cloud.outboxCount.value).toBe(1);
    expect(cloud.label.value).toContain('1 条待同步');
    const persisted = readOutbox(state.family!.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.change).toEqual({ type: 'task', before: null, value: task });

    const nextTask = { ...task, id: 'second-outbox-task', title: '离线第二项' };
    expect(await cloud.applyChange({ type: 'task', before: null, value: nextTask })).toBe(true);
    expect(cloud.outboxCount.value).toBe(2);

    // Restore network and flush
    shouldFail = false;
    await cloud.refresh();
    expect(cloud.online.value).toBe(true);
    await cloud.flushOutbox();
    await flushPromises();

    expect(cloud.outboxCount.value).toBe(0);
    expect(readOutbox(state.family!.id)).toHaveLength(0);
    expect(cloud.state.value.family?.revision).toBe(3);
  } finally {
    wrapper.unmount();
  }
});
