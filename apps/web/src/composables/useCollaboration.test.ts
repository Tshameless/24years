import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useCollaboration } from './useCollaboration';

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
  const wrapper = mount(
    defineComponent({
      setup() {
        useCollaboration();

        return () => null;
      },
    }),
  );

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
