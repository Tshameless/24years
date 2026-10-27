<script setup lang="ts">
import { computed } from 'vue';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Screening = Extract<PregnancyRecord, { type: 'mentalScreening' }>;
const questions = [
  '我能够笑出来，并看到事情有趣的一面。',
  '我以兴趣期待事情。',
  '当事情出错时，我会不必要地责怪自己。',
  '我无缘无故感到焦虑或担心。',
  '我无缘无故感到害怕或惊慌。',
  '事情变得太多时，我难以应付。',
  '我因为不开心而睡不好。',
  '我感到悲伤或痛苦。',
  '我因为不开心而哭泣。',
  '我曾有伤害自己的想法。',
];
const { records, disabled, error, message, reportError, save, cloudActive } = usePregnancyRecords();
const history = computed(() =>
  records.value
    .filter((item): item is Screening => item.type === 'mentalScreening')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
);
const { form, before, stale, draft, reset, cancel } = usePregnancyDraft({
  type: 'mentalScreening',
  initial: history.value[0] ?? null,
  defaults: () => ({ date: localDate(), answers: '[]', score: '0', selfHarm: false, notes: '' }),
  fields: (item: Screening) => ({
    date: item.date,
    answers: JSON.stringify(item.answers ?? []),
    score: String(item.score),
    selfHarm: item.selfHarm,
    notes: item.notes,
  }),
});
const selectedAnswers = computed(() => {
  try {
    const parsed = JSON.parse(form.answers);

    return Array.isArray(parsed)
      ? parsed.map((value) => (typeof value === 'number' ? value : Number.NaN))
      : [];
  } catch {
    return [];
  }
});
const score = computed(() =>
  selectedAnswers.value.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0),
);
const selfHarm = computed(() => selectedAnswers.value[9] > 0);
const allAnswered = computed(
  () =>
    selectedAnswers.value.length === questions.length &&
    selectedAnswers.value.every((value) => Number.isInteger(value) && value >= 0 && value <= 3),
);

function setAnswer(index: number, value: string) {
  const answers = [...selectedAnswers.value];
  answers[index] = value === '' ? Number.NaN : Number(value);
  form.answers = JSON.stringify(answers);
  form.score = String(score.value);
  form.selfHarm = selfHarm.value;
}

function startNew() {
  if (draft.confirmDiscard()) {
    reset(null);
  }
}

function edit(item: Screening) {
  if (!draft.confirmDiscard()) {
    return;
  }

  reset(item);
}

async function submit() {
  reportError('');
  const value: Screening = {
    id: before.value?.id ?? draft.id.value,
    type: 'mentalScreening',
    date: form.date,
    score: score.value,
    selfHarm: selfHarm.value,
    answers: selectedAnswers.value,
    notes: form.notes.trim(),
  };

  if (
    disabled.value ||
    stale.value ||
    !allAnswered.value ||
    !validPregnancyRecord(value) ||
    value.date > localDate()
  ) {
    reportError('请完成全部题目，并填写有效日期。');

    return;
  }

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset(value);
  }
}
</script>

<template>
  <section class="panel mental-screening">
    <div class="panel-heading">
      <h2>孕期心理状态自查</h2>
      <span class="tag">不作诊断</span>
    </div>
    <p class="muted">
      这是非诊断性的自我观察，不是经过验证的 EPDS
      量表，汇总分不设医学阈值。若情绪持续影响生活，请联系专业人员；若出现自伤想法或无法保证自身安全，请立即联系可信任的人和当地急救服务。
    </p>
    <p
      v-if="cloudActive"
      class="privacy-notice"
    >
      家庭同步已开启：此记录会对家庭成员可见，请只填写愿意共享的信息。
    </p>
    <div class="screening-layout">
      <aside
        class="screening-history"
        aria-label="历史心理自查"
      >
        <div class="history-heading">
          <h3>历史自查</h3>
          <button
            type="button"
            class="text-button"
            :disabled="disabled"
            @click="startNew"
          >
            新建
          </button>
        </div>
        <p
          v-if="!history.length"
          class="muted"
        >
          尚无历史记录
        </p>
        <ul
          v-else
          class="history-list"
        >
          <li
            v-for="item in history"
            :key="item.id"
          >
            <button
              type="button"
              class="history-item"
              :class="{ selected: before?.id === item.id }"
              :aria-pressed="before?.id === item.id"
              @click="edit(item)"
            >
              <span>{{ item.date }}</span>
              <small>汇总 {{ item.score }} / 30</small>
              <small
                v-if="item.selfHarm"
                class="history-alert"
              >
                曾选择自伤想法
              </small>
            </button>
          </li>
        </ul>
      </aside>
      <form
        class="form-grid screening-editor"
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
          <label class="field">
            评估日期
            <input
              v-model="form.date"
              type="date"
              :max="localDate()"
            />
          </label>
          <p class="muted">
            请按近两周的实际感受逐题选择。每题的 0–3 仅用于整理回答，不用于诊断或风险分级。
          </p>
          <ol class="screening-questions">
            <li
              v-for="(question, index) in questions"
              :key="question"
            >
              <label class="field">
                {{ question }}
                <select
                  :value="Number.isFinite(selectedAnswers[index]) ? selectedAnswers[index] : ''"
                  @change="setAnswer(index, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">请选择</option>
                  <option value="0">完全没有（0）</option>
                  <option value="1">偶尔（1）</option>
                  <option value="2">有时（2）</option>
                  <option value="3">经常（3）</option>
                </select>
              </label>
            </li>
          </ol>
          <p class="screening-score">
            回答汇总：
            <strong>{{ allAnswered ? score : '—' }}</strong>
            / 30（不作量表解释）
          </p>
          <p
            v-if="selfHarm"
            class="form-error"
            role="alert"
          >
            你选择了曾有自伤想法。请尽快联系专业人员和可信任的人；如果有即时危险或无法保证安全，请拨打当地急救电话。
          </p>
          <label class="field">
            想告诉医护人员的情况
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="2000"
              placeholder="睡眠、焦虑、支持情况或希望获得的帮助"
            ></textarea>
          </label>
          <button class="button button-primary">保存心理自查</button>
        </fieldset>
      </form>
    </div>
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
</template>

<style scoped>
.screening-questions {
  display: grid;
  gap: 14px;
  margin: 0;
  padding-left: 22px;
}

.screening-layout {
  display: grid;
  grid-template-columns: minmax(180px, 0.32fr) minmax(0, 1fr);
  gap: 24px;
}

.screening-history {
  min-width: 0;
  padding-right: 18px;
  border-right: 1px solid var(--border);
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.history-heading h3 {
  margin: 0;
  font-size: 14px;
}

.history-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-item {
  display: grid;
  width: 100%;
  gap: 3px;
  padding: 9px 10px;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.history-item.selected {
  border-left-color: var(--primary);
  background: var(--pink-light);
}

.history-item span {
  font-size: 13px;
  font-weight: 600;
}

.history-item small {
  color: var(--text-secondary);
  font-size: 12px;
}

.history-item .history-alert {
  color: var(--primary-ink);
}

.screening-editor {
  min-width: 0;
}

.screening-questions li {
  padding-left: 4px;
}

.screening-score {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--green-light);
}

.privacy-notice {
  padding: 10px 12px;
  border-left: 3px solid var(--primary);
  background: var(--pink-light);
  line-height: 1.7;
}

@media (max-width: 760px) {
  .screening-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .screening-history {
    padding: 0 0 14px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .history-list {
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  }
}
</style>
