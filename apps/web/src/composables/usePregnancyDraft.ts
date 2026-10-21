import { computed, reactive } from 'vue';
import { useFamily } from './useFamily';
import { useFormDraft } from './useFormDraft';
import { validPregnancyRecord, type PregnancyRecord } from '@/domain/family';

/** One recoverable editor per record category, including its original conflict snapshot. */
export function usePregnancyDraft<
  R extends PregnancyRecord,
  T extends Record<string, string | number | boolean>,
>(options: { type: R['type']; defaults: () => T; fields: (record: R) => T; initial?: R | null }) {
  const { data, identity, cloud } = useFamily();
  const form = reactive({
    ...options.defaults(),
    ...(options.initial ? options.fields(options.initial) : {}),
    source: JSON.stringify(options.initial ?? null),
  }) as T & { source: string };
  const draft = useFormDraft({
    form,
    scope: () => `${identity.value}:${cloud.role.value ?? 'local'}`,
    name: `pregnancy:${options.type}`,
  });
  const source = computed(() => {
    try {
      const value: unknown = JSON.parse(form.source);

      if (value === null || (validPregnancyRecord(value) && value.type === options.type)) {
        return { valid: true, record: value as R | null };
      }
    } catch {
      // A corrupt source must never become an unchecked overwrite baseline.
    }

    return { valid: false, record: null };
  });
  const before = computed(() => source.value.record);
  const stale = computed(() => {
    if (!source.value.valid) {
      return true;
    }

    const records = data.value.pregnancyRecords ?? [];
    const original = before.value;

    return original
      ? JSON.stringify(records.find((item) => item.id === original.id) ?? null) !==
          JSON.stringify(original)
      : records.some(
          (item) => item.id === (options.type === 'medical' ? 'medical-card' : draft.id.value),
        );
  });

  function reset(record: R | null = null) {
    Object.assign(form, options.defaults(), record ? options.fields(record) : {}, {
      source: JSON.stringify(record),
    });
    draft.accept();
  }

  function edit(record: R) {
    if (!draft.confirmDiscard()) {
      return false;
    }

    reset(record);

    return true;
  }

  function cancel() {
    if (!draft.confirmDiscard()) {
      return false;
    }

    reset(options.type === 'medical' ? (options.initial ?? null) : null);

    return true;
  }

  return { form, before, stale, draft, reset, edit, cancel };
}
