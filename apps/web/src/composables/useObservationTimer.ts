import { computed, onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue';

interface ObservationTimer {
  startedAt: number;
  endsAt: number;
  stoppedAt: number | null;
  acknowledged: boolean;
}

function readTimer(raw: string): ObservationTimer | null {
  try {
    const value = JSON.parse(raw) as ObservationTimer;

    if (
      value &&
      Number.isSafeInteger(value.startedAt) &&
      value.startedAt > 0 &&
      Number.isSafeInteger(value.endsAt) &&
      value.endsAt > value.startedAt &&
      value.endsAt - value.startedAt <= 1440 * 60000 &&
      (value.stoppedAt === null ||
        (Number.isSafeInteger(value.stoppedAt) &&
          value.stoppedAt >= value.startedAt &&
          value.stoppedAt <= value.endsAt)) &&
      typeof value.acknowledged === 'boolean'
    ) {
      return value;
    }
  } catch {
    // Invalid drafts must not produce a timer or a notification.
  }

  return null;
}

/** Wall-clock deadline, persisted by the caller's tab draft; never a background scheduler. */
export function useObservationTimer(
  raw: Ref<string>,
  options: {
    allowed: Readonly<Ref<boolean>>;
    onStop: (minutes: number) => void;
  },
) {
  const now = shallowRef(Date.now());
  const session = computed(() => readTimer(raw.value));
  const invalid = computed(() => !!raw.value && !session.value);
  const running = computed(() => !!session.value && session.value.stoppedAt === null);
  const remaining = computed(() =>
    running.value ? Math.max(0, Math.ceil((session.value!.endsAt - now.value) / 1000)) : 0,
  );
  const completed = computed(() => {
    const value = session.value;

    return value && value.stoppedAt !== null ? value : null;
  });
  const dueKey = computed(() => {
    const value = completed.value;

    return value && !value.acknowledged && value.stoppedAt === value.endsAt
      ? String(value.startedAt)
      : '';
  });

  function check() {
    now.value = Date.now();
    const value = session.value;

    if (options.allowed.value && value && value.stoppedAt === null && now.value >= value.endsAt) {
      options.onStop(Math.max(1, Math.ceil((value.endsAt - value.startedAt) / 60000)));
      raw.value = JSON.stringify({ ...value, stoppedAt: value.endsAt });
    }
  }

  function start(minutes: number) {
    if (
      !options.allowed.value ||
      running.value ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 1440
    ) {
      return false;
    }

    const startedAt = Date.now();
    now.value = startedAt;
    raw.value = JSON.stringify({
      startedAt,
      endsAt: startedAt + minutes * 60000,
      stoppedAt: null,
      acknowledged: false,
    });

    return true;
  }

  function stop() {
    const value = session.value;

    if (options.allowed.value && value && value.stoppedAt === null) {
      const stoppedAt = Math.max(value.startedAt, Math.min(Date.now(), value.endsAt));
      options.onStop(Math.max(1, Math.ceil((stoppedAt - value.startedAt) / 60000)));
      raw.value = JSON.stringify({
        ...value,
        stoppedAt,
      });
    }
  }

  function acknowledge() {
    const value = completed.value;

    if (value && options.allowed.value) {
      raw.value = JSON.stringify({ ...value, acknowledged: true });
    }
  }

  watch([raw, options.allowed], check, { immediate: true });
  const interval = setInterval(check, 1000);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  onScopeDispose(() => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
  });

  return {
    session,
    invalid,
    running,
    remaining: readonly(remaining),
    completed,
    dueKey,
    start,
    stop,
    acknowledge,
  };
}
