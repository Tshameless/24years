<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { useFormDraft } from '@/composables/useFormDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import { isDate, localDate, weekDays, validTask, type FamilyTask } from '@/domain/family';

const props = defineProps<{ task?: FamilyTask }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const { data, addTask, updateTask, locked, cloud, identity } = useFamily();
const before = props.task ? (JSON.parse(JSON.stringify(props.task)) as FamilyTask) : undefined;
const stale = computed(
  () =>
    before &&
    JSON.stringify(data.value.tasks.find((item) => item.id === before.id)) !==
      JSON.stringify(before),
);

const form = reactive({
  title: before?.title ?? '',
  date: before?.date ?? localDate(),
  time: before?.time ?? '09:00',
  repeat: before?.repeat ?? 'once',
  weekdays: before?.weekdays?.join(',') ?? '',
});

const error = shallowRef('');
const {
  id: draftId,
  dirty,
  restored,
  changedSource,
  storageError,
  accept,
  confirmDiscard,
} = useFormDraft({
  form,
  scope: () => `${identity.value}:${cloud.role.value ?? 'local'}`,
  name: `task:${before?.id ?? 'new'}`,
  baseline: before,
  optionalFields: ['weekdays'],
});
const selectedDays = computed(() => (form.weekdays ? form.weekdays.split(',').map(Number) : []));

function toggleWeekday(day: number) {
  const next = selectedDays.value.includes(day)
    ? selectedDays.value.filter((value) => value !== day)
    : [...selectedDays.value, day];
  form.weekdays = next.sort((a, b) => a - b).join(',');
}

const draftBlocked = computed(
  () =>
    changedSource.value ||
    (restored.value && !before && data.value.tasks.some((item) => item.id === draftId.value)),
);

function cancel() {
  if (confirmDiscard()) {
    cloud.clearError();
    emit('cancel');
  }
}

async function submit() {
  error.value = '';

  if (locked.value || stale.value || draftBlocked.value) {
    return;
  }

  if (!form.title.trim() || !isDate(form.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(form.time)) {
    error.value = '请填写计划名称、日期与时间。';

    return;
  }

  if (form.repeat === 'weekly' && !selectedDays.value.length) {
    error.value = '每周计划请至少选择一个星期。';

    return;
  }

  const value = {
    title: form.title.trim(),
    date: form.date,
    time: form.time,
    repeat: form.repeat,
    ...(form.repeat === 'weekly' ? { weekdays: selectedDays.value } : {}),
  };
  const task = {
    ...value,
    id: before?.id ?? draftId.value,
    completedDates: before?.completedDates ?? [],
  };

  if (!validTask(task)) {
    error.value = '计划重复规则无效，请重新选择重复方式与星期。';

    return;
  }

  const saved = before ? await updateTask(task, before) : await addTask(value, draftId.value);

  if (saved) {
    form.title = '';
    accept();
    emit('saved');
  }
}
</script>

<template>
  <form
    class="form-grid"
    @submit.prevent="submit"
  >
    <FormDraftNotice
      :dirty="dirty"
      :restored="restored"
      :error="storageError"
      :blocked="draftBlocked"
      @discard="cancel"
    />
    <p
      v-if="stale"
      class="form-error"
    >
      这项计划已被修改或删除。输入仍保留，请取消后从最新列表重新编辑。
    </p>
    <label class="field">
      计划名称
      <input
        v-model="form.title"
        required
        maxlength="80"
        placeholder="例如：整理下一次就诊的问题"
      />
    </label>
    <div class="form-row">
      <label class="field">
        {{ form.repeat === 'once' ? '计划日期' : '开始日期' }}
        <input
          v-model="form.date"
          type="date"
          required
        />
      </label>
      <label class="field">
        时间
        <input
          v-model="form.time"
          type="time"
          required
        />
      </label>
    </div>
    <label class="field">
      重复方式
      <select v-model="form.repeat">
        <option value="once">仅一次</option>
        <option value="daily">每天重复</option>
        <option value="weekly">每周指定星期</option>
      </select>
      <small>仅作为页面计划清单，不会发送系统通知；用药安排请遵医嘱。</small>
    </label>
    <fieldset
      v-if="form.repeat === 'weekly'"
      class="weekday-picker"
    >
      <legend>重复星期（至少选一天）</legend>
      <div class="weekday-options">
        <button
          v-for="day in weekDays"
          :key="day.value"
          type="button"
          :aria-pressed="selectedDays.includes(day.value)"
          :class="{ selected: selectedDays.includes(day.value) }"
          @click="toggleWeekday(day.value)"
        >
          {{ day.label }}
        </button>
      </div>
      <p class="muted">从开始日期起，仅在选定星期出现在今日计划中。修改周期不会删除历史打卡。</p>
    </fieldset>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button button-primary"
      :disabled="locked || !!stale || draftBlocked"
    >
      {{ before ? '保存计划修改' : '保存计划' }}
    </button>
    <button
      v-if="before"
      class="button button-secondary"
      type="button"
      @click="cancel"
    >
      取消编辑
    </button>
  </form>
</template>

<style scoped>
.weekday-picker {
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.weekday-picker legend {
  font-size: 13px;
  padding: 0 6px;
}

.weekday-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.weekday-options button {
  min-height: 44px;
  min-width: 44px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-secondary);
}

.weekday-options .selected {
  background: var(--green-light);
  color: var(--green);
  border-color: var(--green);
}

.weekday-picker p {
  font-size: 12px;
  line-height: 1.8;
  margin: 12px 0 0;
}
</style>
