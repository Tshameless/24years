<script setup lang="ts">
import { computed } from 'vue';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Entry = Extract<PregnancyRecord, { type: 'bonding' | 'mood' }>;
const { kind } = defineProps<{ kind: Entry['type'] }>();
const labels = { bonding: '陪伴记录', mood: '心情日记' };
const {
  records,
  disabled: pregnancyDisabled,
  careDisabled,
  save,
  saveCare,
  remove,
  removeCare,
  error,
  reportError,
  message,
} = usePregnancyRecords();
const disabled = computed(() => (kind === 'mood' ? careDisabled.value : pregnancyDisabled.value));
const entries = computed(() =>
  records.value
    .filter((item): item is Entry => item.type === kind)
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const defaults = () => ({
  title: kind === 'mood' ? '平静' : '',
  date: localDate(),
  minutes: '10',
  notes: '',
});
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: kind,
  defaults,
  fields: (item: Entry) => ({
    title: item.title,
    date: item.date,
    notes: item.notes,
    minutes: item.type === 'bonding' ? String(item.minutes) : '10',
  }),
});

async function submit() {
  if (stale.value || disabled.value) {
    return;
  }

  reportError('');

  const base = {
    id: before.value?.id ?? draft.id.value,
    date: form.date,
    title: form.title.trim(),
    notes: form.notes.trim(),
  };
  const value: Entry =
    kind === 'bonding'
      ? { ...base, type: 'bonding', minutes: Number(form.minutes) }
      : { ...base, type: 'mood' };

  if (!validPregnancyRecord(value) || value.date > localDate()) {
    reportError('请检查内容、不晚于今天的记录日期与陪伴时长（1–1440 分钟整数）。');

    return;
  }

  const persist = kind === 'mood' ? saveCare : save;

  if (await persist({ type: 'pregnancy', before: before.value, value })) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ labels[kind] }}</h2>
        <span class="tag">{{ entries.length }} 条记录</span>
      </div>
      <p class="muted">启用家庭同步后，所有家庭成员都能看到这些记录。请只填写愿意共享的内容。</p>
      <p
        v-if="kind === 'mood'"
        class="muted"
      >
        记录自己的感受，不进行心理评分或诊断。
      </p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        还没有记录，按自己的节奏开始即可。
      </p>
      <ul
        v-else
        class="record-list"
      >
        <li
          v-for="item in entries"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>{{ item.title }}</strong>
            <span
              v-if="item.type === 'bonding'"
              class="tag"
            >
              {{ item.minutes }} 分钟
            </span>
          </div>
          <p class="muted">{{ item.date }}</p>
          <p class="record-notes">{{ item.notes }}</p>
          <div class="record-actions">
            <button
              class="text-button"
              :disabled="disabled"
              @click="edit(item)"
            >
              编辑
            </button>
            <button
              class="text-button"
              :disabled="disabled"
              @click="kind === 'mood' ? removeCare(item) : remove(item)"
            >
              删除
            </button>
          </div>
        </li>
      </ul>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑' : '添加' }}{{ labels[kind] }}</h2>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <FormDraftNotice
          :dirty="draft.dirty.value"
          :restored="draft.restored.value"
          :error="draft.storageError.value"
          :blocked="stale"
          @discard="cancel"
        />
        <fieldset
          class="record-fields"
          :disabled="disabled || stale"
        >
          <label
            v-if="kind === 'mood'"
            class="field"
          >
            此刻心情
            <select v-model="form.title">
              <option
                v-for="mood in ['愉悦', '平静', '烦躁', '低落', '疲惫']"
                :key="mood"
              >
                {{ mood }}
              </option>
            </select>
          </label>
          <label
            v-else
            class="field"
          >
            陪伴内容
            <input
              v-model="form.title"
              required
              maxlength="80"
            />
          </label>
          <label class="field">
            记录日期
            <input
              v-model="form.date"
              required
              type="date"
              :max="localDate()"
            />
          </label>
          <label
            v-if="kind === 'bonding'"
            class="field"
          >
            陪伴时长（分钟）
            <input
              :value="form.minutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              required
              @input="form.minutes = ($event.target as HTMLInputElement).value"
            />
          </label>
          <label class="field">
            记录备注
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="2000"
            />
          </label>
          <button class="button button-primary">保存{{ labels[kind] }}</button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          记录已变化，输入仍保留，请取消后重新编辑最新记录。
        </p>
        <button
          v-if="before"
          type="button"
          class="button button-secondary"
          :disabled="disabled"
          @click="cancel"
        >
          取消编辑
        </button>
      </form>
      <p
        v-if="error"
        class="form-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="message"
        class="success-message"
        role="status"
      >
        {{ message }}
      </p>
    </section>
  </div>
</template>
