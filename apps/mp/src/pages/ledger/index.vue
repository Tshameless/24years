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
    <!-- 真实生娃净成本大卡片 (Net Maternity Impact Ledger) -->
    <view class="card ledger-hero-card">
      <view class="row header-row">
        <picker mode="date" fields="month" :value="month" @change="(e: any) => (month = e.detail.value)">
          <view class="pill pill-surface date-filter-pill">
            <text>📅 {{ month || '全部月份' }}</text>
          </view>
        </picker>
        <text v-if="month" class="clear-link" @click="month = ''">查看全部</text>
      </view>

      <view class="net-cost-highlight">
        <text class="net-cost-label">真实家庭净自费</text>
        <view class="net-cost-value">
          <text class="currency-symbol">¥</text>
          <text class="cost-number">{{ (summary.net / 100).toFixed(2) }}</text>
        </view>
      </view>

      <view class="finance-telemetry-grid">
        <view class="finance-col expense-side">
          <text class="col-title">总支出</text>
          <text class="col-value text-expense">{{ currency(summary.total) }}</text>
        </view>
        <view class="finance-divider" />
        <view class="finance-col benefit-side">
          <text class="col-title">已报销 / 津贴</text>
          <text class="col-value text-allowance">{{ currency(summary.reimbursed + summary.allowance) }}</text>
        </view>
      </view>
    </view>

    <!-- 分类横向滑动胶囊筛选器 -->
    <view class="category-scroll-container">
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
        <view class="category-pills">
          <view
            v-for="cat in categoryOptions"
            :key="cat"
            :class="['category-pill', { active: category === cat }]"
            @click="category = cat"
          >
            <text>{{ cat }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 记账录入表单卡片 -->
    <view v-if="formOpen" class="card form-card">
      <view class="row form-header">
        <view class="section-title">{{ editingId ? '编辑账目' : '新增账目' }}</view>
        <text class="close-btn" @click="formOpen = false">取消</text>
      </view>

      <input v-model="title" class="input" placeholder="账目名称，如 NT 产检挂号" />

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

      <view class="field">
        <text>日期</text>
        <picker mode="date" :value="date" @change="(e: any) => (date = e.detail.value)">
          <text class="picker-value">{{ date }}</text>
        </picker>
      </view>

      <view v-if="kind === 'expense'" class="field">
        <text>支出分类</text>
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
        <text>金额 (元)</text>
        <input v-model="amount" class="inline-input" type="digit" placeholder="0.00" />
      </view>

      <view v-if="kind === 'expense'" class="field">
        <text>已报销 (元)</text>
        <input v-model="reimbursed" class="inline-input" type="digit" placeholder="0.00" />
      </view>

      <button class="submit-btn" type="primary" @click="submit">
        {{ editingId ? '保存修改' : '确认记入' }}
      </button>
    </view>

    <!-- 账目明细列表卡片 -->
    <view class="card list-card">
      <view class="row list-header">
        <view>
          <view class="section-title">收支明细</view>
          <view class="section-subtitle">共 {{ filtered.length }} 笔记录</view>
        </view>
        <button v-if="!formOpen" class="add-entry-btn" size="mini" type="primary" @click="openCreate">
          + 记一笔
        </button>
      </view>

      <view v-if="filtered.length === 0" class="empty-hint">
        <text class="muted">当前筛选下没有账目记录 ✨</text>
      </view>

      <view v-for="item in filtered" :key="item.id" class="entry-item">
        <view class="row entry-main">
          <view class="entry-left">
            <text class="entry-title">{{ item.title }}</text>
            <view class="entry-tags">
              <text class="entry-date">{{ item.date }}</text>
              <text class="tag-separator">·</text>
              <text class="entry-category">{{ item.kind === 'allowance' ? '生育津贴' : item.category }}</text>
              <view v-if="item.kind === 'expense' && item.reimbursedCents > 0" class="reimbursed-pill">
                已报销 {{ currency(item.reimbursedCents) }}
              </view>
            </view>
          </view>

          <text :class="['entry-amount', item.kind === 'allowance' ? 'text-allowance' : 'text-expense']">
            {{ item.kind === 'allowance' ? '+' : '-' }}{{ currency(item.amountCents) }}
          </text>
        </view>

        <view class="actions-row">
          <text class="action-link" @click="openEdit(item.id)">编辑</text>
          <text class="action-link danger" @click="remove(item.id)">删除</text>
        </view>
      </view>

      <button v-if="filtered.length > 0" class="export-btn" size="mini" @click="exportCsv">
        📋 复制当前账目 CSV 表格
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  padding-bottom: 60rpx;
}

