<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  currency,
  expenseCategories,
  parseMoney,
  summarizeExpenses,
  type ExpenseCategory,
} from '@24years/domain/ledger';
import { filterLedger, ledgerCsv, type LedgerCategory } from '@24years/domain/ledgerReport';
import { localDate } from '@24years/domain/primitives';

import { addExpense, familyStore, removeExpense, updateExpense } from '@/store/family';

const today = localDate();
const month = ref(today.slice(0, 7));
const category = ref<LedgerCategory>('全部');
const formOpen = ref(false);
const editingId = ref<string | null>(null);

const title = ref('');
const date = ref(today);
const kind = ref<'expense' | 'allowance'>('expense');
const itemCategory = ref<ExpenseCategory>('产检医疗');
const amount = ref('');
const reimbursed = ref('');

const categoryOptions: LedgerCategory[] = ['全部', '津贴', ...expenseCategories];
const filtered = computed(() => filterLedger(familyStore.data.expenses, month.value, category.value));
const summary = computed(() => summarizeExpenses(filtered.value));

const months = computed(() =>
  [...new Set(familyStore.data.expenses.map((item) => item.date.slice(0, 7)))].sort((a, b) =>
    b.localeCompare(a),
  ),
);

function resetForm(): void {
  editingId.value = null;
  title.value = '';
  date.value = today;
  kind.value = 'expense';
  itemCategory.value = '产检医疗';
  amount.value = '';
  reimbursed.value = '';
}

function openCreate(): void {
  resetForm();
  formOpen.value = true;
}

function openEdit(id: string): void {
  const item = familyStore.data.expenses.find((entry) => entry.id === id);

  if (!item) {
    return;
  }

  editingId.value = item.id;
  title.value = item.title;
  date.value = item.date;
  kind.value = item.kind;
  itemCategory.value = item.category;
  amount.value = (item.amountCents / 100).toFixed(2);
  reimbursed.value = item.reimbursedCents ? (item.reimbursedCents / 100).toFixed(2) : '';
  formOpen.value = true;
}

function submit(): void {
  const trimmed = title.value.trim();
  const amountCents = parseMoney(amount.value);
  const reimbursedCents = reimbursed.value.trim() ? parseMoney(reimbursed.value) : 0;

  if (!trimmed) {
    uni.showToast({ title: '请填写账目名称', icon: 'none' });

    return;
  }

  if (amountCents === null || amountCents <= 0) {
    uni.showToast({ title: '金额格式不正确', icon: 'none' });

    return;
  }

  if (reimbursedCents === null) {
    uni.showToast({ title: '已报销金额格式不正确', icon: 'none' });

    return;
  }

  if (reimbursedCents > amountCents) {
    uni.showToast({ title: '已报销不能超过支出金额', icon: 'none' });

    return;
  }

  const payload = {
    title: trimmed,
    date: date.value,
    kind: kind.value,
    category: kind.value === 'allowance' ? ('其他' as ExpenseCategory) : itemCategory.value,
    amountCents,
    reimbursedCents: kind.value === 'allowance' ? 0 : reimbursedCents,
  };

  if (editingId.value) {
    updateExpense(editingId.value, payload);
  } else {
    addExpense(payload);
  }

  formOpen.value = false;
  resetForm();
}

function remove(id: string): void {
  uni.showModal({
    title: '删除账目',
    content: '删除后无法恢复，确定继续？',
    success: (result) => {
      if (result.confirm) {
        removeExpense(id);
      }
    },
  });
}

function exportCsv(): void {
  const csv = ledgerCsv(filtered.value);

  uni.setClipboardData({
    data: csv,
    success: () => {
      uni.showToast({ title: 'CSV 已复制，可粘贴到表格应用', icon: 'none' });
    },
  });
}

