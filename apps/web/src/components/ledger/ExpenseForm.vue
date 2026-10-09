<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import {
  expenseCategories,
  localDate,
  parseMoney,
  isDate,
  type ExpenseCategory,
} from '@/domain/family';

const emit = defineEmits<{ saved: [] }>();
const { addExpense, locked } = useFamily();

const form = reactive({
  title: '',
  date: localDate(),
  kind: 'expense' as 'expense' | 'allowance',
  category: '产检医疗' as ExpenseCategory,
  amount: '',
  reimbursed: '0',
});

const error = shallowRef('');

function submit() {
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

  if (
    addExpense({
      title: form.title.trim(),
      date: form.date,
      kind: form.kind,
      category: form.category,
      amountCents,
      reimbursedCents,
    })
  ) {
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
      :disabled="locked"
    >
      保存账目
    </button>
  </form>
</template>
