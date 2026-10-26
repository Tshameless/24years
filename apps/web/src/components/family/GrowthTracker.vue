<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { createId } from '@/domain/id';
import {
  dayDifference,
  localDate,
  type Child,
  type ChildGrowthRecord,
  type GrowthMetric,
} from '@/domain/family';
import { useFamily } from '@/composables/useFamily';
import AppIcon from '@/components/AppIcon.vue';

const props = defineProps<{
  child: Child;
}>();

const { updateChild, addTask, locked, today } = useFamily();

const activeMetric = shallowRef<GrowthMetric>('weightKg');
const showRecordForm = shallowRef(false);
const formError = shallowRef('');
const taskNotice = shallowRef('');
const reminderError = shallowRef('');
const reminderTitle = shallowRef('');
const reminderDate = shallowRef(localDate());
const reminderTime = shallowRef('09:00');

const form = reactive({
  date: localDate(),
  weightKg: '',
  heightCm: '',
  headCircumferenceCm: '',
  notes: '',
});

const sortedRecords = computed<readonly ChildGrowthRecord[]>(() =>
  [...(props.child.growthRecords ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
);

const metricRecords = computed(() =>
  sortedRecords.value.filter((record) => record[activeMetric.value] !== undefined),
);

const latestMetricRecord = computed<ChildGrowthRecord | null>(
  () => metricRecords.value[metricRecords.value.length - 1] ?? null,
);

const reminderTitleLimit = computed(() => Math.max(1, 79 - props.child.name.length));

// SVG Chart plotting points
const plotData = computed(() => {
  const points = metricRecords.value.map((record) => ({
    date: record.date,
    month: dayDifference(record.date, props.child.birthDate) / (365.2425 / 12),
    value: Number(record[activeMetric.value]),
  }));

  if (!points.length) {
    return null;
  }

  const values = points.map((p) => p.value);
  const minVal = Math.floor(Math.min(...values) * 0.85);
  const maxVal = Math.ceil(Math.max(...values) * 1.15);
  const maxMonth = Math.max(12, ...points.map((p) => p.month));

  const chartW = 340;
  const chartH = 140;

  const getX = (month: number) => Math.round(25 + (month / (maxMonth || 1)) * (chartW - 50));
  const getY = (val: number) => {
    const range = maxVal - minVal || 1;

    return Math.round(chartH - 20 - ((val - minVal) / range) * (chartH - 40));
  };

  const polyline = points.map((p) => `${getX(p.month)},${getY(p.value)}`).join(' ');

  return { points, minVal, maxVal, maxMonth, chartW, chartH, getX, getY, polyline };
});

function submitRecord() {
  formError.value = '';

  if (form.date < props.child.birthDate || form.date > today.value) {
    formError.value = '测量日期必须在出生日期至今天之间。';

    return;
  }

  const w = form.weightKg ? Number(form.weightKg) : undefined;
  const h = form.heightCm ? Number(form.heightCm) : undefined;
  const head = form.headCircumferenceCm ? Number(form.headCircumferenceCm) : undefined;

  if (w === undefined && h === undefined && head === undefined) {
    formError.value = '请至少填写体重、身长或头围中的一项测量数据。';

    return;
  }

  const record: ChildGrowthRecord = {
    id: createId(),
    date: form.date,
    ...(w !== undefined ? { weightKg: w } : {}),
    ...(h !== undefined ? { heightCm: h } : {}),
    ...(head !== undefined ? { headCircumferenceCm: head } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };

  const updated: Child = {
    ...props.child,
    growthRecords: [...(props.child.growthRecords ?? []), record],
  };

  if (updateChild(updated, props.child)) {
    form.weightKg = '';
    form.heightCm = '';
    form.headCircumferenceCm = '';
    form.notes = '';
    showRecordForm.value = false;
  } else {
    formError.value = '记录保存失败，请检查输入格式。';
  }
}

function addReminder() {
  reminderError.value = '';
  taskNotice.value = '';
  const title = reminderTitle.value.trim();

  if (!title) {
    reminderError.value = '请填写提醒内容。';

    return;
  }

  if (!reminderDate.value || reminderDate.value < today.value) {
    reminderError.value = '提醒日期不能早于今天。';

    return;
  }

  const taskTitle = `${props.child.name}：${title}`;
  const success = addTask({
    title: taskTitle,
    date: reminderDate.value,
    time: reminderTime.value,
    repeat: 'once',
  });

  if (success) {
    taskNotice.value = `已添加「${taskTitle}」至日常计划。`;
    reminderTitle.value = '';
  } else {
    reminderError.value = '添加失败，请检查提醒日期和时间。';
  }
}
</script>

<template>
  <div class="growth-tracker">
    <div class="tracker-header">
      <h4>成长记录与变化趋势</h4>
      <button
        class="button button-secondary button-sm"
        type="button"
        @click="showRecordForm = !showRecordForm"
      >
        <AppIcon
          :name="showRecordForm ? 'cross' : 'plus'"
          :size="14"
        />
        {{ showRecordForm ? '收起表单' : '记录生长数据' }}
      </button>
    </div>

    <!-- 录入生长数据表单 -->
    <form
      v-if="showRecordForm"
      class="growth-form panel"
      @submit.prevent="submitRecord"
    >
      <div class="form-row">
        <label class="field">
          测量日期
          <input
            v-model="form.date"
            type="date"
            :min="child.birthDate"
            :max="today"
            required
          />
        </label>
        <label class="field">
          体重（kg）
          <input
            v-model="form.weightKg"
            type="number"
            step="0.01"
            min="0.5"
            max="40"
            placeholder="例如：6.40"
          />
        </label>
        <label class="field">
          身长（cm）
          <input
            v-model="form.heightCm"
            type="number"
            step="0.1"
            min="20"
            max="140"
            placeholder="例如：61.5"
          />
        </label>
        <label class="field">
          头围（cm）
          <input
            v-model="form.headCircumferenceCm"
            type="number"
            step="0.1"
            min="20"
            max="60"
            placeholder="例如：40.5"
          />
        </label>
      </div>
      <label class="field">
        测量备注（就医或家庭测量）
        <input
          v-model="form.notes"
          type="text"
          maxlength="200"
          placeholder="例如：3月龄社区体检常规测量"
        />
      </label>
      <p
        v-if="formError"
        class="form-error"
        role="alert"
      >
        {{ formError }}
      </p>
      <div class="form-actions">
        <button
          class="button button-primary button-sm"
          type="submit"
        >
          保存测量记录
        </button>
      </div>
    </form>

    <!-- 指标切换与评估 -->
    <div class="metric-selector">
      <button
        type="button"
        class="metric-pill"
        :class="{ active: activeMetric === 'weightKg' }"
        @click="activeMetric = 'weightKg'"
      >
        体重
      </button>
      <button
        type="button"
        class="metric-pill"
        :class="{ active: activeMetric === 'heightCm' }"
        @click="activeMetric = 'heightCm'"
      >
        身长
      </button>
      <button
        type="button"
        class="metric-pill"
        :class="{ active: activeMetric === 'headCircumferenceCm' }"
        @click="activeMetric = 'headCircumferenceCm'"
      >
        头围
      </button>
    </div>

    <p class="muted growth-note">
      此处只记录家庭测量与变化趋势，不提供生长标准评估或接种建议；相关安排请遵循医护人员和当地要求。
    </p>

    <!-- SVG 趋势曲线 -->
    <div
      v-if="plotData"
      class="chart-container"
    >
      <svg
        :viewBox="`0 0 ${plotData.chartW} ${plotData.chartH}`"
        class="growth-chart"
      >
        <!-- 背景基准线 -->
        <line
          x1="20"
          :y1="plotData.chartH - 20"
          :x2="plotData.chartW - 20"
          :y2="plotData.chartH - 20"
          stroke="var(--border)"
          stroke-width="1"
        />
        <!-- 测量数据折线 -->
        <polyline
          :points="plotData.polyline"
          fill="none"
          stroke="var(--primary)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- 数据点圆圈 -->
        <circle
          v-for="p in plotData.points"
          :key="p.date"
          :cx="plotData.getX(p.month)"
          :cy="plotData.getY(p.value)"
          r="4.5"
          fill="var(--surface)"
          stroke="var(--primary)"
          stroke-width="2"
        />
      </svg>
      <div class="chart-labels">
        <span>出生</span>
        <span>最新测量：{{ latestMetricRecord?.[activeMetric] }}</span>
        <span>{{ plotData.maxMonth }} 月龄</span>
      </div>
    </div>
    <div
      v-else
      class="empty-growth"
    >
      <p class="muted">暂未录入该项测量数据，点击上方“记录生长数据”开始追踪成长曲线。</p>
    </div>

    <section class="custom-reminder-section">
      <h5>添加自定义计划</h5>
      <p class="muted">按医护人员或当地安排填写。应用不会推荐疫苗接种日期或健康检查项目。</p>
      <p
        v-if="taskNotice"
        class="success-message"
        role="status"
      >
        {{ taskNotice }}
      </p>
      <form
        class="reminder-form"
        @submit.prevent="addReminder"
      >
        <label class="field">
          提醒内容
          <input
            v-model="reminderTitle"
            type="text"
            :maxlength="reminderTitleLimit"
            required
            placeholder="例如：按医嘱复诊"
          />
        </label>
        <label class="field">
          日期
          <input
            v-model="reminderDate"
            type="date"
            :min="today"
            required
          />
        </label>
        <label class="field">
          时间
          <input
            v-model="reminderTime"
            type="time"
            required
          />
        </label>
        <button
          class="button button-secondary button-sm"
          type="submit"
          :disabled="locked"
        >
          添加到计划
        </button>
      </form>
      <p
        v-if="reminderError"
        class="form-error"
        role="alert"
      >
        {{ reminderError }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.growth-tracker {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px dashed var(--border);
}

.tracker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tracker-header h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-heading);
}

.growth-form {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--surface-secondary, rgb(0 0 0 / 2%));
  border: 1px solid var(--border);
  border-radius: 10px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}

.button-sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.825rem;
}

.metric-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.metric-pill {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
}

.metric-pill.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.growth-note {
  margin: 0 0 0.75rem;
}

.chart-container {
  padding: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.growth-chart {
  width: 100%;
  height: 120px;
  display: block;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.empty-growth {
  padding: 1rem;
  text-align: center;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.custom-reminder-section h5 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-heading);
}

.custom-reminder-section > p {
  margin: 0 0 0.75rem;
}

.reminder-form {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(130px, 0.7fr) minmax(105px, 0.55fr) auto;
  gap: 0.65rem;
  align-items: end;
}

@media (max-width: 700px) {
  .reminder-form {
    grid-template-columns: 1fr 1fr;
  }

  .reminder-form .field:first-child {
    grid-column: 1 / -1;
  }
}
</style>
