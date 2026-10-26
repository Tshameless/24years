<script setup lang="ts">
import type { PregnancyRecord } from '@/domain/family';

type BirthPlan = Extract<PregnancyRecord, { type: 'birthPlan' }>;

defineProps<{
  plan: BirthPlan | null;
  topics: readonly { readonly field: string; readonly label: string }[];
}>();

function printPlan() {
  window.print();
}
</script>

<template>
  <section
    v-if="plan"
    class="panel print-target"
  >
    <div class="print-header">
      <p class="eyebrow">24YEARS · FAMILY COPY</p>
      <h2>分娩沟通计划</h2>
      <p>记录日期：{{ plan.date }}</p>
    </div>
    <dl class="plan-summary">
      <dt>希望的陪同者</dt>
      <dd>{{ plan.supportPerson || '未填写' }}</dd>
      <dt>希望讨论的主题</dt>
      <dd>
        <ul v-if="topics.length">
          <li
            v-for="topic in topics"
            :key="topic.field"
          >
            {{ topic.label }}
          </li>
        </ul>
        <span v-else>未指定</span>
      </dd>
      <dt>想提出的问题</dt>
      <dd class="plan-text">{{ plan.questions || '未填写' }}</dd>
      <dt>其他安排</dt>
      <dd class="plan-text">{{ plan.notes || '未填写' }}</dd>
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
</template>

<style scoped>
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
