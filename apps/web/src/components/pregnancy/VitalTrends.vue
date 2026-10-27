<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { selectVitals, vitalPlot, vitalLabels, type Vital } from '@/domain/vitalTrends';

const { data } = useFamily();
const metric = shallowRef<Vital['metric']>('weight');
const glucoseContext = shallowRef('all');
const from = shallowRef('');
const to = shallowRef('');
const invalid = computed(() => !!from.value && !!to.value && from.value > to.value);
const baseEntries = computed(() =>
  invalid.value
    ? []
    : selectVitals(data.value.pregnancyRecords ?? [], metric.value, from.value, to.value),
);

function matchesGlucoseContext(context: string | undefined, group: string) {
  if (group === 'fasting') {
    return context?.includes('空腹') ?? false;
  }

  if (group === 'after1') {
    return context?.includes('餐后1小时') ?? false;
  }

  if (group === 'after2') {
    return context?.includes('餐后2小时') ?? false;
  }

  if (group === 'random') {
    return context?.includes('随机') ?? false;
  }

  if (group === 'other') {
    return context === '其他';
  }

  if (group === 'unclassified') {
    return (
      !context ||
      !['空腹', '餐后1小时', '餐后2小时', '随机', '其他'].some((item) => context.includes(item))
    );
  }

  return true;
}

const entries = computed(() =>
  metric.value !== 'glucose' || glucoseContext.value === 'all'
    ? baseEntries.value
    : baseEntries.value.filter((item) => matchesGlucoseContext(item.context, glucoseContext.value)),
);
const glucoseSummary = computed(() => {
  if (metric.value !== 'glucose') {
    return null;
  }

  const fasting = baseEntries.value.filter((item) =>
    matchesGlucoseContext(item.context, 'fasting'),
  );
  const after1 = baseEntries.value.filter((item) => matchesGlucoseContext(item.context, 'after1'));
  const after2 = baseEntries.value.filter((item) => matchesGlucoseContext(item.context, 'after2'));
  const average = (items: typeof entries.value) =>
    items.length
      ? (items.reduce((sum, item) => sum + item.value, 0) / items.length).toFixed(1)
      : '—';

  return {
    fasting,
    fastingAverage: average(fasting),
    after1Average: average(after1),
    after2Average: average(after2),
  };
});

