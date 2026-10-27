import { computed, readonly, shallowRef } from 'vue';
import { useFamily } from './useFamily';
import { pregnancyOutcome, type PregnancyChange, type PregnancyRecord } from '@/domain/family';

export function usePregnancyRecords() {
  const store = useFamily();
  const busy = shallowRef(false);
  const message = shallowRef('');
  const error = shallowRef('');
  const records = computed(() => store.data.value.pregnancyRecords ?? []);
  const outcome = computed(() => pregnancyOutcome(records.value));
  const outcomeDisabled = computed(() => store.recordLocked.value || busy.value);
  const disabled = computed(() => outcomeDisabled.value || !!outcome.value);

  async function persist(change: PregnancyChange, allowedType?: 'outcome' | 'postpartum') {
    if (
      outcomeDisabled.value ||
      (!!outcome.value && !allowedType) ||
      (allowedType && (change.value ?? change.before)?.type !== allowedType)
    ) {
      return false;
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

  async function remove(before: PregnancyRecord) {
    if (window.confirm('确认删除这条记录？已生成的账目会保留在家庭账本中。')) {
      await save({ type: 'pregnancy', before: { ...before }, value: null });
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
    outcomeDisabled,
    message: readonly(message),
    error: readonly(error),
    reportError,
    save,
    saveOutcome,
    savePostpartum,
    remove,
    quietMode,
    cloudActive,
    hasExpense,
  };
}
