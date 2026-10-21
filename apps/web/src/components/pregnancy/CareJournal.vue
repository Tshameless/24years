<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { localDate, parseMoney, type PregnancyRecord, type Expense } from '@/domain/family';
import { packingTemplates } from '@/domain/preparationTemplates';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';

type Entry = Extract<PregnancyRecord, { type: 'bonding' | 'mood' | 'packing' }>;
const props = defineProps<{ kind: Entry['type'] }>();
const labels = { bonding: '陪伴记录', mood: '心情日记', packing: '待产清单' };
const { store, records, disabled, save, remove, error, message } = usePregnancyRecords();
const entries = computed(() =>
  records.value
    .filter((item): item is Entry => item.type === props.kind)
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const before = shallowRef<Entry | null>(null);
let draftId = crypto.randomUUID();
const form = reactive({
  title: props.kind === 'mood' ? '平静' : '',
  date: localDate(),
  minutes: 10,
  notes: '',
  completed: false,
  amount: '',
});
const template = shallowRef('');
const linkedExpense = computed(
  () =>
    before.value &&
    store.data.value.expenses.some((item) => item.id === `packing-${before.value!.id}`),
);

function applyTemplate() {
  const selected = packingTemplates[Number(template.value)];

  if (template.value === '' || !selected || disabled.value || before.value) {
    return;
  }

  if ((form.title || form.notes) && !window.confirm('用模板替换物品名称和备注？')) {
    return;
  }

  Object.assign(form, selected);
}

const stale = computed(
  () =>
    before.value &&
    JSON.stringify(records.value.find((item) => item.id === before.value?.id)) !==
      JSON.stringify(before.value),
);

function reset() {
  before.value = null;
  draftId = crypto.randomUUID();
  Object.assign(form, {
    title: props.kind === 'mood' ? '平静' : '',
    date: localDate(),
    minutes: 10,
    notes: '',
    completed: false,
    amount: '',
  });
}

function edit(item: Entry) {
  before.value = { ...item };
  Object.assign(form, {
    ...item,
    minutes: item.type === 'bonding' ? item.minutes : 10,
    completed: item.type === 'packing' && item.completed,
    amount: '',
  });
}

async function submit() {
  if (stale.value || disabled.value) {
    return;
  }

  error.value = '';
  const base = {
    id: before.value?.id ?? draftId,
    date: form.date,
    title: form.title.trim(),
    notes: form.notes.trim(),
  };
  const value: Entry =
    props.kind === 'bonding'
      ? { ...base, type: 'bonding', minutes: Number(form.minutes) }
      : props.kind === 'packing'
        ? { ...base, type: 'packing', completed: form.completed }
        : { ...base, type: 'mood' };

  let expense: Expense | undefined;

  if (
    value.type === 'packing' &&
    value.completed &&
    before.value?.type === 'packing' &&
    !before.value.completed &&
    !linkedExpense.value &&
    form.amount.trim()
  ) {
    const amount = parseMoney(form.amount);

    if (amount === null) {
      error.value = '采购金额请填写非负数，最多两位小数。';

      return;
    }

    if (amount > 0) {
      expense = {
        id: `packing-${value.id}`,
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
        <h2>{{ labels[kind] }}</h2>
        <span class="tag">{{ entries.length }} 条记录</span>
      </div>
      <p class="muted">启用家庭同步后，所有家庭成员都能看到这些记录。请只填写愿意共享的内容。</p>
      <p
        v-if="kind === 'mood'"
        class="muted"
      >
        记录自己的感受，不进行心理评分或诊断。
      </p>
      <p
        v-if="kind === 'packing'"
        class="muted"
      >
        按医院要求整理物品。先保存待准备物品，再编辑并勾选备齐时可填写采购金额，一次保存同时入账；不填写金额不记账。记录日期也是支出日期，请核对。
      </p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        还没有记录，按自己的节奏开始即可。
      </p>
      <ul
        v-else
        class="record-list"
      >
        <li
          v-for="item in entries"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>{{ item.title }}</strong>
            <span
              v-if="item.type === 'bonding'"
              class="tag"
            >
              {{ item.minutes }} 分钟
            </span>
            <span
              v-if="item.type === 'packing'"
              class="tag"
            >
              {{ item.completed ? '已备齐' : '待准备' }}
            </span>
          </div>
          <p class="muted">{{ item.date }}</p>
          <p class="record-notes">{{ item.notes }}</p>
          <div class="record-actions">
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
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑' : '添加' }}{{ labels[kind] }}</h2>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <fieldset
          class="record-fields"
          :disabled="disabled || !!stale"
        >
          <div
            v-if="kind === 'packing' && !before"
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
          <label
            v-if="kind === 'mood'"
            class="field"
          >
            此刻心情
            <select v-model="form.title">
              <option
                v-for="mood in ['愉悦', '平静', '烦躁', '低落', '疲惫']"
                :key="mood"
              >
                {{ mood }}
              </option>
            </select>
          </label>
          <label
            v-else
            class="field"
          >
            {{ kind === 'packing' ? '物品名称' : '陪伴内容' }}
            <input
              v-model="form.title"
              required
              maxlength="80"
            />
          </label>
          <label class="field">
            记录日期
            <input
              v-model="form.date"
              required
              type="date"
              :max="localDate()"
            />
          </label>
          <label
            v-if="kind === 'bonding'"
            class="field"
          >
            陪伴时长（分钟）
            <input
              v-model="form.minutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              required
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
          <label
            v-if="kind === 'packing'"
            class="check-option"
          >
            <input
              v-model="form.completed"
              type="checkbox"
            />
            已经备齐
          </label>
          <label
            v-if="
              kind === 'packing' &&
              before?.type === 'packing' &&
              !before.completed &&
              form.completed &&
              !linkedExpense
            "
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
            v-if="kind === 'packing' && linkedExpense"
            class="muted"
          >
            已有关联账目，金额请在家庭账本修改。删除物品不会删除账目。
          </p>
          <button class="button button-primary">保存{{ labels[kind] }}</button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          记录已变化，输入仍保留，请取消后重新编辑最新记录。
        </p>
        <button
          v-if="before"
          type="button"
          class="button button-secondary"
          :disabled="disabled"
          @click="reset"
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
