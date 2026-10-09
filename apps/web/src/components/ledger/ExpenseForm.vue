<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import {
  expenseCategories,
  localDate,
  parseMoney,
  isDate,
  type ExpenseCategory,
  type Expense,
} from '@/domain/family';

const props = defineProps<{ expense?: Expense }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const { data, addExpense, updateExpense, locked, cloud } = useFamily();
const before = props.expense ? { ...props.expense } : undefined;
let draftId = crypto.randomUUID();
const stale = computed(
  () =>
    before &&
    JSON.stringify(data.value.expenses.find((item) => item.id === before.id)) !==
      JSON.stringify(before),
);

const form = reactive({
  title: before?.title ?? '',
  date: before?.date ?? localDate(),
  kind: before?.kind ?? 'expense',
  category: before?.category ?? ('产检医疗' as ExpenseCategory),
  amount: before ? (before.amountCents / 100).toFixed(2) : '',
  reimbursed: before ? (before.reimbursedCents / 100).toFixed(2) : '0',
});

const error = shallowRef('');

async function submit() {
  error.value = '';

  const amountCents = parseMoney(form.amount);
  const reimbursedCents = form.kind === 'allowance' ? 0 : parseMoney(form.reimbursed);

  if (!form.title.trim() || !isDate(form.date)) {
    error.value = '请填写名称和有效日期。';

    return;
  }

  if (amountCents === null || amountCents <= 0 || reimbursedCents === null) {
    error.value = '请输入大于 0 的金额，最多保留两位小数；报销金额不能为负。';

    return;
  }

  if (reimbursedCents > amountCents) {
    error.value = '医保报销不能超过这笔账目的总额。';

    return;
  }

  const value = {
    title: form.title.trim(),
    date: form.date,
    kind: form.kind,
    category: form.category,
    amountCents,
    reimbursedCents,
  };
  const saved = before
    ? await updateExpense({ ...value, id: before.id }, before)
    : await addExpense(value, draftId);

  if (saved) {
    draftId = crypto.randomUUID();
    form.title = '';
    form.amount = '';
    form.reimbursed = '0';
    emit('saved');
  }
}
</script>

<template>
  <form
    class="form-grid"
    @submit.prevent="submit"
  >
    <p
      v-if="stale"
      class="form-error"
    >
      这笔账目已被修改或删除。输入仍保留，请取消后从最新列表重新编辑。
    </p>
    <label class="field">
      收支类型
      <select v-model="form.kind">
        <option value="expense">家庭支出</option>
        <option value="allowance">已到账津贴</option>
      </select>
    </label>
    <label class="field">
      账目名称
      <input
        v-model="form.title"
        maxlength="80"
        required
        placeholder="例如：本次产检费用"
      />
    </label>
    <div class="form-row">
      <label class="field">
        发生日期
        <input
          v-model="form.date"
          type="date"
          required
          :max="localDate()"
        />
      </label>
      <label
        v-if="form.kind === 'expense'"
        class="field"
      >
        分类
        <select v-model="form.category">
          <option
            v-for="category in expenseCategories"
            :key="category"
          >
            {{ category }}
          </option>
        </select>
      </label>
    </div>
    <label class="field">
      {{ form.kind === 'expense' ? '账单总额（元）' : '到账金额（元）' }}
      <input
        v-model="form.amount"
        inputmode="decimal"
        required
        placeholder="0.00"
        maxlength="11"
      />
    </label>
    <label
      v-if="form.kind === 'expense'"
      class="field"
    >
      已报销金额（元）
      <input
        v-model="form.reimbursed"
        inputmode="decimal"
        required
        maxlength="11"
      />
      <small>仅填写已实际报销的金额，不重复记作津贴。</small>
    </label>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button button-primary"
      :disabled="locked || !!stale"
    >
      {{ before ? '保存账目修改' : '保存账目' }}
    </button>
    <button
      v-if="before"
      class="button button-secondary"
      type="button"
      @click="
        cloud.clearError();
        $emit('cancel');
      "
    >
      取消编辑
    </button>
  </form>
</template>
