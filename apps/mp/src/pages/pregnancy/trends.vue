<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue';

import { csvText } from '@24years/domain/csv';
import { localDate } from '@24years/domain/primitives';
import type { PregnancyRecord } from '@24years/domain/pregnancy';
import {
  selectVitals,
  vitalLabels,
  vitalPlot,
  type Vital,
} from '@24years/domain/vitalTrends';

import { drawTrendChart, type Canvas2DContext, type TrendChartPoint } from '@/utils/chart';
import { familyStore } from '@/store/family';

type Metric = Vital['metric'];

const today = localDate();
const metric = ref<Metric>('weight');
const from = ref('');
const to = ref('');
const showTable = ref(false);
const instance = getCurrentInstance();

const metricOptions = [
  { value: 'weight', label: '体重' },
  { value: 'bloodPressure', label: '血压' },
  { value: 'glucose', label: '血糖' },
] as const;

const glucoseOptions = [
  { value: 'all', label: '全部场景' },
  { value: 'fasting', label: '空腹' },
  { value: 'after1', label: '餐后 1 小时' },
  { value: 'after2', label: '餐后 2 小时' },
  { value: 'random', label: '随机' },
  { value: 'other', label: '其他' },
  { value: 'unclassified', label: '未分类历史记录' },
] as const;
const glucoseContext = ref<string>('all');

const invalid = computed(() => !!from.value && !!to.value && from.value > to.value);

/** 与 Web 端一致的血糖场景归类；context 为空串时归为未分类。 */
function matchesGlucoseContext(context: string | undefined, group: string): boolean {
  const text = context ?? '';

  if (group === 'other') {
    return text === '其他';
  }

  const known = ['空腹', '餐后1小时', '餐后2小时', '随机', '其他'];

  if (group === 'unclassified') {
    return !known.some((item) => text.includes(item));
  }

  const map: Record<string, string> = {
    fasting: '空腹',
    after1: '餐后1小时',
    after2: '餐后2小时',
    random: '随机',
  };

  return map[group] ? text.includes(map[group]!) : true;
}

const baseEntries = computed<Vital[]>(() =>
  invalid.value
    ? []
    : selectVitals(familyStore.data.pregnancyRecords, metric.value, from.value, to.value),
);

const entries = computed<Vital[]>(() =>
  metric.value !== 'glucose' || glucoseContext.value === 'all'
    ? baseEntries.value
    : baseEntries.value.filter((item) =>
        matchesGlucoseContext(item.context, glucoseContext.value),
      ),
);

const glucoseSummary = computed(() => {
  if (metric.value !== 'glucose') {
    return null;
  }

  const average = (items: Vital[]) =>
    items.length ? (items.reduce((sum, item) => sum + item.value, 0) / items.length).toFixed(1) : '—';
  const fasting = baseEntries.value.filter((item) => matchesGlucoseContext(item.context, 'fasting'));
  const after1 = baseEntries.value.filter((item) => matchesGlucoseContext(item.context, 'after1'));
  const after2 = baseEntries.value.filter((item) => matchesGlucoseContext(item.context, 'after2'));

  return {
    fastingAverage: average(fasting),
    after1Average: average(after1),
    after2Average: average(after2),
  };
});

const plot = computed(() => vitalPlot(entries.value));

/** 血压参考线：收缩压 140、舒张压 90，仅作记录整理。 */
function guidelineY(value: number): number | null {
  if (!plot.value || value < plot.value.low || value > plot.value.high) {
    return null;
  }

  return 160 - ((value - plot.value.low) / (plot.value.high - plot.value.low)) * 130;
}

const guidelines = computed(() => {
  if (metric.value !== 'bloodPressure') {
    return [];
  }

  const systolic = guidelineY(140);
  const diastolic = guidelineY(90);
  const result: { y: number; color: string }[] = [];

  if (systolic !== null) {
    result.push({ y: systolic, color: '#e0533d' });
  }

  if (diastolic !== null) {
    result.push({ y: diastolic, color: '#f2994a' });
  }

  return result;
});

const primaryPoints = computed<TrendChartPoint[]>(
  () =>
    plot.value?.points.map((point) => ({ x: point.x, y: point.y, value: point.value })) ?? [],
);

const secondaryPoints = computed<TrendChartPoint[]>(
  () =>
    plot.value?.points
      .filter((point): point is typeof point & { y2: number } => point.y2 !== null)
      .map((point) => ({ x: point.x, y: point.y2, value: point.secondary ?? 0 })) ?? [],
);