/* 顶部净成本大卡片 */
.ledger-hero-card {
  background: linear-gradient(180deg, #ffffff 0%, $color-surface-container-low 100%);
  border: 1rpx solid rgba(218, 226, 253, 0.7);

  .header-row {
    align-items: center;
    margin-bottom: 12rpx;

    .date-filter-pill {
      font-size: 24rpx;
      font-weight: 600;
    }

    .clear-link {
      font-size: 24rpx;
      color: $color-primary;
    }
  }

  .net-cost-highlight {
    padding: 16rpx 0 24rpx;

    .net-cost-label {
      font-size: 24rpx;
      color: $color-on-surface-variant;
      margin-bottom: 6rpx;
      display: block;
    }

    .net-cost-value {
      display: flex;
      align-items: baseline;
      gap: 6rpx;

      .currency-symbol {
        font-size: 36rpx;
        font-weight: 700;
        color: $color-on-surface;
      }

      .cost-number {
        font-size: 60rpx;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: $color-on-surface;
      }
    }
  }

  .finance-telemetry-grid {
    display: flex;
    align-items: center;
    background-color: #ffffff;
    border-radius: $radius-md;
    padding: 20rpx 24rpx;
    border: 1rpx solid rgba(218, 226, 253, 0.7);

    .finance-col {
      flex: 1;
      display: flex;
      flex-direction: column;

      .col-title {
        font-size: 22rpx;
        color: $color-on-surface-variant;
        margin-bottom: 6rpx;
      }

      .col-value {
        font-size: 32rpx;
        font-weight: 700;

        &.text-expense {
          color: $color-primary;
        }

        &.text-allowance {
          color: $color-secondary;
        }
      }
    }

    .finance-divider {
      width: 1rpx;
      height: 52rpx;
      background-color: rgba(218, 226, 253, 0.8);
      margin: 0 20rpx;
    }
  }
}

/* 分类水平滚动筛选 */
.category-scroll-container {
  margin: 10rpx 0 16rpx;

  .category-scroll {
    width: 100%;
    white-space: nowrap;

    .category-pills {
      display: inline-flex;
      padding: 0 24rpx;
      gap: 12rpx;

      .category-pill {
        display: inline-block;
        padding: 10rpx 24rpx;
        background-color: $color-surface-container-high;
        border-radius: $radius-full;
        font-size: 24rpx;
        color: $color-on-surface-variant;
        font-weight: 500;
        transition: all 0.2s ease;

        &.active {
          background-color: $color-primary;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 4rpx 12rpx rgba(185, 5, 56, 0.25);
        }
      }
    }
  }
}

/* 明细列表 */
.list-card {
  .list-header {
    align-items: flex-start;
    margin-bottom: 20rpx;

    .add-entry-btn {
      margin: 0 !important;
      border-radius: $radius-full !important;
      font-size: 24rpx !important;
      padding: 4rpx 24rpx !important;
    }
  }

  .empty-hint {
    padding: 40rpx 0;
    text-align: center;
  }

  .entry-item {
    padding: 20rpx 0;
    border-top: 1rpx solid rgba(218, 226, 253, 0.6);

    .entry-main {
      align-items: flex-start;

      .entry-left {
        flex: 1;

        .entry-title {
          font-size: 28rpx;
          font-weight: 600;
          color: $color-on-surface;
          margin-bottom: 8rpx;
          display: block;
        }

        .entry-tags {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8rpx;
          font-size: 22rpx;
          color: $color-on-surface-variant;

          .tag-separator {
            color: $color-outline;
          }

          .reimbursed-pill {
            display: inline-block;
            padding: 2rpx 10rpx;
            background-color: $color-secondary-container;
            color: $color-on-secondary-container;
            border-radius: $radius-sm;
            font-size: 20rpx;
            font-weight: 600;
          }
        }
      }

      .entry-amount {
        font-size: 32rpx;
        font-weight: 700;
        font-family: -apple-system, monospace;

        &.text-expense {
          color: $color-on-surface;
        }

        &.text-allowance {
          color: $color-secondary;
        }
      }
    }

    .actions-row {
      display: flex;
      justify-content: flex-end;
      gap: 24rpx;
      margin-top: 10rpx;

      .action-link {
        font-size: 24rpx;
        color: $color-primary;

        &.danger {
          color: $color-outline;
        }
      }
    }
  }

  .export-btn {
    width: 100%;
    margin-top: 24rpx;
    background-color: $color-surface-container-low !important;
    color: $color-on-surface !important;
    border: 1rpx solid rgba(218, 226, 253, 0.8) !important;
    border-radius: $radius-lg !important;
    padding: 12rpx 0 !important;
  }
}

/* 表单卡片 */
.form-card {
  border: 1rpx solid rgba(185, 5, 56, 0.2);

  .form-header {
    margin-bottom: 24rpx;

    .close-btn {
      font-size: 26rpx;
      color: $color-on-surface-variant;
    }
  }

  .input {
    width: 100%;
    height: 80rpx;
    min-height: 80rpx;
    line-height: 80rpx;
    padding: 0 24rpx;
    margin-bottom: 20rpx;
    background-color: $color-surface-container-low;
    border: 1rpx solid rgba(218, 226, 253, 0.8);
    border-radius: $radius-md;
    box-sizing: border-box;
    font-size: 28rpx;
    color: $color-on-surface;
  }

  .inline-input {
    width: 240rpx;
    height: 64rpx;
    min-height: 64rpx;
    line-height: 64rpx;
    text-align: right;
    padding: 0 16rpx;
    background-color: $color-surface-container-low;
    border: 1rpx solid rgba(218, 226, 253, 0.8);
    border-radius: $radius-sm;
    box-sizing: border-box;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    border-bottom: 1rpx solid rgba(218, 226, 253, 0.6);
    font-size: 28rpx;
    color: $color-on-surface;
  }

  .picker-value {
    color: $color-primary;
    font-weight: 600;
  }

  .submit-btn {
    margin-top: 30rpx;
    width: 100%;
  }
}
</style>
