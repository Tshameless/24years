import { createId } from '@/domain/id';
import { sameValue } from '@/domain/family';
import { computed, onUnmounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

const PREFIX = '24years.draft.v2:';

export function clearFormDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be disabled. Forms still warn before leaving.
  }
}

/** Tab-scoped form protection, never an offline submission queue. */
export function useFormDraft<T extends Record<string, string | number | boolean>>(options: {
  form: T;
  scope: () => string;
  name: string;
  baseline?: unknown;
}) {
  const router = useRouter();
  const initial = JSON.stringify(options.form);
  const currentBaseline = () =>
    JSON.stringify(
      typeof options.baseline === 'function' ? options.baseline() : (options.baseline ?? null),
    );
  const baseline = currentBaseline();
  let draftBaseline = baseline;
  const scope = options.scope();
  const key = PREFIX + JSON.stringify([scope, options.name]);
  const id = shallowRef(createId());
  const restored = shallowRef(false);
  const changedSource = shallowRef(false);
  const storageError = shallowRef('');
  const clean = shallowRef(initial);
  let suspended = false;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    const raw = sessionStorage.getItem(key);

    if (raw) {
      const saved = JSON.parse(raw);
      const fields = Object.keys(options.form);

      if (
        saved?.version !== 2 ||
        typeof saved.id !== 'string' ||
        !saved.id ||
        typeof saved.baseline !== 'string' ||
        !saved.form ||
        typeof saved.form !== 'object' ||
        Array.isArray(saved.form) ||
        Object.keys(saved.form).some((field) => !fields.includes(field)) ||
        !fields.every(
          (field) =>
            (typeof saved.form[field] === typeof options.form[field] &&
              (typeof saved.form[field] !== 'number' || Number.isFinite(saved.form[field]))),
        )
      ) {
        throw new Error('Invalid draft');
      }

      Object.assign(options.form, saved.form);
      id.value = saved.id;
      restored.value = true;
      changedSource.value = !sameValue(
        JSON.parse(saved.baseline),
        typeof options.baseline === 'function' ? options.baseline() : (options.baseline ?? null),
      );
      draftBaseline = saved.baseline;
    }
  } catch {
    storageError.value = '无法读取标签页草稿，请勿依赖刷新恢复；可清除草稿后重新填写。';
  }

  const dirty = computed(
    () => !suspended && (restored.value || JSON.stringify(options.form) !== clean.value),
  );

  function persist() {
    if (suspended) {
      return;
    }

    try {
      if (dirty.value) {
        // Retain the original baseline even when a restored draft is stale.
        sessionStorage.setItem(
          key,
          JSON.stringify({ version: 2, id: id.value, baseline: draftBaseline, form: options.form }),
        );
      } else {
        sessionStorage.removeItem(key);
      }

      storageError.value = '';
    } catch {
      storageError.value = '草稿暂存失败，请勿刷新或关闭页面，先复制输入内容。';
    }
  }

  function clearPersistTimer() {
    if (persistTimer !== undefined) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
  }

  function schedulePersist() {
    if (persistTimer !== undefined) {
      clearTimeout(persistTimer);
    } else {
      // Keep the first edit durable immediately; coalesce subsequent keystrokes.
      persist();
    }

    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      persist();
    }, 150);
  }

  watch(options.form, schedulePersist, { deep: true, flush: 'sync' });

  function accept() {
    clearPersistTimer();
    clean.value = JSON.stringify(options.form);
    restored.value = false;
    changedSource.value = false;
    draftBaseline = currentBaseline();
    id.value = createId();
    persist();
  }

  function discard() {
    Object.assign(options.form, JSON.parse(initial));
    accept();
  }

  function confirmDiscard() {
    if (dirty.value && !window.confirm('放弃未保存的修改并清除这份草稿？')) {
      return false;
    }

    discard();

    return true;
  }

  const removeGuard = router.beforeEach(() => {
    if (!dirty.value) {
      return true;
    }

    return window.confirm(
      storageError.value
        ? '草稿未能暂存，离开会丢失输入。仍要离开吗？'
        : '还有未保存的修改。草稿仅在当前标签页保留，不会自动提交；仍要离开吗？',
    );
  });

  function flushPendingDraft() {
    if (dirty.value && persistTimer !== undefined) {
      clearPersistTimer();
      persist();
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      flushPendingDraft();
    }
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) {
      clearPersistTimer();
      persist();
      event.preventDefault();
      event.returnValue = '';
    }
  }

  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('pagehide', flushPendingDraft);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  watch(
    options.scope,
    (next) => {
      if (next !== scope) {
        clearPersistTimer();
        suspended = true;
        Object.assign(options.form, JSON.parse(initial));
        restored.value = false;
        clean.value = initial;
      }
    },
    { flush: 'sync' },
  );
  onUnmounted(() => {
    clearPersistTimer();
    persist();
    removeGuard();
    window.removeEventListener('beforeunload', beforeUnload);
    window.removeEventListener('pagehide', flushPendingDraft);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return { id, dirty, restored, changedSource, storageError, accept, confirmDiscard };
}