/** uni 的 NodeInfo 未声明 canvas 场景的 node/width/height，这里收窄成实际形状。 */
interface CanvasQueryResult {
  node?: {
    width: number;
    height: number;
    getContext: (type: string) => Canvas2DContext | null;
  };
  width?: number;
  height?: number;
}

function pixelRatio(): number {
  return uni.getWindowInfo?.().pixelRatio || uni.getSystemInfoSync().pixelRatio || 2;
}

function renderChart(retry = true): void {
  nextTick(() => {
    const scope = instance?.proxy;
    const query = scope
      ? uni.createSelectorQuery().in(scope)
      : uni.createSelectorQuery();

    query
      .select('#trend')
      .fields({ node: true, size: true }, (result) => {
        if (!plot.value) {
          return;
        }

        const target = result as unknown as CanvasQueryResult | undefined;

        // 首个渲染周期 canvas 可能尚未完成布局，补一次重试。
        if (!target?.node || !target.width || !target.height) {
          if (retry) {
            setTimeout(() => renderChart(false), 100);
          }

          return;
        }

        const canvas = target.node;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return;
        }

        // 物理像素适配，避免高分屏发虚。
        const ratio = pixelRatio();
        canvas.width = target.width * ratio;
        canvas.height = target.height * ratio;
        ctx.scale(ratio, ratio);

        drawTrendChart(ctx, {
          width: target.width,
          height: target.height,
          domainWidth: 600,
          domainHeight: 200,
          primary: primaryPoints.value,
          secondary: secondaryPoints.value,
          guidelines: guidelines.value,
          highLabel: plot.value.high.toFixed(1),
          lowLabel: plot.value.low.toFixed(1),
          startLabel: entries.value[0]?.date ?? '',
          endLabel: entries.value[entries.value.length - 1]?.date ?? '',
        });
      })
      .exec();
  });
}

function pick(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? '';
}

function setMetric(value: Metric): void {
  metric.value = value;
}

function onGlucoseChange(event: { detail: { value: number } }): void {
  glucoseContext.value = glucoseOptions[event.detail.value]?.value ?? 'all';
}

function exportCsv(): void {
  if (!entries.value.length) {
    return;
  }

  const header =
    metric.value === 'bloodPressure'
      ? ['日期', '时间', '测量场景', '收缩压', '舒张压', '备注']
      : ['日期', '时间', '测量场景', vitalLabels[metric.value], '备注'];
  const rows = entries.value.map((item) =>
    metric.value === 'bloodPressure'
      ? [item.date, item.time, item.context, item.value, item.secondary, item.notes]
      : [item.date, item.time, item.context, item.value, item.notes],
  );
  const csv = `\uFEFF${[header, ...rows]
    .map((row) => row.map((cell) => csvText(cell === null || cell === undefined ? '' : String(cell))).join(','))
    .join('\r\n')}\r\n`;

  uni.setClipboardData({
    data: csv,
    success: () => {
      uni.showToast({ title: 'CSV 已复制，可粘贴到表格应用', icon: 'none' });
    },
  });
}

function resetRange(): void {
  from.value = '';
  to.value = '';
}

