<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { expenseCategories, summarizeExpenses, type Expense } from '@/domain/family';
import ExpenseForm from './ExpenseForm.vue';
import ExpenseList from './ExpenseList.vue';
import LedgerReport from './LedgerReport.vue';
import LedgerSummaryBanner from './LedgerSummaryBanner.vue';
import { filterLedger, type LedgerCategory } from '@/domain/ledgerReport';

const { data, removeExpense, locked, today } = useFamily();
const filter = shallowRef<LedgerCategory>('全部');
const month = shallowRef('');
const categories: LedgerCategory[] = ['全部', ...expenseCategories, '津贴'];
const notice = shallowRef('');
const editing = shallowRef<Expense>();

function edit(id: string) {
  const expense = data.value.expenses.find((item) => item.id === id);
  editing.value = expense ? { ...expense } : undefined;
  notice.value = '';
}

const totals = computed(() => summarizeExpenses(data.value.expenses));

const visible = computed(() => filterLedger(data.value.expenses, month.value, filter.value));

async function confirmRemove(id: string) {
  if (window.confirm('确定删除这笔账目？此操作无法撤销。') && (await removeExpense(id))) {
    notice.value = '账目已删除。';
  }
}
</script>

<template>
  <LedgerSummaryBanner :totals="totals" />
  <div class="ledger-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>收支明细</h2>
        <span class="tag">{{ visible.length }} 笔记录</span>
      </div>
      <div class="month-filters">
        <label class="field">
          账目月份
          <input
            v-model="month"
            type="month"
          />
          <small>留空显示全部月份</small>
        </label>
        <button
          type="button"
          class="text-button"
          @click="month = today.slice(0, 7)"
        >
          本月
        </button>
        <button
          type="button"
          class="text-button"
          @click="
            month = '';
            filter = '全部';
          "
        >
          重置筛选
        </button>
      </div>
      <div
        class="category-filters"
        aria-label="账目分类"
      >
        <button
          v-for="category in categories"
          :key="category"
          :aria-pressed="filter === category"
          :class="{ selected: filter === category }"
          @click="filter = category"
        >
          {{ category }}
        </button>
      </div>
      <LedgerReport
        :expenses="visible"
        :month="month"
        :category="filter"
      />
      <ExpenseList
        :expenses="visible"
        :disabled="locked"
        @remove="confirmRemove"
        @edit="edit"
      />
      <p
        v-if="notice"
        class="success-message"
        role="status"
      >
        {{ notice }}
      </p>
      <p class="ledger-footnote">
        顶部累计汇总展示全部账目，不受月份与分类筛选影响。筛选汇总与下方明细一致；净支出允许为负值。
      </p>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ editing ? '修改这笔账目' : '记下这一笔' }}</h2>
        <span class="tag">人民币 CNY</span>
      </div>
      <ExpenseForm
        :key="editing?.id ?? 'new'"
        :expense="editing"
        @saved="
          notice = '账目已保存。';
          editing = undefined;
        "
        @cancel="editing = undefined"
      />
    </section>
  </div>
</template>

<style scoped>
.month-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.month-filters .field {
  flex: 1 1 180px;
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

@media (max-width: 1000px) {
  .ledger-columns {
    grid-template-columns: 1fr;
  }
}
</style>
