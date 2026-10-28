import { afterEach, expect, it, vi } from 'vitest';
import { createId } from './id';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('使用浏览器提供的 randomUUID 生成 UUID v4', () => {
  const first = createId();
  const second = createId();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first).not.toBe(second);
});