function csvCell(value: string | number | undefined) {
  const text = value === undefined ? '' : String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

function exportGlucoseCsv() {
  if (metric.value !== 'glucose' || !entries.value.length || invalid.value) {
    return;
  }

  const rows = [
    ['日期', '时间', '测量场景', '血糖 (mmol/L)', '备注'],
    ...entries.value.map((item) => [item.date, item.time, item.context, item.value, item.notes]),
  ];
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '24years-glucose-records.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const plot = computed(() => vitalPlot(entries.value));
const primary = computed(
  () => plot.value?.points.map((point) => `${point.x},${point.y}`).join(' ') ?? '',
);
const secondary = computed(
  () =>
    plot.value?.points
      .filter((point) => point.y2 !== null)
      .map((point) => `${point.x},${point.y2}`)
      .join(' ') ?? '',
);

const alertY = computed(() => {
  if (metric.value !== 'bloodPressure' || !plot.value) {
    return null;
  }

  return guidelineY(140);
});
const diastolicAlertY = computed(() =>
  metric.value === 'bloodPressure' && plot.value ? guidelineY(90) : null,
);
function guidelineY(value: number) {
  if (!plot.value || value < plot.value.low || value > plot.value.high) {
    return null;
  }

  return 160 - ((value - plot.value.low) / (plot.value.high - plot.value.low)) * 130;
}
</script>

<template>
  <section
    class="panel vital-trends"
    aria-label="体征趋势"
  >
    <h2>体征趋势</h2>
    <div class="trend-filters">
      <label class="field">
        趋势指标
        <select v-model="metric">
          <option
            v-for="(label, key) in vitalLabels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </label>
      <label
        v-if="metric === 'glucose'"
        class="field"
      >
        血糖场景
        <select v-model="glucoseContext">
          <option value="all">全部场景</option>
          <option value="fasting">空腹</option>
          <option value="after1">餐后 1 小时</option>
          <option value="after2">餐后 2 小时</option>
          <option value="random">随机</option>
          <option value="other">其他</option>
          <option value="unclassified">未分类历史记录</option>
        </select>
      </label>
      <label class="field">
        起始日期
        <input
          v-model="from"
          type="date"
        />
      </label>
      <label class="field">
        截止日期
        <input
          v-model="to"
          type="date"
        />
      </label>
    </div>
    <p class="muted">
      只展示已保存的原始测量值，不作诊断。填写测量时间后，同日记录会按时间展开；未记录时间按当天起点绘制。血糖趋势可按测量场景筛选。
    </p>
    <div
      v-if="glucoseSummary"
      class="glucose-summary"
    >
      <strong>血糖记录摘要</strong>
      <span>空腹平均 {{ glucoseSummary.fastingAverage }} mmol/L</span>
      <span>餐后 1 小时平均 {{ glucoseSummary.after1Average }} mmol/L</span>
      <span>餐后 2 小时平均 {{ glucoseSummary.after2Average }} mmol/L</span>
      <button
        class="text-button export-button"
        type="button"
        :disabled="!entries.length || invalid"
        @click="exportGlucoseCsv"
      >
        导出当前筛选 CSV
      </button>
      <small>摘要按所选日期范围内的记录计算，只作记录整理；请遵医嘱解释测量结果。</small>
    </div>
    <p
      v-if="invalid"
      role="alert"
      class="form-error"
    >
      截止日期不得早于起始日期。
    </p>
    <p v-else-if="!entries.length">所选范围暂无记录。</p>
    <template v-else-if="plot">
      <p>
        共 {{ entries.length }} 条 · {{ vitalLabels[metric] }}
        <span v-if="metric === 'bloodPressure'">· 实线：收缩压；虚线：舒张压</span>
      </p>
      <svg
        viewBox="0 0 600 200"
        role="img"
        :aria-label="`${vitalLabels[metric]}趋势图，具体数值见下方数据表`"
        class="trend-chart"
      >
        <line
          x1="55"
          y1="30"
          x2="55"
          y2="160"
          class="axis"
        />
        <line
          x1="55"
          y1="160"
          x2="545"
          y2="160"
          class="axis"
        />
        <text
          x="5"
          y="34"
        >
          {{ plot.high.toFixed(1) }}
        </text>
        <text
          x="5"
          y="160"
        >
          {{ plot.low.toFixed(1) }}
        </text>
        <text
          x="55"
          y="190"
        >
          {{ entries[0]?.date }}
        </text>
        <text
          x="545"
          y="190"
          text-anchor="end"
        >
          {{ entries[entries.length - 1]?.date }}
        </text>
        <line
          v-if="alertY !== null"
          x1="55"
          :y1="alertY"
          x2="545"
          :y2="alertY"
          class="alert-guideline"
        />
        <line
          v-if="diastolicAlertY !== null"
          x1="55"
          :y1="diastolicAlertY"
          x2="545"
          :y2="diastolicAlertY"
          class="secondary-alert-guideline"
        />
        <polyline
          :points="primary"
          class="primary-line"
        />
        <polyline
          v-if="secondary"
          :points="secondary"
          class="secondary-line"
        />
        <g
          v-for="point in plot.points"
          :key="point.id"
        >
          <circle
            :cx="point.x"
            :cy="point.y"
            r="3"
            class="primary-point"
          >
            <title>{{ point.date }} · {{ point.value }}</title>
          </circle>
          <circle
            v-if="point.y2 !== null"
            :cx="point.x"
            :cy="point.y2"
            r="3"
            class="secondary-point"
          >
            <title>{{ point.date }} · {{ point.secondary }}</title>
          </circle>
        </g>
      </svg>
      <p
        v-if="metric === 'bloodPressure' && alertY !== null"
        class="muted alert-caption"
      >
        血压参考线：收缩压 140、舒张压 90 mmHg；仅作记录整理，请结合医嘱判断。
      </p>
      <details>
        <summary>查看趋势数据（{{ entries.length }} 条）</summary>
        <div class="trend-table">
          <table>
            <caption>{{ vitalLabels[metric] }} · 已保存测量值</caption>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">时间</th>
                <th scope="col">测量场景</th>
                <th scope="col">{{ metric === 'bloodPressure' ? '收缩压 / 舒张压' : '测量值' }}</th>
                <th scope="col">备注</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in entries"
                :key="item.id"
              >
                <td class="measurement-date">{{ item.date }}</td>
                <td class="measurement-date">{{ item.time || '未记录' }}</td>
                <td>{{ item.context || '未记录' }}</td>
                <td>{{ item.value }}{{ item.secondary === null ? '' : ` / ${item.secondary}` }}</td>
                <td>{{ item.notes || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.vital-trends {
  margin-bottom: 22px;
}

.trend-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.glucose-summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin: 14px 0;
  padding: 12px;
  background: var(--green-light);
  border-radius: 8px;
  font-size: 13px;
}

.glucose-summary small {
  flex-basis: 100%;
  color: var(--text-secondary);
  line-height: 1.6;
}

.trend-chart {
  width: 100%;
  max-height: 300px;
}

.trend-chart text {
  fill: var(--text-secondary);
  font-size: 12px;
}

.axis {
  stroke: var(--border);
}

.primary-line,
.secondary-line {
  fill: none;
  stroke-width: 2;
}

.primary-line {
  stroke: var(--primary-ink);
}

.secondary-line {
  stroke: var(--green);
  stroke-dasharray: 6 4;
}

.primary-point {
  fill: var(--primary-ink);
}

.secondary-point {
  fill: var(--green);
}

.alert-guideline {
  stroke: var(--primary);
  stroke-dasharray: 4 4;
  stroke-width: 1.5;
  opacity: 70%;
}

.secondary-alert-guideline {
  stroke: var(--green);
  stroke-dasharray: 2 4;
  stroke-width: 1.5;
  opacity: 70%;
}

.alert-caption {
  margin: 6px 0 14px;
  font-size: 12px;
  color: var(--primary);
}

.trend-table {
  overflow-x: auto;
}

.trend-table table {
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
}

.trend-table .measurement-date {
  white-space: nowrap;
}

.trend-table th,
.trend-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .trend-filters {
    grid-template-columns: 1fr;
  }
}
</style>
