<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import {
  localDate,
  parseMoney,
  validPregnancyRecord,
  type PregnancyRecord,
  type Expense,
} from '@/domain/family';
import { packingTemplates } from '@/domain/preparationTemplates';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Packing = Extract<PregnancyRecord, { type: 'packing' }>;
const { records, disabled, save, remove, error, reportError, message, hasExpense } =
  usePregnancyRecords();
const entries = computed(() =>
  records.value
    .filter((item): item is Packing => item.type === 'packing')
    .sort((a, b) => Number(a.completed) - Number(b.completed) || b.date.localeCompare(a.date)),
);
const categoryFilter = shallowRef('all');
const assigneeFilter = shallowRef('all');
const statusFilter = shallowRef<'all' | 'pending' | 'completed'>('all');
const visibleEntries = computed(() =>
  entries.value.filter(
    (item) =>
      (categoryFilter.value === 'all' || (item.category ?? '未分类') === categoryFilter.value) &&
      (assigneeFilter.value === 'all' || (item.assignee ?? 'unassigned') === assigneeFilter.value) &&
      (statusFilter.value === 'all' ||
        (statusFilter.value === 'completed' ? item.completed : !item.completed)),
  ),
);
const categories = computed(() =>
  Array.from(new Set(entries.value.map((item) => item.category || '未分类'))).sort(),
);
const completedCount = computed(() => entries.value.filter((item) => item.completed).length);
const labels = { mother: '妈妈', father: '爸爸', single_parent: '本人' };
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'packing',
  defaults: () => ({
    title: '',
    date: localDate(),
    notes: '',
    completed: false,
    amount: '',
    category: '',
    quantity: '',
    assignee: '',
  }),
  fields: (item: Packing) => ({
    title: item.title,
    date: item.date,
    notes: item.notes,
    completed: item.completed,
    amount: '',
    category: item.category ?? '',
    quantity: item.quantity === undefined ? '' : String(item.quantity),
    assignee: item.assignee ?? '',
  }),
});
const template = shallowRef('');
const linkedExpense = computed(() => !!before.value && hasExpense('packing-' + before.value.id));
const canRecordExpense = computed(
  () =>
    form.completed &&
    !linkedExpense.value &&
    (!before.value || !before.value.completed),
);

function applyTemplate() {
  const selected = packingTemplates[Number(template.value)];

  if (template.value === '' || !selected || disabled.value || before.value || stale.value) {
    return;
  }

  if (draft.dirty.value && !window.confirm('用模板替换物品名称和备注？分类、数量和负责人保留。')) {
    return;
  }

  Object.assign(form, selected);
}

async function toggleCompleted(item: Packing) {
  if (disabled.value) {
    return;
  }

  await save({
    type: 'pregnancy',
    before: item,
    value: { ...item, completed: !item.completed },
  });
}

