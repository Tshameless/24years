import { effectScope, nextTick, shallowRef } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSessionNotifications } from './useSessionNotifications';

const scopes: ReturnType<typeof effectScope>[] = [];
const opened = vi.fn();
const closed = vi.fn();
let resolvePermission: (permission: NotificationPermission) => void;
let rejectPermission: (error: Error) => void;
const requestPermission = vi.fn(
  () =>
    new Promise<NotificationPermission>((resolve, reject) => {
      resolvePermission = resolve;
      rejectPermission = reject;
    }),
);
beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal(
    'Notification',
    class {
      static permission = 'granted';
      static requestPermission = requestPermission;
      constructor(_title: string, options: unknown) {
        opened(options);
      }
      close = closed;
    },
  );
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function setup() {
  const scope = effectScope();
  scopes.push(scope);
  const identity = shallowRef('user-a');
  const allowed = shallowRef(true);
  const keys = shallowRef(['a']);
  const api = scope.run(() => useSessionNotifications({ scope: identity, allowed, keys }))!;

  return { scope, identity, allowed, keys, api };
}

it('ignores permission resolution after disposal and prevents duplicate requests', async () => {
  const { scope, api } = setup();
  const pending = api.enable();
  await api.enable();
  expect(requestPermission).toHaveBeenCalledTimes(1);
  scope.stop();
  resolvePermission('granted');
  await pending;
  await nextTick();
  expect(api.enabled.value).toBe(false);
  expect(opened).not.toHaveBeenCalled();
  expect(api.notice.value).toBe('');
});
it('invalidates permission when scope switches away and back', async () => {
  const { identity, api } = setup();
  const pending = api.enable();
  identity.value = 'b';
  identity.value = 'user-a';
  resolvePermission('granted');
  await pending;
  await nextTick();
  expect(api.enabled.value).toBe(false);
  expect(opened).not.toHaveBeenCalled();
});
it('deduplicates notifications and suppresses queued sends on permission changes', async () => {
  const { allowed, keys, api } = setup();
  const pending = api.enable();
  resolvePermission('granted');
  await pending;
  await nextTick();
  expect(opened).toHaveBeenCalledTimes(1);
  keys.value = ['a'];
  await nextTick();
  expect(opened).toHaveBeenCalledTimes(1);
  keys.value = ['b'];
  allowed.value = false;
  await nextTick();
  expect(opened).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledTimes(1);
});
it('ignores late rejected requests and reports live errors', async () => {
  const { api, scope } = setup();
  const pending = api.enable();
  scope.stop();
  rejectPermission(new Error('late'));
  await pending;
  expect(api.notice.value).toBe('');
  const live = setup();
  const second = live.api.enable();
  rejectPermission(new Error('denied'));
  await second;
  expect(live.api.notice.value).toContain('暂不能');
  expect(live.api.pending.value).toBe(false);
});
