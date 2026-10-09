<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { currency, expenseCategories, summarizeExpenses } from '@/domain/family';
import ExpenseForm from './ExpenseForm.vue';
import ExpenseList from './ExpenseList.vue';

const { data, removeExpense, locked } = useFamily();
const filter = shallowRef('全部');
const notice = shallowRef('');

const totals = computed(() => summarizeExpenses(data.value.expenses));

const visible = computed(() =>
  data.value.expenses
    .filter(
      (item) =>
        filter.value === '全部' ||
        (filter.value === '津贴'
          ? item.kind === 'allowance'
          : item.kind === 'expense' && item.category === filter.value),
    )
    .sort((a, b) => b.date.localeCompare(a.date)),
);

function confirmRemove(id: string) {
  if (window.confirm('确定删除这笔账目？此操作无法撤销。') && removeExpense(id)) {
    notice.value = '账目已删除。';
  }
}
</script>

<template>
  <section
    class="ledger-summary"
    aria-label="累计账目汇总"
  >
    <div class="summary-main">
      <span>累计净支出</span>
      <strong
        class="numbers"
        data-testid="net-cost"
      >
        {{ currency(totals.net) }}
      </strong>
      <small>每一份投入，清楚记录。</small>
    </div>
    <div class="summary-detail">
      <div>
        <span>账单总支出</span>
        <strong class="numbers">{{ currency(totals.total) }}</strong>
      </div>
      <b>−</b>
      <div>
        <span>已报销</span>
        <strong class="numbers">{{ currency(totals.reimbursed) }}</strong>
      </div>
      <b>−</b>
      <div>
        <span>已到账津贴</span>
        <strong class="numbers">{{ currency(totals.allowance) }}</strong>
      </div>
    </div>
  </section>
  <div class="ledger-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>收支明细</h2>
        <span class="tag">{{ visible.length }} 笔记录</span>
      </div>
      <div
        class="category-filters"
        aria-label="账目分类"
      >
        <button
          v-for="category in ['全部', ...expenseCategories, '津贴']"
          :key="category"
          :aria-pressed="filter === category"
          :class="{ selected: filter === category }"
          @click="filter = category"
        >
          {{ category }}
        </button>
      </div>
      <ExpenseList
        :expenses="visible"
        :disabled="locked"
        @remove="confirmRemove"
      />
      <p
        v-if="notice"
        class="success-message"
        role="status"
      >
        {{ notice }}
      </p>
      <p class="ledger-footnote">
        汇总展示全部账目，不受分类筛选影响。净支出可为负值，表示到账津贴大于当前自付支出。
      </p>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>记下这一笔</h2>
        <span class="tag">人民币 CNY</span>
      </div>
      <ExpenseForm @saved="notice = '账目已保存。'" />
    </section>
  </div>
</template>

<style scoped>
.ledger-summary {
  display: flex;
  align-items: center;
  gap: 35px;
  background: var(--green-light);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 26px;
}

.summary-main {
  min-width: 225px;
}

.summary-main > span {
  font-size: 13px;
  color: var(--green);
}

.summary-main > strong {
  font-size: 38px;
  font-weight: 500;
  display: block;
  margin: 10px 0 7px;
  overflow-wrap: anywhere;
}

.summary-main small {
  color: var(--text-secondary);
  font-size: 12px;
}

.summary-detail {
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 1;
  justify-content: space-between;
  padding-left: 30px;
  border-left: 1px solid color-mix(in srgb, var(--green) 18%, transparent);
}

.summary-detail span {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 12px;
}

.summary-detail strong {
  font-size: 19px;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.summary-detail b {
  font-weight: 400;
  color: var(--green);
}

.ledger-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(290px, 1fr);
  gap: 25px;
  align-items: start;
}

.category-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 15px;
}

.category-filters button {
  background: transparent;
  border: 0;
  border-radius: 8px;
  min-height: 44px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.category-filters .selected {
  background: var(--green-light);
  color: var(--green);
}

.ledger-footnote {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.8;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px dashed var(--border);
}

@media (max-width: 1200px) {
  .ledger-summary {
    flex-wrap: wrap;
  }

  .summary-detail {
    border: 0;
    padding: 0;
    min-width: 100%;
  }
}

@media (max-width: 1000px) {
  .ledger-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .ledger-summary {
    padding: 24px;
    gap: 25px;
  }

  .summary-detail {
    gap: 8px;
  }

  .summary-detail strong {
    font-size: 14px;
  }

  .summary-main > strong {
    font-size: 34px;
  }
}
</style>
