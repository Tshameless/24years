<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { checkupTemplates } from '@/domain/preparationTemplates';
import { isDate, localDate, parseMoney, type PregnancyRecord, type Expense } from '@/domain/family';

import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Checkup = Extract<PregnancyRecord, { type: 'checkup' }>;
const { records, disabled, message, error, reportError, save, remove, hasExpense } =
  usePregnancyRecords();
const checkups = computed(() =>
  records.value
    .filter((item): item is Checkup => item.type === 'checkup')
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.date.localeCompare(b.date)),
);

const template = shallowRef('');

function applyTemplate() {
  const selected = checkupTemplates[Number(template.value)];

  if (template.value === '' || !selected || disabled.value || before.value || stale.value) {
    return;
  }

  if (
    (form.title.trim() !== '' || form.notes.trim() !== '') &&
    !window.confirm('用模板替换产检名称和备注？')
  ) {
    return;
  }

  Object.assign(form, selected);
}

const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'checkup',
  defaults: () => ({
    title: '',
    date: localDate(),
    notes: '',
    completed: false,
    amount: '',
    reimbursed: '0',
  }),
  fields: (item: Checkup) => ({
    title: item.title,
    date: item.date,
    notes: item.notes,
    completed: item.completed,
    amount: '',
    reimbursed: '0',
  }),
});
const linkedExpense = computed(() => !!before.value && hasExpense('checkup-' + before.value.id));
const canRecordExpense = computed(
  () => !!before.value && !before.value.completed && form.completed && !linkedExpense.value,
);

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  reportError('');

  if (!form.title.trim() || !isDate(form.date)) {
    reportError('请填写产检名称和有效日期。');

    return;
  }

  const value: Checkup = {
    id: before.value?.id ?? draft.id.value,
    type: 'checkup',
    title: form.title.trim(),
    date: form.date,
    notes: form.notes.trim(),
    completed: form.completed,
  };
  let expense: Expense | undefined;

  if (canRecordExpense.value && !form.amount.trim() && parseMoney(form.reimbursed) !== 0) {
    reportError('填写报销金额时，请同时填写本次费用。');

    return;
  }

  if (canRecordExpense.value && form.amount.trim()) {
    const amount = parseMoney(form.amount);
    const reimbursed = parseMoney(form.reimbursed);

    if (
      amount === null ||
      reimbursed === null ||
      reimbursed > amount ||
      (amount === 0 && reimbursed !== 0)
    ) {
      reportError('费用最多两位小数，报销不能超过总额。');

      return;
    }

    if (amount > 0) {
      expense = {
        id: `checkup-${value.id}`,
        title: value.title,
        date: value.date,
        kind: 'expense',
        category: '产检医疗',
        amountCents: amount,
        reimbursedCents: reimbursed,
      };
    }
  }

  if (
    await save({ type: 'pregnancy', before: before.value, value, ...(expense ? { expense } : {}) })
  ) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>产检安排</h2>
        <span class="tag">{{ checkups.length }} 次记录</span>
      </div>
      <p
        v-if="!checkups.length"
        class="empty-state"
      >
        还没有产检安排。按照医生的建议，记下下一次见面的时间。
      </p>
      <ul
        v-else
        class="record-list"
      >
        <li
          v-for="item in checkups"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>{{ item.title }}</strong>
            <span class="tag">{{ item.completed ? '已完成' : '待产检' }}</span>
          </div>
          <p class="muted">{{ item.date }}</p>
          <p
            v-if="item.notes"
            class="record-notes"
          >
            {{ item.notes }}
          </p>
          <div class="record-actions">
            <button
              class="text-button"
              :disabled="disabled"
              @click="edit(item)"
            >
              {{ item.completed ? '编辑记录' : '编辑 / 完成' }}
            </button>
            <button
              class="text-button"
              :disabled="disabled"
              @click="remove(item)"
            >
              删除
            </button>
          </div>
        </li>
      </ul>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑产检' : '添加产检' }}</h2>
      </div>
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
          :disabled="disabled || !!stale"
          class="record-fields"
        >
          <div
            v-if="!before"
            class="field"
          >
            <label for="checkup-template">就诊准备模板</label>
            <select
              id="checkup-template"
              v-model="template"
            >
              <option value="">请选择模板</option>
              <option
                v-for="(item, index) in checkupTemplates"
                :key="item.title"
                :value="String(index)"
              >
                {{ item.title }}
              </option>
            </select>
            <button
              type="button"
              class="button button-secondary"
              :disabled="template === ''"
              @click="applyTemplate"
            >
              填入就诊模板
            </button>
            <small>整理用途，不是标准产检排程；日期、项目与准备要求请向医院确认。</small>
          </div>
          <label class="field">
            产检名称
            <input
              v-model="form.title"
              required
              maxlength="80"
              placeholder="例如：常规产检"
            />
          </label>
          <label class="field">
            产检日期
            <input
              v-model="form.date"
              required
              type="date"
            />
          </label>
          <label class="field">
            产检备注
            <textarea
              v-model="form.notes"
              maxlength="2000"
              rows="4"
              placeholder="检查项目、医生建议或要问的问题"
            />
          </label>
          <label
            v-if="before && !before.completed"
            class="check-option"
          >
            <input
              v-model="form.completed"
              type="checkbox"
            />
            本次产检已完成
          </label>
          <template v-if="canRecordExpense">
            <label class="field">
              本次费用（元，可留空）
              <input
                v-model="form.amount"
                inputmode="decimal"
                maxlength="11"
                placeholder="留空或填 0 不新增账目"
              />
            </label>
            <label class="field">
              本次已报销（元）
              <input
                v-model="form.reimbursed"
                inputmode="decimal"
                maxlength="11"
              />
            </label>
            <p class="muted">费用与完成状态一起保存到家庭账本。之后可在账本中编辑费用。</p>
          </template>
          <p
            v-if="linkedExpense"
            class="muted"
          >
            已有关联账目，金额请在家庭账本修改。删除产检记录不会删除账目。
          </p>
          <button class="button button-primary">
            {{ before ? '保存产检修改' : '保存产检安排' }}
          </button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          这条产检已变化。输入仍保留，请取消后重新编辑最新记录。
        </p>
        <button
          v-if="before"
          type="button"
          class="button button-secondary"
          :disabled="disabled"
          @click="cancel"
        >
          取消编辑
        </button>
      </form>
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
  </div>
</template>
