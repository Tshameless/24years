<script setup lang="ts">
import { computed } from 'vue';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
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

function printPlan() {
  window.print();
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

    <section
      v-if="savedPlan"
      class="panel print-target"
    >
      <div class="print-header">
        <p class="eyebrow">24YEARS · FAMILY COPY</p>
        <h2>分娩沟通计划</h2>
        <p>记录日期：{{ savedPlan.date }}</p>
      </div>
      <dl class="plan-summary">
        <dt>希望的陪同者</dt>
        <dd>{{ savedPlan.supportPerson || '未填写' }}</dd>
        <dt>希望讨论的主题</dt>
        <dd>
          <ul v-if="printableTopics.length">
            <li
              v-for="topic in printableTopics"
              :key="topic.field"
            >
              {{ topic.label }}
            </li>
          </ul>
          <span v-else>未指定</span>
        </dd>
        <dt>想提出的问题</dt>
        <dd class="plan-text">{{ savedPlan.questions || '未填写' }}</dd>
        <dt>其他安排</dt>
        <dd class="plan-text">{{ savedPlan.notes || '未填写' }}</dd>
      </dl>
      <p class="print-footnote">
        本记录用于沟通，不代替医疗评估或正式病历。请与医护团队逐项讨论；安排可能因本人意愿、医疗情况和现场条件调整。
      </p>
      <button
        class="button button-secondary print-button"
        type="button"
        @click="printPlan"
      >
        打印 / 另存为 PDF
      </button>
    </section>
    <section
      v-else
      class="panel empty-state"
    >
      保存后会在这里生成便于查看和打印的沟通单。
    </section>
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

.plan-summary {
  margin: 0;
}

.plan-summary dt {
  margin-top: 20px;
  color: var(--muted);
  font-size: 13px;
}

.plan-summary dd {
  margin: 7px 0 0;
  overflow-wrap: anywhere;
  line-height: 1.8;
}

.plan-summary ul {
  margin: 0;
  padding-left: 20px;
}

.plan-text {
  white-space: pre-wrap;
}

.print-footnote {
  margin: 24px 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}

.print-header h2 {
  margin-bottom: 8px;
}

.print-header p:last-child {
  color: var(--muted);
  font-size: 13px;
}

@media print {
  @page {
    size: A4;
    margin: 18mm;
  }

  :global(body *:not(:has(.print-target)):not(.print-target):not(.print-target *)) {
    display: none !important;
  }

  :global(body *:has(.print-target)) {
    display: block !important;
    position: static !important;
    transform: none !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    background: #fff !important;
    overflow: visible !important;
  }

  .print-target {
    position: static;
    width: auto;
    max-width: none;
    border: 0;
    padding: 0;
    margin: 0;
    box-shadow: none;
    background: #fff;
    color: #111;
  }

  .print-target .tag,
  .print-button {
    display: none !important;
  }

  .plan-summary dt,
  .print-footnote,
  .print-header p {
    color: #444;
  }
}
</style>
