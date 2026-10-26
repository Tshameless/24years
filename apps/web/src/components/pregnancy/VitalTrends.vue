<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { selectVitals, vitalPlot, vitalLabels, type Vital } from '@/domain/vitalTrends';

const { data } = useFamily();
const metric = shallowRef<Vital['metric']>('weight');
const from = shallowRef('');
const to = shallowRef('');
const invalid = computed(() => !!from.value && !!to.value && from.value > to.value);
const entries = computed(() =>
  invalid.value
    ? []
    : selectVitals(data.value.pregnancyRecords ?? [], metric.value, from.value, to.value),
);
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

  const { low, high } = plot.value;

  if (140 < low || 140 > high) {
    return null;
  }

  return 160 - ((140 - low) / (high - low)) * 130;
});
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
      只展示已保存的原始测量值，不标注正常范围或作诊断。同日测量位于相同横坐标，具体时间与场景见数据表；未记录时间不推断先后，纵轴自动缩放。血糖不同测量场景不可直接比较。
    </p>
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
        红色警戒参考线：140 mmHg（妊娠期高血压警戒线，参考中国妇产学会指南）。
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
