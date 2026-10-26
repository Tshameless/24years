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
      <div
        v-else
        class="trend-table-wrap"
      >
        <table class="trend-table">
          <caption>历次超声测量值对照</caption>
          <thead>
            <tr>
              <th scope="col">检查日期</th>
              <th scope="col">孕周</th>
              <th scope="col">BPD (mm)</th>
              <th scope="col">FL (mm)</th>
              <th scope="col">AC (mm)</th>
              <th scope="col">HC (mm)</th>
              <th scope="col">AFI (cm)</th>
              <th scope="col">脐动脉 S/D</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in entries"
              :key="item.id"
            >
              <th scope="row">{{ item.date }}</th>
              <td>{{ item.gestationWeeks }}</td>
              <td>{{ item.bpd ?? '—' }}</td>
              <td>{{ item.fl ?? '—' }}</td>
              <td>{{ item.ac ?? '—' }}</td>
              <td>{{ item.hc ?? '—' }}</td>
              <td>{{ item.afi ?? '—' }}</td>
              <td>{{ item.umbilicalSd ?? '—' }}</td>
              <td class="row-actions">
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="entries.some((item) => item.notes)"
        class="muted trend-note"
      >
        备注已随 CSV 导出；请结合原始报告和医护人员解释查看。
      </p>
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

.trend-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.trend-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 13px;
}

.trend-table caption {
  padding: 10px 0;
  color: var(--text-secondary);
  text-align: left;
}

.trend-table th,
.trend-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

.trend-table thead th {
  color: var(--text-secondary);
  font-weight: 500;
}

.row-actions {
  display: flex;
  gap: 8px;
}

.trend-note {
  margin: 10px 0 0;
}

@media (max-width: 480px) {
  .heading-actions {
    justify-content: flex-end;
  }
}
</style>