const kindOptions = [
  { value: 'expense', label: '支出' },
  { value: 'allowance', label: '津贴到账' },
] as const;
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <picker mode="date" fields="month" :value="month" @change="(e: any) => (month = e.detail.value)">
          <text class="picker-value">月份：{{ month || '全部' }}</text>
        </picker>
        <text class="muted" @click="month = ''">清除</text>
      </view>
      <view class="row gap">
        <picker
          mode="selector"
          :range="categoryOptions"
          :value="categoryOptions.indexOf(category)"
          @change="(e: any) => (category = categoryOptions[e.detail.value])"
        >
          <text class="picker-value">分类：{{ category }}</text>
        </picker>
      </view>
      <view class="summary">
        <view class="row">
          <text>净支出</text>
          <text class="net">{{ currency(summary.net) }}</text>
        </view>
        <view class="row muted">
          <text>支出 {{ currency(summary.total) }}</text>
          <text>已报销 {{ currency(summary.reimbursed) }}</text>
        </view>
        <view class="row muted">
          <text>已到账津贴 {{ currency(summary.allowance) }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="row">
        <text class="section-title">账目明细</text>
        <button size="mini" type="primary" @click="openCreate">记一笔</button>
      </view>
      <view v-if="filtered.length === 0" class="muted">当前筛选下没有账目。</view>
      <view v-for="item in filtered" :key="item.id" class="entry">
        <view class="row">
          <text class="entry-title">{{ item.title }}</text>
          <text>{{ currency(item.amountCents) }}</text>
        </view>
        <view class="row muted">
          <text>{{ item.date }} · {{ item.kind === 'allowance' ? '津贴' : item.category }}</text>
          <text v-if="item.kind === 'expense' && item.reimbursedCents > 0">
            已报销 {{ currency(item.reimbursedCents) }}
          </text>
        </view>
        <view class="actions">
          <button size="mini" @click="openEdit(item.id)">编辑</button>
          <button size="mini" type="warn" @click="remove(item.id)">删除</button>
        </view>
      </view>
      <button v-if="filtered.length > 0" class="export" size="mini" @click="exportCsv">
        复制当前筛选 CSV
      </button>
    </view>

    <view v-if="formOpen" class="card">
      <view class="section-title">{{ editingId ? '编辑账目' : '记一笔' }}</view>
      <input v-model="title" class="input" placeholder="账目名称" />

      <view class="field">
        <text>日期</text>
        <picker mode="date" :value="date" @change="(e: any) => (date = e.detail.value)">
          <text class="picker-value">{{ date }}</text>
        </picker>
      </view>

      <view class="field">
        <text>类型</text>
        <picker
          mode="selector"
          :range="kindOptions"
          range-key="label"
          :value="kindOptions.findIndex((item) => item.value === kind)"
          @change="(e: any) => (kind = kindOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ kindOptions.find((i) => i.value === kind)?.label }}</text>
        </picker>
      </view>

      <view v-if="kind === 'expense'" class="field">
        <text>分类</text>
        <picker
          mode="selector"
          :range="expenseCategories"
          :value="expenseCategories.indexOf(itemCategory)"
          @change="(e: any) => (itemCategory = expenseCategories[e.detail.value])"
        >
          <text class="picker-value">{{ itemCategory }}</text>
        </picker>
      </view>

      <view class="field">
        <text>金额（元）</text>
        <input v-model="amount" class="inline-input" type="digit" placeholder="0.00" />
      </view>

      <view v-if="kind === 'expense'" class="field">
        <text>已报销（元）</text>
        <input v-model="reimbursed" class="inline-input" type="digit" placeholder="0.00" />
      </view>

      <view class="actions">
        <button size="mini" type="primary" @click="submit">保存</button>
        <button size="mini" @click="formOpen = false">取消</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 40rpx;
}

.summary {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid #f0f1f3;
}

.net {
  font-size: 36rpx;
  font-weight: 600;
  color: #e0533d;
}

.entry {
  padding: 20rpx 0;
  border-top: 2rpx solid #f0f1f3;
}

.entry-title {
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.export {
  margin-top: 20rpx;
}

.input {
  width: 100%;
  padding: 16rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
}

.inline-input {
  width: 240rpx;
  text-align: right;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 2rpx solid #f0f1f3;
}

.picker-value {
  color: #4caf50;
}
</style>
