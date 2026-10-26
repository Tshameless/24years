<script setup lang="ts">
import { computed } from 'vue';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Symptom = Extract<PregnancyRecord, { type: 'symptom' }>;
const options = ['出血', '腹痛或持续下坠', '头痛', '视物模糊', '胸闷气短', '明显水肿', '发热', '分泌物变化', '胎动减少', '其他'];
const { records, disabled, error, message, reportError, save, remove } = usePregnancyRecords();
const entries = computed(() => records.value.filter((item): item is Symptom => item.type === 'symptom').sort((a, b) => b.date.localeCompare(a.date)));
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'symptom',
  defaults: () => ({ date: localDate(), symptoms: '[]', severity: 'mild', notes: '' }),
  fields: (item: Symptom) => ({ date: item.date, symptoms: JSON.stringify(item.symptoms), severity: item.severity, notes: item.notes }),
});
const selected = computed<string[]>(() => { try { const value = JSON.parse(form.symptoms); return Array.isArray(value) ? value : []; } catch { return []; } });
const urgent = computed(() => form.severity === 'severe' || selected.value.some((item) => ['出血', '视物模糊', '胸闷气短', '胎动减少'].includes(item)));
function toggle(item: string) { form.symptoms = JSON.stringify(selected.value.includes(item) ? selected.value.filter((value) => value !== item) : [...selected.value, item]); }
async function submit() {
  reportError('');
  const value: Symptom = { id: before.value?.id ?? draft.id.value, type: 'symptom', date: form.date, symptoms: selected.value, severity: form.severity as Symptom['severity'], notes: form.notes.trim() };
  if (disabled.value || stale.value || !validPregnancyRecord(value) || value.date > localDate() || !value.symptoms.length) { reportError('请选择至少一种症状，并填写有效日期。'); return; }
  if (await save({ type: 'pregnancy', before: before.value, value })) reset();
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel"><div class="panel-heading"><h2>症状与异常观察</h2><span class="tag">{{ entries.length }} 条</span></div><p class="muted">记录变化供自己和医护人员参考。严重、持续或让你不安的症状不要等待记录，直接联系产科或急救。</p><p v-if="!entries.length" class="empty-state">还没有症状记录。</p><ul v-else class="record-list"><li v-for="item in entries" :key="item.id"><div class="record-heading"><strong>{{ item.date }} · {{ item.symptoms.join('、') }}</strong><span class="tag">{{ item.severity === 'severe' ? '严重' : item.severity === 'moderate' ? '中等' : '轻微' }}</span></div><p v-if="item.notes" class="record-notes">{{ item.notes }}</p><div class="record-actions"><button class="text-button" :disabled="disabled" @click="edit(item)">编辑</button><button class="text-button" :disabled="disabled" @click="remove(item)">删除</button></div></li></ul></section>
    <section class="panel"><div class="panel-heading"><h2>{{ before ? '编辑' : '记录' }}症状</h2></div><form class="form-grid" @submit.prevent="submit"><FormDraftNotice :dirty="draft.dirty.value" :restored="draft.restored.value" :error="draft.storageError.value" :blocked="stale" @discard="cancel" /><fieldset class="record-fields" :disabled="disabled || stale"><label class="field">观察日期<input v-model="form.date" type="date" :max="localDate()" /></label><fieldset class="symptom-options"><legend>出现了什么变化</legend><label v-for="item in options" :key="item" class="check-option"><input type="checkbox" :checked="selected.includes(item)" @change="toggle(item)" />{{ item }}</label></fieldset><label class="field">程度<select v-model="form.severity"><option value="mild">轻微</option><option value="moderate">中等</option><option value="severe">严重</option></select></label><p v-if="urgent" class="form-error" role="alert">当前选择包含需要尽快咨询医护人员的情况；如症状严重、持续或伴随大量出血、意识异常，请拨打 120。</p><label class="field">补充说明<textarea v-model="form.notes" rows="4" maxlength="2000" placeholder="开始时间、持续多久、是否反复或医生交代"></textarea></label><button class="button button-primary">保存症状记录</button></fieldset></form><p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="message" class="success-message" role="status">{{ message }}</p></section>
  </div>
</template>

<style scoped>
.symptom-options { border: 0; padding: 0; margin: 0; display: grid; gap: 10px; }

.symptom-options legend { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
</style>
