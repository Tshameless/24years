import { afterEach, expect, it, vi } from 'vitest';
import { createId } from './id';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('即使浏览器提供 randomUUID，也不依赖该接口', () => {
  const native = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    throw new Error('randomUUID unavailable');
  });
  expect(createId()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(native).not.toHaveBeenCalled();
});

it('没有 randomUUID 时使用随机字节，保留 UUID v4 的版本和变体位', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const first = createId();
  const second = createId();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first).not.toBe(second);
});