async function submit() {
  if (stale.value || disabled.value) {
    return;
  }

  reportError('');
  const value: Packing = {
    id: before.value?.id ?? draft.id.value,
    type: 'packing',
    title: form.title.trim(),
    date: form.date,
    notes: form.notes.trim(),
    completed: form.completed,
    ...(form.category.trim() ? { category: form.category.trim() } : {}),
    ...(String(form.quantity).trim() ? { quantity: Number(form.quantity) } : {}),
    ...(form.assignee ? { assignee: form.assignee as Packing['assignee'] } : {}),
  };

  if (!validPregnancyRecord(value)) {
    reportError('请检查物品名称、日期、分类和负责人；数量需为 1–9999 的整数。');

    return;
  }

  let expense: Expense | undefined;

  if (canRecordExpense.value && form.amount.trim()) {
    const amount = parseMoney(form.amount);

    if (amount === null) {
      reportError('采购金额请填写非负数，最多两位小数。');

      return;
    }

    if (amount > 0) {
      expense = {
        id: 'packing-' + value.id,
        title: value.title,
        date: value.date,
        kind: 'expense',
        category: '待产准备',
        amountCents: amount,
        reimbursedCents: 0,
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
        <h2>待产清单</h2>
        <span class="tag">已备齐 {{ completedCount }} / {{ entries.length }}</span>
      </div>
      <div
        v-if="entries.length"
        class="packing-progress"
      >
        <progress
          :value="completedCount"
          :max="entries.length"
        />
        <small>{{ Math.round((completedCount / entries.length) * 100) }}% 已备齐</small>
      </div>
      <div class="packing-filters">
        <label class="field">
          分类
          <select v-model="categoryFilter">
            <option value="all">全部分类</option>
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>
        <label class="field">
          负责人
          <select v-model="assigneeFilter">
            <option value="all">全部负责人</option>
            <option value="mother">妈妈</option>
            <option value="father">爸爸</option>
            <option value="single_parent">本人</option>
            <option value="unassigned">未指派</option>
          </select>
        </label>
        <label class="field">
          状态
          <select v-model="statusFilter">
            <option value="all">全部状态</option>
            <option value="pending">待准备</option>
            <option value="completed">已备齐</option>
          </select>
        </label>
      </div>
      <p class="muted">
        启用家庭同步后，所有家庭成员都能看到这些记录。负责人仅作分工，不改变编辑权限。
      </p>
      <p class="muted">
        按医院要求整理物品。先保存待准备物品，再编辑并勾选备齐时可填写采购金额，一次保存同时入账；不填写金额不记账。记录日期也是支出日期，请核对。
      </p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        还没有记录，按自己的节奏开始即可。
      </p>
      <ul
        v-else-if="visibleEntries.length"
        class="record-list"
      >
        <li
          v-for="item in visibleEntries"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>{{ item.title }}</strong>
            <span class="tag">{{ item.completed ? '已备齐' : '待准备' }}</span>
          </div>
          <p class="muted">
            {{ item.date }} · {{ item.category || '未分类' }} · 数量：{{
              item.quantity ?? '未填写'
            }}
            · 负责人：{{ item.assignee ? labels[item.assignee] : '未指派' }}
          </p>
          <p class="record-notes">{{ item.notes }}</p>
          <div class="record-actions">
            <button
              class="text-button"
              :disabled="disabled"
              @click="toggleCompleted(item)"
            >
              {{ item.completed ? '标为待准备' : '标为已备齐' }}
            </button>
            <button
              class="text-button"
              :disabled="disabled"
              @click="edit(item)"
            >
              编辑
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
      <p
        v-else
        class="empty-state"
      >
        当前筛选条件下没有清单项。
      </p>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑' : '添加' }}待产清单</h2>
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
          class="record-fields"
          :disabled="disabled || stale"
        >
          <div
            v-if="!before"
            class="field"
          >
            <label for="packing-template">待产准备模板</label>
            <select
              id="packing-template"
              v-model="template"
            >
              <option value="">请选择模板</option>
              <option
                v-for="(item, index) in packingTemplates"
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
              填入待产模板
            </button>
            <small>仅作整理参考，并非医院官方清单；按实际需要修改后保存。</small>
          </div>
          <label class="field">
            物品名称
            <input
              v-model="form.title"
              required
              maxlength="80"
            />
          </label>
          <label class="field">
            物品分类（可选）
            <input
              v-model="form.category"
              maxlength="30"
              placeholder="例如：证件资料、妈妈用品、宝宝用品"
            />
          </label>
          <label class="field">
            物品数量（可选）
            <input
              v-model="form.quantity"
              inputmode="numeric"
              pattern="[0-9]+"
              maxlength="4"
            />
          </label>
          <div class="field">
            <label for="packing-assignee">负责人</label>
            <select
              id="packing-assignee"
              v-model="form.assignee"
            >
              <option value="">未指派</option>
              <option
                v-for="(label, key) in labels"
                :key="key"
                :value="key"
              >
                {{ label }}
              </option>
            </select>
          </div>
          <label class="field">
            记录日期
            <input
              v-model="form.date"
              required
              type="date"
              :max="localDate()"
            />
          </label>
          <label class="field">
            记录备注
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="2000"
            />
          </label>
          <label class="check-option">
            <input
              v-model="form.completed"
              type="checkbox"
            />
            已经备齐
          </label>
          <label
            v-if="canRecordExpense"
            class="field"
          >
            采购金额（元，可留空）
            <input
              v-model="form.amount"
              inputmode="decimal"
              maxlength="11"
              placeholder="留空或填 0 不新增账目"
            />
          </label>
          <p
            v-if="linkedExpense"
            class="muted"
          >
            已有关联账目，金额请在家庭账本修改。删除物品不会删除账目。
          </p>
          <button class="button button-primary">保存待产清单</button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          记录已变化，输入仍保留，请清除草稿后重新编辑最新记录。
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
