<script setup lang="ts">
import { computed } from 'vue';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import BirthPlanSummaryCard from './BirthPlanSummaryCard.vue';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { localDate, type PregnancyRecord } from '@/domain/family';

type BirthPlan = Extract<PregnancyRecord, { type: 'birthPlan' }>;
const { records, disabled, message, error, reportError, save } = usePregnancyRecords();
const savedPlan = computed(
  () => records.value.find((record): record is BirthPlan => record.type === 'birthPlan') ?? null,
);
const topics = [
  { field: 'discussPainRelief', label: '镇痛与舒适支持' },
  { field: 'discussPosition', label: '活动与体位选择' },
  { field: 'discussProcedures', label: '可能的医疗处理与沟通方式' },
  { field: 'discussNewbornCare', label: '新生儿出生后的照护安排' },
  { field: 'discussEarlyContact', label: '母婴早期接触与喂养安排' },
] as const;

const { form, before, stale, draft, reset, cancel } = usePregnancyDraft({
  type: 'birthPlan',
  initial: savedPlan.value,
  defaults: () => ({
    date: localDate(),
    supportPerson: '',
    discussPainRelief: false,
    discussPosition: false,
    discussProcedures: false,
    discussNewbornCare: false,
    discussEarlyContact: false,
    questions: '',
    notes: '',
  }),
  fields: (item: BirthPlan) => ({
    date: item.date,
    supportPerson: item.supportPerson,
    discussPainRelief: item.discussPainRelief,
    discussPosition: item.discussPosition,
    discussProcedures: item.discussProcedures,
    discussNewbornCare: item.discussNewbornCare,
    discussEarlyContact: item.discussEarlyContact,
    questions: item.questions,
    notes: item.notes,
  }),
});

const selectedTopics = computed(() => topics.filter((topic) => form[topic.field]));
const printableTopics = computed(() =>
  savedPlan.value ? topics.filter((topic) => savedPlan.value?.[topic.field]) : [],
);

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  reportError('');

  if (
    !form.supportPerson.trim() &&
    !selectedTopics.value.length &&
    !form.questions.trim() &&
    !form.notes.trim()
  ) {
    reportError('请至少填写一项想讨论的安排或问题。');

    return;
  }

  const value: BirthPlan = {
    id: 'birth-plan',
    type: 'birthPlan',
    date: form.date,
    supportPerson: form.supportPerson.trim(),
    discussPainRelief: form.discussPainRelief,
    discussPosition: form.discussPosition,
    discussProcedures: form.discussProcedures,
    discussNewbornCare: form.discussNewbornCare,
    discussEarlyContact: form.discussEarlyContact,
    questions: form.questions.trim(),
    notes: form.notes.trim(),
  };

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset(value);
  }
}
</script>

<template>
  <div class="pregnancy-columns birth-plan-layout">
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑分娩沟通计划' : '整理分娩沟通计划' }}</h2>
        <span class="tag">家庭记录</span>
      </div>
      <p class="muted">
        这是你希望与产科团队沟通的事项，不是医疗指令或结果保证。实际安排请结合本人意愿、医疗评估与现场条件讨论。
      </p>
      <p class="muted">启用家庭同步后，已保存内容会对家庭成员可见；请只填写愿意共享的信息。</p>
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
          <label class="field">
            记录日期
            <input
              v-model="form.date"
              type="date"
              required
            />
          </label>
          <label class="field">
            希望的陪同者（可留空）
            <input
              v-model="form.supportPerson"
              maxlength="80"
              placeholder="按自己的需要填写"
            />
          </label>
          <fieldset class="birth-plan-topics">
            <legend>希望和医护团队讨论的主题</legend>
            <label
              v-for="topic in topics"
              :key="topic.field"
              class="check-option"
            >
              <input
                v-model="form[topic.field]"
                type="checkbox"
              />
              {{ topic.label }}
            </label>
          </fieldset>
          <label class="field">
            想提前提出的问题
            <textarea
              v-model="form.questions"
              maxlength="2000"
              rows="4"
              placeholder="把想问医生或助产士的问题记在这里"
            />
          </label>
          <label class="field">
            其他希望团队了解的安排
            <textarea
              v-model="form.notes"
              maxlength="2000"
              rows="4"
            />
          </label>
          <div class="form-actions">
            <button class="button button-primary">
              {{ before ? '保存计划修改' : '保存沟通计划' }}
            </button>
            <button
              v-if="before"
              class="button button-secondary"
              type="button"
              @click="cancel"
            >
              取消编辑
            </button>
          </div>
        </fieldset>
      </form>
      <p
        v-if="stale"
        class="form-error"
        role="alert"
      >
        计划已在其他页面更新。请清除草稿并重新编辑最新版本。
      </p>
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

    <BirthPlanSummaryCard
      :plan="savedPlan"
      :topics="printableTopics"
    />
  </div>
</template>

<style scoped>
.birth-plan-topics {
  display: grid;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}

.birth-plan-topics legend {
  padding: 0 5px;
  font-size: 14px;
  font-weight: 600;
}

.birth-plan-topics .check-option {
  justify-content: flex-start;
}
</style>
