import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useObservationTimer } from './useObservationTimer';

const scopes: ReturnType<typeof effectScope>[] = [];
const start = new Date('2026-10-21T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.useRealTimers();
});

function setup(value = '', writable = true) {
  const scope = effectScope();
  scopes.push(scope);
  const raw = shallowRef(value);
  const allowed = shallowRef(writable);
  const onStop = vi.fn();
  const api = scope.run(() => useObservationTimer(raw, { allowed, onStop }))!;

  return { scope, raw, allowed, onStop, api };
}

it('finishes once at the deadline, preserves acknowledgement, and rejects invalid durations', async () => {
  const { api, onStop, raw } = setup();
  for (const minutes of [0, -1, 1.5, 1441, NaN]) {
    expect(api.start(minutes)).toBe(false);
  }
  expect(api.start(1)).toBe(true);
  expect(api.start(2)).toBe(false);
  await vi.advanceTimersByTimeAsync(59000);
  expect(api.remaining.value).toBe(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(api.running.value).toBe(false);
  expect(api.dueKey.value).toBe(String(start));
  await vi.advanceTimersByTimeAsync(5000);
  expect(onStop).toHaveBeenCalledExactlyOnceWith(1);
  api.acknowledge();
  expect(api.dueKey.value).toBe('');
  expect(setup(raw.value).api.dueKey.value).toBe('');
});

it('restores overdue drafts using the deadline rather than time spent away', () => {
  const raw = JSON.stringify({
    startedAt: start - 600000,
    endsAt: start - 300000,
    stoppedAt: null,
    acknowledged: false,
  });
  const { api, onStop } = setup(raw);
  expect(api.running.value).toBe(false);
  expect(onStop).toHaveBeenCalledExactlyOnceWith(5);
  expect(api.dueKey.value).not.toBe('');
});

it('catches up on focus, defers writes when blocked, and removes listeners on disposal', async () => {
  const { api, allowed, scope, onStop } = setup();
  api.start(2);
  allowed.value = false;
  await nextTick();
  vi.setSystemTime(start + 600000);
  window.dispatchEvent(new Event('focus'));
  expect(onStop).not.toHaveBeenCalled();
  allowed.value = true;
  await nextTick();
  expect(onStop).toHaveBeenCalledExactlyOnceWith(2);
  api.start(1);
  scope.stop();
  vi.setSystemTime(start + 1200000);
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(2000);
  expect(onStop).toHaveBeenCalledTimes(1);
});

it('early stop rounds elapsed minutes and does not create an expiry alert', () => {
  const { api, onStop } = setup();
  api.start(30);
  vi.setSystemTime(start + 61000);
  api.stop();
  expect(onStop).toHaveBeenCalledExactlyOnceWith(2);
  expect(api.dueKey.value).toBe('');
  api.start(1);
  api.stop();
  expect(onStop).toHaveBeenLastCalledWith(1);
});

it('does not activate damaged or out-of-range drafts', () => {
  for (const raw of [
    '{',
    'null',
    '{}',
    JSON.stringify({
      startedAt: start,
      endsAt: start + 86400001,
      stoppedAt: null,
      acknowledged: false,
    }),
  ]) {
    const { api, onStop } = setup(raw);
    expect(api.invalid.value).toBe(true);
    expect(api.running.value).toBe(false);
    expect(api.dueKey.value).toBe('');
    expect(onStop).not.toHaveBeenCalled();
  }
});
