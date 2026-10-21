<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { currency, summarizeExpenses, type Expense } from '@/domain/family';
import { downloadLedgerCsv } from '@/domain/ledgerReport';

const props = defineProps<{ expenses: readonly Expense[]; month: string; category: string }>();
const totals = computed(() => summarizeExpenses(props.expenses));
const scopeLabel = computed(() => (props.month || '全部月份') + ' · ' + props.category);
const message = shallowRef('');
const error = shallowRef('');
watch(
  () => [props.expenses, props.month, props.category],
  () => {
    message.value = '';
    error.value = '';
  },
);

function exportCsv() {
  if (
    !props.expenses.length ||
    !window.confirm(
      '导出「' +
        scopeLabel.value +
        '」的 ' +
        props.expenses.length +
        ' 笔已保存账目？文件包含家庭财务信息，请妥善保管。',
    )
  ) {
    return;
  }

  try {
    downloadLedgerCsv(
      props.expenses,
      '24years-ledger-' + (props.month || 'all') + '-' + props.category + '.csv',
    );
    message.value = '已发起 CSV 下载，请在浏览器下载列表查看。此文件不能用于备份恢复。';
    error.value = '';
  } catch {
    error.value = '无法发起下载，请检查浏览器下载权限后重试；账目未被修改。';
    message.value = '';
  }
}
</script>

<template>
  <section
    class="filtered-report"
    aria-label="筛选账目汇总"
  >
    <div class="report-heading">
      <h3>筛选汇总</h3>
      <span class="tag">{{ scopeLabel }} · {{ expenses.length }} 笔</span>
    </div>
    <dl class="report-totals">
      <div>
        <dt>支出</dt>
        <dd data-testid="filtered-total">{{ currency(totals.total) }}</dd>
      </div>
      <div>
        <dt>已报销</dt>
        <dd data-testid="filtered-reimbursed">{{ currency(totals.reimbursed) }}</dd>
      </div>
      <div>
        <dt>已到账津贴</dt>
        <dd data-testid="filtered-allowance">{{ currency(totals.allowance) }}</dd>
      </div>
      <div>
        <dt>净支出</dt>
        <dd data-testid="filtered-net">{{ currency(totals.net) }}</dd>
      </div>
    </dl>
    <p class="report-note">
      按发生日期归月；已报销金额计入原账目月份，不代表该月实际报销到账。仅统计已保存记录，不含草稿。
    </p>
    <button
      type="button"
      class="button button-secondary"
      :disabled="!expenses.length"
      @click="exportCsv"
    >
      导出当前筛选 CSV
    </button>
    <p class="report-note">
      导出范围与筛选汇总一致，金额单位为人民币元。特殊公式开头的文本加单引号保护；完整恢复请使用
      JSON 备份。
    </p>
    <p
      v-if="message"
      class="success-message"
      role="status"
    >
      {{ message }}
    </p>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<style scoped>
.filtered-report {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  min-width: 0;
}

.report-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.report-heading h3 {
  margin: 0;
  font-size: 15px;
}

.report-totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 20px 0;
}

.report-totals dt {
  font-size: 12px;
  color: var(--text-secondary);
}

.report-totals dd {
  margin: 6px 0 0;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.report-note {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}
</style>
