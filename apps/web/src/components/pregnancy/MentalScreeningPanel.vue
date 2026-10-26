<script setup lang="ts">
import { computed } from 'vue';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Screening = Extract<PregnancyRecord, { type: 'mentalScreening' }>;
const { records, disabled, error, message, reportError, save } = usePregnancyRecords();
const previous = computed(() => records.value.find((item): item is Screening => item.type === 'mentalScreening'));
const { form, before, stale, draft, reset, cancel } = usePregnancyDraft({
  type: 'mentalScreening',
  initial: previous.value ?? null,
  defaults: () => ({ date: localDate(), score: '0', selfHarm: false, notes: '' }),
  fields: (item: Screening) => ({ date: item.date, score: String(item.score), selfHarm: item.selfHarm, notes: item.notes }),
});
const risk = computed(() => form.selfHarm || Number(form.score) >= 13);
async function submit() {
  reportError('');
  const value: Screening = { id: 'mental-screening', type: 'mentalScreening', date: form.date, score: Number(form.score), selfHarm: form.selfHarm, notes: form.notes.trim() };
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
        <label class="field">近两周困扰程度（0–30，自行填写量表或医生建议分数）<input v-model="form.score" type="number" min="0" max="30" step="1" /></label>
        <label class="check-option"><input v-model="form.selfHarm" type="checkbox" />出现过自伤或无法保证安全的想法</label>
        <p v-if="risk" class="form-error" role="alert">请尽快联系专业人员或急救服务；如果有即时危险，请拨打 120 或当地急救电话。</p>
        <label class="field">想告诉医护人员的情况<textarea v-model="form.notes" rows="4" maxlength="2000" placeholder="睡眠、焦虑、支持情况或希望获得的帮助"></textarea></label>
        <button class="button button-primary">保存心理自查</button>
      </fieldset>
    </form>
    <p v-if="previous" class="muted">上次记录：{{ previous.date }}，分数 {{ previous.score }}。</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="message" class="success-message" role="status">{{ message }}</p>
  </section>
</template>
