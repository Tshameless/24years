<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { localDate, type PregnancyRecord } from '@/domain/family';

type Vital = Extract<PregnancyRecord, { type: 'vital' }>;
const { records, disabled, message, error, save, remove } = usePregnancyRecords();
const labels = { weight: '体重（kg）', bloodPressure: '血压（mmHg）', glucose: '血糖（mmol/L）' };
const entries = computed(() =>
  records.value
    .filter((item): item is Vital => item.type === 'vital')
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const before = shallowRef<Vital | null>(null);
let draftId = crypto.randomUUID();
const form = reactive({
  date: localDate(),
  metric: 'weight' as Vital['metric'],
  value: '',
  secondary: '',
  notes: '',
});
const stale = computed(
  () =>
    before.value &&
    JSON.stringify(records.value.find((item) => item.id === before.value?.id)) !==
      JSON.stringify(before.value),
);

function reset() {
  before.value = null;
  draftId = crypto.randomUUID();
  Object.assign(form, { date: localDate(), value: '', secondary: '', notes: '' });
}

function edit(item: Vital) {
  before.value = { ...item };
  Object.assign(form, {
    ...item,
    value: String(item.value),
    secondary: item.secondary === null ? '' : String(item.secondary),
  });
  message.value = '';
  error.value = '';
}

async function submit() {
  const value: Vital = {
    id: before.value?.id ?? draftId,
    type: 'vital',
    date: form.date,
    metric: form.metric,
    value: Number(form.value),
    secondary: form.metric === 'bloodPressure' ? Number(form.secondary) : null,
    notes: form.notes.trim(),
  };

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>体征历史</h2>
        <span class="tag">{{ entries.length }} 条</span>
      </div>
      <p class="muted">保留测量值供就医时参考，不提供诊断或正常范围判断。</p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        从一次测量开始，慢慢积累自己的记录。
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
            <strong>{{ labels[item.metric] }}</strong>
            <span class="numbers">
              {{ item.value }}{{ item.secondary === null ? '' : ` / ${item.secondary}` }}
            </span>
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
        <h2>{{ before ? '编辑体征' : '添加体征' }}</h2>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <fieldset
          class="record-fields"
          :disabled="disabled || !!stale"
        >
          <label class="field">
            记录项目
            <select v-model="form.metric">
              <option
                v-for="(label, key) in labels"
                :key="key"
                :value="key"
              >
                {{ label }}
              </option>
            </select>
          </label>
          <label class="field">
            测量日期
            <input
              v-model="form.date"
              type="date"
              required
              :max="localDate()"
            />
          </label>
          <label class="field">
            {{ form.metric === 'bloodPressure' ? '收缩压（mmHg）' : labels[form.metric] }}
            <input
              v-model="form.value"
              type="number"
              min="0.01"
              :max="form.metric === 'weight' ? 1000 : form.metric === 'glucose' ? 100 : 400"
              step="any"
              required
            />
          </label>
          <label
            v-if="form.metric === 'bloodPressure'"
            class="field"
          >
            舒张压（mmHg）
            <input
              v-model="form.secondary"
              type="number"
              min="0.01"
              max="400"
              step="any"
              required
            />
          </label>
          <label class="field">
            测量备注
            <textarea
              v-model="form.notes"
              rows="3"
              maxlength="2000"
              placeholder="例如：空腹、餐后两小时或测量时间"
            />
          </label>
          <button class="button button-primary">{{ before ? '保存体征修改' : '保存体征' }}</button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          记录已变化，请取消后重新编辑。
        </p>
        <button
          v-if="before"
          class="button button-secondary"
          type="button"
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
