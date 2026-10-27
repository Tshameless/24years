import { computed, readonly, shallowRef } from 'vue';
import { useFamily } from './useFamily';
import {
  isPostpartumCareRecord,
  localDate,
  postpartumWindowEnd,
  pregnancyOutcome,
  withinPostpartumWindow,
  type PregnancyChange,
  type PregnancyRecord,
} from '@/domain/family';

export function usePregnancyRecords() {
  const store = useFamily();
  const busy = shallowRef(false);
  const message = shallowRef('');
  const error = shallowRef('');
  const records = computed(() => store.data.value.pregnancyRecords ?? []);
  const outcome = computed(() => pregnancyOutcome(records.value));
  const outcomeDisabled = computed(() => store.recordLocked.value || busy.value);
  const disabled = computed(() => outcomeDisabled.value || !!outcome.value);
  const careDisabled = computed(
    () => outcomeDisabled.value || (!!outcome.value && outcome.value.kind !== 'birth'),
  );
  const careMinDate = computed(() =>
    outcome.value?.kind === 'birth' ? outcome.value.date : undefined,
  );
  const careMaxDate = computed(() => {
    const today = localDate();

    if (outcome.value?.kind === 'birth') {
      const end = postpartumWindowEnd(outcome.value.date);

      return end < today ? end : today;
    }

    return today;
  });

  function canEditCareRecord(record: PregnancyRecord): boolean {
    if (outcomeDisabled.value || !isPostpartumCareRecord(record)) {
      return false;
    }

    if (!outcome.value) {
      return true;
    }

    return (
      outcome.value.kind === 'birth' && withinPostpartumWindow(outcome.value.date, record.date)
    );
  }

  async function persist(change: PregnancyChange, allowedType?: 'outcome' | 'postpartum' | 'care') {
    if (
      outcomeDisabled.value ||
      (!!outcome.value && !allowedType) ||
      (allowedType === 'outcome' && (change.value ?? change.before)?.type !== 'outcome') ||
      (allowedType === 'postpartum' && (change.value ?? change.before)?.type !== 'postpartum')
    ) {
      return false;
    }

    if (allowedType === 'care') {
      const record = (change.value ?? change.before) as PregnancyRecord | null;

      if (
        !record ||
        !isPostpartumCareRecord(record) ||
        (outcome.value &&
          (outcome.value.kind !== 'birth' ||
            (change.before &&
              (!isPostpartumCareRecord(change.before) ||
                !withinPostpartumWindow(outcome.value.date, change.before.date))) ||
            !withinPostpartumWindow(outcome.value.date, record.date)))
      ) {
        return false;
      }
    }

    busy.value = true;
    error.value = '';
    message.value = '';

    try {
      const saved = await store.savePregnancy(change);

      if (saved) {
        message.value =
          store.cloud.active.value && !store.cloud.online.value
            ? '记录已保存在本机，待联网同步。'
            : '记录已保存。';
      } else {
        error.value = store.error.value || '保存未完成，输入已保留，请重试。';
      }

      return saved;
    } finally {
      busy.value = false;
    }
  }

  const save = (change: PregnancyChange) => persist(change);
  const saveOutcome = (change: PregnancyChange) => persist(change, 'outcome');

  const savePostpartum = (change: PregnancyChange) => persist(change, 'postpartum');
  const saveCare = (change: PregnancyChange) => persist(change, 'care');

  async function remove(before: PregnancyRecord) {
    if (window.confirm('确认删除这条记录？已生成的账目会保留在家庭账本中。')) {
      await save({ type: 'pregnancy', before: { ...before }, value: null });
    }
  }

  async function removeCare(before: PregnancyRecord) {
    if (isPostpartumCareRecord(before) && window.confirm('确认删除这条身心记录？')) {
      await saveCare({ type: 'pregnancy', before: { ...before }, value: null });
    }
  }

  const quietMode = computed(() => !!store.data.value.profile?.quietMode);
  const cloudActive = computed(() => store.cloud.active.value);
  const hasExpense = (id: string) => store.data.value.expenses.some((item) => item.id === id);

  function reportError(value: string) {
    error.value = value;
  }

  return {
    records,
    outcome,
    disabled,
    careDisabled,
    careMinDate,
    careMaxDate,
    canEditCareRecord,
    outcomeDisabled,
    message: readonly(message),
    error: readonly(error),
    reportError,
    save,
    saveOutcome,
    savePostpartum,
    saveCare,
    remove,
    removeCare,
    quietMode,
    cloudActive,
    hasExpense,
  };
}
