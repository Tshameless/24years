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
const allAnswered = computed(() => selectedAnswers.value.length === questions.length && selectedAnswers.value.every((value) => Number.isInteger(value) && value >= 0 && value <= 3));
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
  if (disabled.value || stale.value || !allAnswered.value || !validPregnancyRecord(value) || value.date > localDate()) { reportError('请完成全部题目，并填写有效日期。'); return; }
  if (await save({ type: 'pregnancy', before: before.value, value })) reset(value);
}
</script>

<template>
  <section class="panel mental-screening">
    <div class="panel-heading"><h2>孕期心理状态自查</h2><span class="tag">不作诊断</span></div>
    <p class="muted">这是非诊断性的自我观察，不是经过验证的 EPDS 量表，汇总分不设医学阈值。若情绪持续影响生活，请联系专业人员；若出现自伤想法或无法保证自身安全，请立即联系可信任的人和当地急救服务。</p>
    <p v-if="cloudActive" class="privacy-notice">家庭同步已开启：此记录会对家庭成员可见，请只填写愿意共享的信息。</p>
    <form class="form-grid" @submit.prevent="submit">
      <FormDraftNotice :dirty="draft.dirty.value" :restored="draft.restored.value" :error="draft.storageError.value" :blocked="stale" @discard="cancel" />
      <fieldset class="record-fields" :disabled="disabled || stale">
        <label class="field">评估日期<input v-model="form.date" type="date" :max="localDate()" /></label>
        <p class="muted">请按近两周的实际感受逐题选择。每题的 0–3 仅用于整理回答，不用于诊断或风险分级。</p>
        <ol class="screening-questions">
          <li v-for="(question, index) in questions" :key="question">
            <label class="field">{{ question }}
              <select :value="selectedAnswers[index] ?? ''" @change="setAnswer(index, ($event.target as HTMLSelectElement).value)">
                <option value="">请选择</option><option value="0">完全没有（0）</option><option value="1">偶尔（1）</option><option value="2">有时（2）</option><option value="3">经常（3）</option>
              </select>
            </label>
          </li>
        </ol>
        <p class="screening-score">回答汇总：<strong>{{ allAnswered ? score : '—' }}</strong> / 30（不作量表解释）</p>
        <p v-if="selfHarm" class="form-error" role="alert">你选择了曾有自伤想法。请尽快联系专业人员和可信任的人；如果有即时危险或无法保证安全，请拨打当地急救电话。</p>
        <label class="field">想告诉医护人员的情况<textarea v-model="form.notes" rows="4" maxlength="2000" placeholder="睡眠、焦虑、支持情况或希望获得的帮助"></textarea></label>
        <button class="button button-primary">保存心理自查</button>
      </fieldset>
    </form>
    <p v-if="previous" class="muted">上次记录：{{ previous.date }}。</p>
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

.privacy-notice {
  padding: 10px 12px;
  border-left: 3px solid var(--primary);
  background: var(--pink-light);
  line-height: 1.7;
}
</style>
