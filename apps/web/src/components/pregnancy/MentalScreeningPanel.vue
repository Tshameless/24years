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
const { records, disabled, error, message, reportError, save } = usePregnancyRecords();
const previous = computed(() => records.value.find((item): item is Screening => item.type === 'mentalScreening'));
const { form, before, stale, draft, reset, cancel } = usePregnancyDraft({
  type: 'mentalScreening',
  initial: previous.value ?? null,
  defaults: () => ({ date: localDate(), answers: '[]', score: '0', selfHarm: false, notes: '' }),
  fields: (item: Screening) => ({ date: item.date, answers: JSON.stringify(item.answers ?? []), score: String(item.score), selfHarm: item.selfHarm, notes: item.notes }),
});
const selectedAnswers = computed(() => {
  try {
    const parsed = JSON.parse(form.answers);
    return Array.isArray(parsed) ? parsed.map((value) => Number(value)) : [];
  } catch {
    return [];
  }
});
const score = computed(() => selectedAnswers.value.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0));
const selfHarm = computed(() => selectedAnswers.value[9] > 0);
const risk = computed(() => selfHarm.value || score.value >= 13);
function setAnswer(index: number, value: string) {
  const answers = [...selectedAnswers.value];
  answers[index] = Number(value);
  form.answers = JSON.stringify(answers);
  form.score = String(score.value);
  form.selfHarm = selfHarm.value;
}
async function submit() {
  reportError('');
  const value: Screening = { id: 'mental-screening', type: 'mentalScreening', date: form.date, score: score.value, selfHarm: selfHarm.value, answers: selectedAnswers.value, notes: form.notes.trim() };
  if (disabled.value || stale.value || !validPregnancyRecord(value) || value.date > localDate()) { reportError('请填写有效日期和 0–30 的整数分数。'); return; }
  if (await save({ type: 'pregnancy', before: before.value, value })) reset(value);
}
</script>

<template>
  <section class="panel mental-screening">
    <div class="panel-heading"><h2>孕期心理状态自查</h2><span class="tag">不作诊断</span></div>
    <p class="muted">这是一个简短的自我观察入口。若出现自伤想法、无法保证自身安全或情绪持续影响生活，请立即联系身边可信任的人、当地急救或心理/精神科服务。</p>
    <form class="form-grid" @submit.prevent="submit">
      <FormDraftNotice :dirty="draft.dirty.value" :restored="draft.restored.value" :error="draft.storageError.value" :blocked="stale" @discard="cancel" />
      <fieldset class="record-fields" :disabled="disabled || stale">
        <label class="field">评估日期<input v-model="form.date" type="date" :max="localDate()" /></label>
        <p class="muted">请按近两周的实际感受逐题选择。每题 0–3 分，系统只保存分数和答案用于复诊沟通。</p>
        <ol class="screening-questions">
          <li v-for="(question, index) in questions" :key="question">
            <label class="field">{{ question }}
              <select :value="selectedAnswers[index] ?? ''" @change="setAnswer(index, ($event.target as HTMLSelectElement).value)">
                <option value="">请选择</option><option value="0">完全没有（0）</option><option value="1">偶尔（1）</option><option value="2">有时（2）</option><option value="3">经常（3）</option>
              </select>
            </label>
          </li>
        </ol>
        <p class="screening-score">当前总分：<strong>{{ score }}</strong> / 30</p>
        <p v-if="risk" class="form-error" role="alert">请尽快联系专业人员或急救服务；如果有即时危险，请拨打 120 或当地急救电话。</p>
        <label class="field">想告诉医护人员的情况<textarea v-model="form.notes" rows="4" maxlength="2000" placeholder="睡眠、焦虑、支持情况或希望获得的帮助"></textarea></label>
        <button class="button button-primary">保存心理自查</button>
      </fieldset>
    </form>
    <p v-if="previous" class="muted">上次记录：{{ previous.date }}，分数 {{ previous.score }}。</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="message" class="success-message" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.screening-questions {
  display: grid;
  gap: 14px;
  margin: 0;
  padding-left: 22px;
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
</style>
