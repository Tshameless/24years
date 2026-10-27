<script setup lang="ts">
import { computed } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import VitalTrends from './VitalTrends.vue';
import { assessVital } from '@/domain/vitalTrends';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';

import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Vital = Extract<PregnancyRecord, { type: 'vital' }>;
const {
  records,
  outcome,
  careDisabled: disabled,
  careMinDate,
  careMaxDate,
  canEditCareRecord,
  message,
  error,
  reportError,
  saveCare: save,
  removeCare: remove,
} = usePregnancyRecords();
const labels = { weight: '体重（kg）', bloodPressure: '血压（mmHg）', glucose: '血糖（mmol/L）' };
const glucoseContexts = ['空腹', '餐后1小时', '餐后2小时', '随机', '其他'];

function assessItem(item: Vital) {
  return assessVital(item.metric, item.value, item.secondary, item.context, {
    postpartum: outcome.value?.kind === 'birth' && item.date >= outcome.value.date,
  });
}

const entries = computed(() =>
  records.value
    .filter((item): item is Vital => item.type === 'vital')
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'vital',
  optionalFields: ['time', 'context'],
  defaults: () => ({
    date: localDate(),
    time: '',
    context: '',
    metric: 'weight' as Vital['metric'],
    value: '',
    secondary: '',
    notes: '',
  }),
  fields: (item: Vital) => ({
    date: item.date,
    time: item.time ?? '',
    context: item.context ?? '',
    metric: item.metric,
    value: String(item.value),
    secondary: item.secondary === null ? '' : String(item.secondary),
    notes: item.notes,
  }),
});
const standardGlucoseContext = computed(() => glucoseContexts.includes(form.context));

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  reportError('');

  const value: Vital = {
    id: before.value?.id ?? draft.id.value,
    type: 'vital',
    date: form.date,
    ...(form.time ? { time: form.time } : {}),
    ...(form.context.trim() ? { context: form.context.trim() } : {}),
    metric: form.metric,
    value: Number(form.value),
    secondary: form.metric === 'bloodPressure' ? Number(form.secondary) : null,
    notes: form.notes.trim(),
  };

  if (!validPregnancyRecord(value) || value.date > localDate()) {
    reportError('请填写不晚于今天的测量日期和有效测量数值。');

    return;
  }

  if (form.metric === 'glucose' && !form.context.trim()) {
    reportError('请选择血糖测量场景。');

    return;
  }

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset();
  }
}
</script>

<template>
  <VitalTrends />
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>体征历史</h2>
        <span class="tag">{{ entries.length }} 条</span>
      </div>
      <p class="muted">保留测量值与常规参考区间供就医时核对，不替代临床诊断。</p>
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
            <div class="vital-value-group">
              <span class="numbers">
                {{ item.value }}{{ item.secondary === null ? '' : ` / ${item.secondary}` }}
              </span>
              <span
                class="tag"
                :class="`vital-badge-${assessItem(item).level}`"
              >
                {{ assessItem(item).badge }}
              </span>
            </div>
          </div>
          <p class="muted">{{ item.date }} · {{ item.time || '时间未记录' }}</p>
          <p
            v-if="assessItem(item).level === 'warning'"
            class="vital-warning-tip"
          >
            ⚠️ {{ assessItem(item).tip }}
          </p>
          <p
            v-if="item.context"
            class="record-notes"
          >
            测量场景：{{ item.context }}
          </p>
          <p
            v-if="item.notes"
            class="record-notes"
          >
            {{ item.notes }}
          </p>
          <div class="record-actions">
            <button
              class="text-button"
              :disabled="disabled || !canEditCareRecord(item)"
              @click="edit(item)"
            >
              编辑
            </button>
            <button
              class="text-button"
              :disabled="disabled || !canEditCareRecord(item)"
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
        <FormDraftNotice
          :dirty="draft.dirty.value"
          :restored="draft.restored.value"
          :error="draft.storageError.value"
          :blocked="stale"
          @discard="cancel"
        />
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
              :min="careMinDate"
              :max="careMaxDate"
            />
          </label>
          <label class="field">
            测量时间（可选）
            <input
              v-model="form.time"
              type="time"
            />
          </label>
          <label class="field">
            {{ form.metric === 'glucose' ? '血糖测量场景' : '测量场景（可选）' }}
            <select
              v-if="form.metric === 'glucose'"
              v-model="form.context"
            >
              <option value="">请选择</option>
              <option
                v-for="context in glucoseContexts"
                :key="context"
                :value="context"
              >
                {{ context }}
              </option>
              <option
                v-if="form.context && !standardGlucoseContext"
                :value="form.context"
              >
                原记录：{{ form.context }}
              </option>
            </select>
            <input
              v-else
              v-model="form.context"
              maxlength="80"
              placeholder="按实际情况填写，例如晨起、休息后"
            />
          </label>
          <p class="muted">日期和时间按测量时当地时间填写；不确定时间可留空。</p>
          <label class="field">
            {{ form.metric === 'bloodPressure' ? '收缩压（mmHg）' : labels[form.metric] }}
            <input
              :value="form.value"
              type="number"
              min="0.01"
              :max="form.metric === 'weight' ? 1000 : form.metric === 'glucose' ? 100 : 400"
              step="any"
              required
              @input="form.value = ($event.target as HTMLInputElement).value"
            />
          </label>
          <label
            v-if="form.metric === 'bloodPressure'"
            class="field"
          >
            舒张压（mmHg）
            <input
              :value="form.secondary"
              type="number"
              min="0.01"
              max="400"
              step="any"
              required
              @input="form.secondary = ($event.target as HTMLInputElement).value"
            />
          </label>
          <label class="field">
            测量备注
            <textarea
              v-model="form.notes"
              rows="3"
              maxlength="2000"
              placeholder="其他需要保留的测量说明"
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

<style scoped>
.vital-value-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vital-badge-warning {
  background: var(--pink-light);
  color: var(--primary);
  border-color: var(--primary);
  font-weight: 600;
}

.vital-badge-attention {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}

.vital-warning-tip {
  margin: 6px 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--primary);
  background: var(--pink-light);
  padding: 6px 10px;
  border-radius: 4px;
}
</style>
