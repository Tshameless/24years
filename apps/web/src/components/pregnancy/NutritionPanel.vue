<script setup lang="ts">
import { computed } from 'vue';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Nutrition = Extract<PregnancyRecord, { type: 'nutrition' }>;
const { records, disabled, error, message, reportError, save, remove } = usePregnancyRecords();
const entries = computed(() => records.value.filter((item): item is Nutrition => item.type === 'nutrition').sort((a, b) => b.date.localeCompare(a.date)));
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'nutrition',
  defaults: () => ({ date: localDate(), water: false, protein: false, vegetables: false, supplement: false, notes: '' }),
  fields: (item: Nutrition) => ({ date: item.date, water: item.water, protein: item.protein, vegetables: item.vegetables, supplement: item.supplement, notes: item.notes }),
});

async function submit() {
  reportError('');
  const value: Nutrition = { id: before.value?.id ?? draft.id.value, type: 'nutrition', date: form.date, water: form.water, protein: form.protein, vegetables: form.vegetables, supplement: form.supplement, notes: form.notes.trim() };
  if (disabled.value || stale.value || !validPregnancyRecord(value) || value.date > localDate()) {
    reportError('请填写不晚于今天的有效日期。');
    return;
  }
  if (await save({ type: 'pregnancy', before: before.value, value })) reset();
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading"><h2>营养与补剂记录</h2><span class="tag">{{ entries.length }} 天</span></div>
      <p class="muted">记录今天是否完成饮水、优质蛋白、蔬菜和遵医嘱补剂。这里不替代个体化营养方案。</p>
      <div class="nutrition-guide">
        <strong>按阶段提醒</strong>
        <p>孕早期优先保证能进食和补水；孕中晚期关注多样饮食、蛋白质和铁钙来源。补剂剂量、咖啡因和特殊饮食请按产科或营养科建议。</p>
      </div>
      <p v-if="!entries.length" class="empty-state">从今天的四项小记录开始。</p>
      <ul v-else class="record-list">
        <li v-for="item in entries" :key="item.id">
          <div class="record-heading"><strong>{{ item.date }}</strong><span class="tag">{{ [item.water, item.protein, item.vegetables, item.supplement].filter(Boolean).length }}/4 完成</span></div>
          <p class="record-notes">{{ item.notes || '无备注' }}</p>
          <div class="record-actions"><button class="text-button" :disabled="disabled" @click="edit(item)">编辑</button><button class="text-button" :disabled="disabled" @click="remove(item)">删除</button></div>
        </li>
      </ul>
    </section>
    <section class="panel">
      <div class="panel-heading"><h2>{{ before ? '编辑' : '记录' }}今日营养</h2></div>
      <form class="form-grid" @submit.prevent="submit">
        <FormDraftNotice :dirty="draft.dirty.value" :restored="draft.restored.value" :error="draft.storageError.value" :blocked="stale" @discard="cancel" />
        <fieldset class="record-fields" :disabled="disabled || stale">
          <label class="field">记录日期<input v-model="form.date" type="date" :max="localDate()" /></label>
          <label class="check-option"><input v-model="form.water" type="checkbox" />今天按自己的计划补充了饮水</label>
          <label class="check-option"><input v-model="form.protein" type="checkbox" />吃到优质蛋白</label>
          <label class="check-option"><input v-model="form.vegetables" type="checkbox" />吃到蔬菜或水果</label>
          <label class="check-option"><input v-model="form.supplement" type="checkbox" />完成遵医嘱补剂</label>
          <label class="field">备注<textarea v-model="form.notes" rows="3" maxlength="2000" placeholder="孕吐、忌口或医生建议"></textarea></label>
          <button class="button button-primary">保存营养记录</button>
        </fieldset>
      </form>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="message" class="success-message" role="status">{{ message }}</p>
    </section>
  </div>
</template>

<style scoped>
.nutrition-guide {
  margin: 14px 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--green-light);
  font-size: 13px;
  line-height: 1.7;
}

.nutrition-guide p {
  margin: 4px 0 0;
}
</style>
