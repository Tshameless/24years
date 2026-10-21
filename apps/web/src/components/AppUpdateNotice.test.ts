import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import AppUpdateNotice from './AppUpdateNotice.vue';

const wrappers: ReturnType<typeof mount>[] = [];

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup() {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ version: import.meta.env.VITE_APP_VERSION }),
  });
  vi.stubGlobal('fetch', fetcher);
  const wrapper = mount(AppUpdateNotice);
  wrappers.push(wrapper);

  return { wrapper, fetcher };
}

it('同版本不提示，发现新版本后提示但不自动刷新', async () => {
  const { wrapper, fetcher } = setup();
  await flushPromises();
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({ version: import.meta.env.VITE_APP_VERSION }),
  });
  await vi.advanceTimersByTimeAsync(60000);
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ version: 'new-release' }) });
  await vi.advanceTimersByTimeAsync(60000);
  expect(wrapper.text()).toContain('发现新版本');
  expect(wrapper.get('button').text()).toBe('刷新更新');
  expect(fetcher).toHaveBeenLastCalledWith(
    '/version.json',
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('断网或无效响应不打扰用户，恢复网络后重新检查', async () => {
  const { wrapper, fetcher } = setup();
  await flushPromises();
  fetcher.mockRejectedValue(new Error('offline'));
  await vi.advanceTimersByTimeAsync(60000);
  expect(wrapper.text()).toBe('');
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ version: 123 }) });
  window.dispatchEvent(new Event('online'));
  await flushPromises();
  expect(wrapper.text()).toBe('');
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ version: 'new-release' }) });
  document.dispatchEvent(new Event('visibilitychange'));
  await flushPromises();
  expect(wrapper.text()).toContain('发现新版本');
});

it('卸载后停止轮询并取消正在进行的检查', async () => {
  const { wrapper, fetcher } = setup();
  await flushPromises();
  fetcher.mockImplementation(() => new Promise(() => {}));
  window.dispatchEvent(new Event('online'));
  const signal = fetcher.mock.lastCall?.[1].signal as AbortSignal;
  wrapper.unmount();
  expect(signal.aborted).toBe(true);
  fetcher.mockClear();
  await vi.advanceTimersByTimeAsync(60000);
  window.dispatchEvent(new Event('online'));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(fetcher).not.toHaveBeenCalled();
});
