import { onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue';

/** Owns only this page session's notifications, never background delivery. */
export function useSessionNotifications(options: {
  scope: Readonly<Ref<string>>;
  allowed: Readonly<Ref<boolean>>;
  keys: Readonly<Ref<readonly string[]>>;
}) {
  const supported = typeof Notification !== 'undefined' && window.isSecureContext;
  const enabled = shallowRef(false);
  const pending = shallowRef(false);
  const notice = shallowRef('');
  const sent = new Set<string>();
  const opened = new Set<Notification>();
  let generation = 0;
  let disposed = false;

  function disable() {
    generation++;
    enabled.value = false;
    pending.value = false;
    notice.value = '';
    opened.forEach((notification) => notification.close());
    opened.clear();
  }

  watch(
    [options.scope, options.allowed],
    () => {
      disable();
      sent.clear();
    },
    { flush: 'sync' },
  );

  async function enable() {
    if (!supported || pending.value || !options.allowed.value || disposed) {
      return;
    }

    const request = ++generation;
    pending.value = true;

    try {
      const permission = await Notification.requestPermission();

      if (disposed || request !== generation || !options.allowed.value) {
        return;
      }

      enabled.value = permission === 'granted';
      notice.value = enabled.value
        ? '本次页面会话已开启通知；锁屏或关闭页面不保证送达。'
        : '未获通知权限，站内提醒仍可用。';
    } catch {
      if (!disposed && request === generation) {
        notice.value = '此浏览器暂不能显示系统通知，请使用站内提醒。';
      }
    } finally {
      if (!disposed && request === generation) {
        pending.value = false;
      }
    }
  }

  watch([options.keys, enabled], () => {
    if (
      !supported ||
      !enabled.value ||
      !options.allowed.value ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const fresh = options.keys.value.filter((key) => !sent.has(key));

    if (!fresh.length) {
      return;
    }

    try {
      const notification = new Notification('24Years 计划提醒', {
        body: '有计划已到时间，请打开页面查看。',
        tag: '24years-tasks',
      });
      opened.add(notification);
      notification.onclose = () => opened.delete(notification);
      fresh.forEach((key) => sent.add(key));
    } catch {
      disable();
      notice.value = '此浏览器不支持当前通知方式，已保留站内提醒。';
    }
  });

  onScopeDispose(() => {
    disposed = true;
    disable();
    sent.clear();
  });

  return {
    supported,
    enabled: readonly(enabled),
    pending: readonly(pending),
    notice: readonly(notice),
    enable,
    disable,
  };
}
