import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useCollaboration } from './useCollaboration';
import { CLOUD_CACHE_KEY, readCloudCache } from './cloudCache';
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
