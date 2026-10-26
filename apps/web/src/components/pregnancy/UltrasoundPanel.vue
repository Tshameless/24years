<script setup lang="ts">
import { computed } from 'vue';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Ultrasound = Extract<PregnancyRecord, { type: 'ultrasound' }>;
const { records, disabled, error, message, reportError, save, remove } = usePregnancyRecords();
const entries = computed(() =>
  records.value
    .filter((item): item is Ultrasound => item.type === 'ultrasound')
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'ultrasound',
  defaults: () => ({
    date: localDate(),
    gestationWeeks: '20',
    bpd: '',
    fl: '',
    ac: '',
    hc: '',
    afi: '',
    umbilicalSd: '',
    notes: '',
  }),
  fields: (item: Ultrasound) => ({
    date: item.date,
    gestationWeeks: String(item.gestationWeeks),
    bpd: String(item.bpd ?? ''),
    fl: String(item.fl ?? ''),
    ac: String(item.ac ?? ''),
    hc: String(item.hc ?? ''),
    afi: String(item.afi ?? ''),
    umbilicalSd: String(item.umbilicalSd ?? ''),
    notes: item.notes,
  }),
});
function csvCell(value: string | number | undefined) {
  const text = value === undefined ? '' : String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportCsv() {
  if (!entries.value.length) return;
  const rows = [
    [
      '检查日期',
      '孕周',
      'BPD (mm)',
      'FL (mm)',
      'AC (mm)',
      'HC (mm)',
      'AFI (cm)',
      '脐动脉 S/D',
      '备注',
    ],
    ...entries.value.map((item) => [
      item.date,
      item.gestationWeeks,
      item.bpd,
      item.fl,
      item.ac,
      item.hc,
      item.afi,
      item.umbilicalSd,
      item.notes,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '24years-ultrasound-records.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function optional(value: string) {
  return value.trim() ? Number(value) : undefined;
}
async function submit() {
  reportError('');
  const value: Ultrasound = {
    id: before.value?.id ?? draft.id.value,
    type: 'ultrasound',
    date: form.date,
    gestationWeeks: Number(form.gestationWeeks),
    ...Object.fromEntries(
      Object.entries({
        bpd: optional(form.bpd),
        fl: optional(form.fl),
        ac: optional(form.ac),
        hc: optional(form.hc),
        afi: optional(form.afi),
        umbilicalSd: optional(form.umbilicalSd),
      }).filter(([, v]) => v !== undefined),
    ),
    notes: form.notes.trim(),
  } as Ultrasound;
  if (disabled.value || stale.value || !validPregnancyRecord(value) || value.date > localDate()) {
    reportError('请填写有效日期、孕周和数值。');
    return;
  }
  if (await save({ type: 'pregnancy', before: before.value, value })) reset();
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>超声与胎儿指标</h2>
        <div class="heading-actions">
          <span class="tag">{{ entries.length }} 次</span>
          <button
            class="text-button"
            type="button"
            :disabled="!entries.length"
            @click="exportCsv"
          >
            导出 CSV
          </button>
        </div>
      </div>
      <p class="muted">保存报告中的结构化数值，方便复诊时查看趋势；不自动解读或诊断。</p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        还没有超声指标记录。
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
            <strong>{{ item.date }} · {{ item.gestationWeeks }} 周</strong>
          </div>
          <p class="record-notes">
            BPD {{ item.bpd ?? '—' }} · FL {{ item.fl ?? '—' }} · AC {{ item.ac ?? '—' }} · HC
            {{ item.hc ?? '—' }} · AFI {{ item.afi ?? '—' }} · S/D {{ item.umbilicalSd ?? '—' }}
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
        <h2>{{ before ? '编辑' : '添加' }}超声指标</h2>
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
          <div class="form-row">
            <label class="field">
              检查日期
              <input
                v-model="form.date"
                type="date"
                :max="localDate()"
              />
            </label>
            <label class="field">
              孕周（周）
              <input
                v-model="form.gestationWeeks"
                type="number"
                min="0"
                max="42"
                step="1"
              />
            </label>
          </div>
          <div class="form-row">
            <label class="field">
              BPD（mm）
              <input
                v-model="form.bpd"
                type="number"
                min="0"
                step="any"
              />
            </label>
            <label class="field">
              FL（mm）
              <input
                v-model="form.fl"
                type="number"
                min="0"
                step="any"
              />
            </label>
          </div>
          <div class="form-row">
            <label class="field">
              AC（mm）
              <input
                v-model="form.ac"
                type="number"
                min="0"
                step="any"
              />
            </label>
            <label class="field">
              HC（mm）
              <input
                v-model="form.hc"
                type="number"
                min="0"
                step="any"
              />
            </label>
          </div>
          <div class="form-row">
            <label class="field">
              AFI（cm）
              <input
                v-model="form.afi"
                type="number"
                min="0"
                step="any"
              />
            </label>
            <label class="field">
              脐动脉 S/D
              <input
                v-model="form.umbilicalSd"
                type="number"
                min="0"
                step="any"
              />
            </label>
          </div>
          <label class="field">
            报告备注
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="2000"
              placeholder="报告原文摘要或医生解释"
            ></textarea>
          </label>
          <button class="button button-primary">保存超声指标</button>
        </fieldset>
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
.heading-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .heading-actions {
    justify-content: flex-end;
  }
}
</style>
