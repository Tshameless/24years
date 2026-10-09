<script setup lang="ts">
import { currency, type Expense } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';

defineProps<{ expenses: readonly Expense[]; disabled?: boolean }>();

defineEmits<{ remove: [id: string] }>();
</script>

<template>
  <ul
    v-if="expenses.length"
    class="expense-list"
  >
    <li
      v-for="expense in expenses"
      :key="expense.id"
      class="expense-row"
    >
      <span
        class="expense-icon"
        :class="{ allowance: expense.kind === 'allowance' }"
      >
        <AppIcon
          :name="expense.kind === 'allowance' ? 'download' : 'wallet'"
          :size="19"
        />
      </span>
      <div class="expense-info">
        <strong>{{ expense.title }}</strong>
        <small>
          {{ expense.date }} · {{ expense.kind === 'allowance' ? '津贴入账' : expense.category }}
        </small>
        <small
          v-if="expense.reimbursedCents"
          class="reimbursed"
        >
          含已报销 {{ currency(expense.reimbursedCents) }}
        </small>
      </div>
      <span
        class="expense-amount numbers"
        :class="{ allowance: expense.kind === 'allowance' }"
      >
        {{ expense.kind === 'allowance' ? '+' : '−' }}{{ currency(expense.amountCents) }}
      </span>
      <button
        class="icon-button"
        :disabled="disabled"
        :aria-label="`删除账目：${expense.title}`"
        @click="$emit('remove', expense.id)"
      >
        <AppIcon
          name="trash"
          :size="16"
        />
      </button>
    </li>
  </ul>
  <div
    v-else
    class="empty-state"
  >
    <span class="empty-icon">
      <AppIcon
        name="wallet"
        :size="25"
      />
    </span>
    <h3>让每一笔支出，都心中有数</h3>
    <p>这个分类还没有账目，从第一笔真实记录开始。</p>
  </div>
</template>

<style scoped>
.expense-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.expense-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}

.expense-row:last-child {
  border: 0;
}

.expense-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--pink-light);
  color: var(--primary-ink);
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.expense-icon.allowance {
  background: var(--green-light);
  color: var(--green);
}

.expense-info {
  flex: 1;
  min-width: 0;
}

.expense-info strong {
  font-size: 14px;
  font-weight: 500;
  display: block;
  overflow-wrap: anywhere;
}

.expense-info small {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 7px;
}

.expense-info .reimbursed {
  color: var(--green);
}

.expense-amount {
  font-size: 16px;
  white-space: nowrap;
}

.expense-amount.allowance {
  color: var(--green);
}

@media (max-width: 540px) {
  .expense-row {
    gap: 7px;
    flex-wrap: wrap;
  }

  .expense-icon {
    display: none;
  }

  .expense-amount {
    font-size: 13px;
  }

  .expense-row .icon-button {
    width: 36px;
  }
}
</style>
