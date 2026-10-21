<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { useFormDraft } from '@/composables/useFormDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import { isDate, localDate, type FamilyTask } from '@/domain/family';

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
});
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

  const value = { ...form, title: form.title.trim() };
  const saved = before
    ? await updateTask({ ...before, ...value }, before)
    : await addTask(value, draftId.value);

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
        {{ form.repeat === 'daily' ? '开始日期' : '计划日期' }}
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
      </select>
      <small>仅作为页面计划清单，不会发送系统通知；用药安排请遵医嘱。</small>
    </label>
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
