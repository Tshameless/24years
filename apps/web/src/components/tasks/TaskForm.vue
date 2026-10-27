<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { useFormDraft } from '@/composables/useFormDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import WeekdayPicker from './WeekdayPicker.vue';
import { taskTemplates } from '@/domain/taskReminders';
import { isDate, localDate, sameValue, validTask, type FamilyTask } from '@/domain/family';

const props = defineProps<{ task?: FamilyTask }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const { data, addTask, updateTask, recordLocked, cloud, identity } = useFamily();
const before = props.task ? (JSON.parse(JSON.stringify(props.task)) as FamilyTask) : undefined;
const stale = computed(
  () =>
    before && !sameValue(data.value.tasks.find((item) => item.id === before.id) ?? null, before),
);

const form = reactive({
  title: before?.title ?? '',
  date: before?.date ?? localDate(),
  time: before?.time ?? '09:00',
  repeat: before?.repeat ?? 'once',
  weekdays: before?.weekdays?.join(',') ?? '',
  assignee: before?.assignee ?? '',
  endDate: before?.endDate ?? '',
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
  optionalFields: ['weekdays', 'assignee', 'endDate'],
});
const template = shallowRef('');

function applyTemplate() {
  const selected = taskTemplates[Number(template.value)];

  if (
    template.value === '' ||
    !selected ||
    recordLocked.value ||
    before ||
    stale.value ||
    draftBlocked.value
  ) {
    return;
  }

  if (dirty.value && !window.confirm('用模板替换名称、时间和重复方式？其他输入保留。')) {
    return;
  }

  Object.assign(form, selected, { weekdays: selected.repeat === 'weekly' ? '7' : '' });
}

const selectedDays = computed(() => (form.weekdays ? form.weekdays.split(',').map(Number) : []));

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

  if (recordLocked.value || stale.value || draftBlocked.value) {
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
    ...(form.assignee ? { assignee: form.assignee as FamilyTask['assignee'] } : {}),
    ...(form.endDate ? { endDate: form.endDate } : {}),
    ...(form.repeat === 'weekly' ? { weekdays: selectedDays.value } : {}),
  };
  const task = {
    ...value,
    id: before?.id ?? draftId.value,
    completedDates: before?.completedDates ?? [],
  };

  if (!validTask(task)) {
    error.value = '请检查重复规则、负责人及结束日期（不得早于开始日期）。';

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
    <div
      v-if="!before"
      class="field"
    >
      <label for="task-template">常用计划模板</label>
      <select
        id="task-template"
        v-model="template"
      >
        <option value="">请选择模板</option>
        <option
          v-for="(item, index) in taskTemplates"
          :key="item.title"
          :value="String(index)"
        >
          {{ item.title }}
        </option>
      </select>
      <button
        type="button"
        class="button button-secondary"
        :disabled="recordLocked || !!stale || draftBlocked || template === ''"
        @click="applyTemplate"
      >
        填入模板
      </button>
    </div>
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
      <small>
        到时显示站内提醒；可另行开启本次页面会话的浏览器通知。关闭页面不保证提醒，用药安排请遵医嘱。
      </small>
    </label>
    <div class="form-row">
      <label class="field">
        负责人
        <select
          v-model="form.assignee"
          aria-label="负责人"
        >
          <option value="">不指定</option>
          <option value="single_parent">本人（单人家庭）</option>
          <option value="mother">母亲</option>
          <option value="father">父亲</option>
        </select>
      </label>
      <label class="field">
        结束日期（可选）
        <input
          v-model="form.endDate"
          type="date"
          :min="form.date"
        />
      </label>
    </div>
    <small>
      负责人表示分工，不改变编辑权限；任一可编辑成员仍可代为完成。尚不支持双方分别确认。
    </small>
    <WeekdayPicker
      v-if="form.repeat === 'weekly'"
      v-model="form.weekdays"
    />
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button button-primary"
      :disabled="recordLocked || !!stale || draftBlocked"
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