onMounted(renderChart);
watch([metric, glucoseContext, from, to], () => renderChart());
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="section-title">趋势指标</view>
      <view class="segment">
        <view
          v-for="option in metricOptions"
          :key="option.value"
          :class="['seg-item', { active: metric === option.value }]"
          @click="setMetric(option.value)"
        >
          {{ option.label }}
        </view>
      </view>

      <picker
        v-if="metric === 'glucose'"
        mode="selector"
        :range="glucoseOptions"
        range-key="label"
        :value="glucoseOptions.findIndex((item) => item.value === glucoseContext)"
        @change="onGlucoseChange"
      >
        <view class="field">
          <text class="field-label">血糖场景</text>
          <text class="field-value">
            {{ pick(glucoseOptions, glucoseContext) || '全部场景' }}
          </text>
        </view>
      </picker>

      <view class="row">
        <picker mode="date" :value="from || today" @change="from = $event.detail.value">
          <view class="field">
            <text class="field-label">起始日期</text>
            <text class="field-value">{{ from || '不限' }}</text>
          </view>
        </picker>
        <picker mode="date" :value="to || today" @change="to = $event.detail.value">
          <view class="field">
            <text class="field-label">截止日期</text>
            <text class="field-value">{{ to || '不限' }}</text>
          </view>
        </picker>
      </view>

      <view v-if="from || to" class="link" @click="resetRange">清除日期范围</view>
      <view v-if="invalid" class="error">截止日期不得早于起始日期。</view>
    </view>

    <view class="card">
      <view class="section-title">{{ vitalLabels[metric] }}趋势</view>
      <view v-if="!entries.length" class="muted">所选范围暂无记录。</view>
      <template v-else>
        <view class="muted">共 {{ entries.length }} 条记录</view>
        <view v-if="metric === 'bloodPressure'" class="muted">
          实线：收缩压；虚线：舒张压
        </view>
        <canvas id="trend" type="2d" class="chart" />
        <view v-if="guidelines.length" class="alert-caption">
          血压参考线：收缩压 140、舒张压 90 mmHg；仅作记录整理，请结合医嘱判断。
        </view>
      </template>
    </view>

    <view v-if="glucoseSummary" class="card">
      <view class="section-title">血糖记录摘要</view>
      <view class="summary-row">
        <text class="muted">空腹平均</text>
        <text>{{ glucoseSummary.fastingAverage }} mmol/L</text>
      </view>
      <view class="summary-row">
        <text class="muted">餐后 1 小时平均</text>
        <text>{{ glucoseSummary.after1Average }} mmol/L</text>
      </view>
      <view class="summary-row">
        <text class="muted">餐后 2 小时平均</text>
        <text>{{ glucoseSummary.after2Average }} mmol/L</text>
      </view>
      <view class="muted">摘要按所选日期范围计算，只作记录整理；请遵医嘱解释测量结果。</view>
    </view>

    <view v-if="entries.length" class="card">
      <view class="row between" @click="showTable = !showTable">
        <text class="section-title">趋势数据（{{ entries.length }} 条）</text>
        <text class="link">{{ showTable ? '收起' : '展开' }}</text>
      </view>
      <view v-if="showTable" class="table">
        <view v-for="item in entries" :key="item.id" class="table-row">
          <view class="table-head">
            <text>{{ item.date }} {{ item.time || '未记录时间' }}</text>
            <text class="strong">
              {{ item.value }}{{ item.secondary === null ? '' : ` / ${item.secondary}` }}
            </text>
          </view>
          <view class="muted">
            场景：{{ item.context || '未记录' }} · 备注：{{ item.notes || '—' }}
          </view>
        </view>
      </view>
      <view class="btn primary" @click="exportCsv">导出当前筛选 CSV</view>
    </view>

    <view class="card">
      <view class="muted">
        只展示已保存的原始测量值，不作诊断。填写测量时间后，同日记录会按时间展开；未记录时间按当天起点绘制。
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 40rpx;
}

.card {
  margin: 24rpx;
  padding: 28rpx;
  background: #fff;
  border-radius: 16rpx;
}

.section-title {
  margin-bottom: 20rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.segment {
  display: flex;
  margin-bottom: 24rpx;
  background: #f0f1f3;
  border-radius: 12rpx;
  overflow: hidden;
}

.seg-item {
  flex: 1;
  padding: 18rpx 0;
  text-align: center;
  font-size: 27rpx;
  color: #6b7280;
}

.seg-item.active {
  background: #4caf50;
  color: #fff;
  font-weight: 600;
}

.row {
  display: flex;
  gap: 20rpx;
}

.row.between {
  align-items: center;
  justify-content: space-between;
}

.row.between .section-title {
  margin-bottom: 0;
}

.field {
  flex: 1;
  padding: 20rpx;
  background: #f7f8fa;
  border-radius: 12rpx;
}

.field-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.field-value {
  font-size: 28rpx;
}

.chart {
  width: 100%;
  height: 400rpx;
  margin-top: 20rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 27rpx;
}

.table-row {
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f0f1f3;
}

.table-head {
  display: flex;
  justify-content: space-between;
  font-size: 27rpx;
}

.strong {
  font-weight: 600;
  color: #4caf50;
}

.muted {
  margin: 8rpx 0;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}

.link {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #4caf50;
}

.error {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #e0533d;
}

.alert-caption {
  font-size: 22rpx;
  color: #e0533d;
  line-height: 1.6;
}

.btn {
  margin-top: 24rpx;
  padding: 22rpx 0;
  text-align: center;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.btn.primary {
  background: #4caf50;
  color: #fff;
}
</style>
