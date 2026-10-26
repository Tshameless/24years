<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { createId } from '@/domain/id';
import {
  assessChildGrowth,
  getRecommendedMilestones,
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

const { updateChild, addTask, today } = useFamily();

const activeMetric = shallowRef<GrowthMetric>('weightKg');
const showRecordForm = shallowRef(false);
const formError = shallowRef('');
const taskNotice = shallowRef('');

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

const latestRecord = computed<ChildGrowthRecord | null>(
  () => sortedRecords.value[sortedRecords.value.length - 1] ?? null,
);

const childAgeMonths = computed(() => {
  const [bY, bM, bD] = props.child.birthDate.split('-').map(Number);
  const [tY, tM, tD] = today.value.split('-').map(Number);
  let months = (tY - bY) * 12 + (tM - bM);

  if (tD < bD) {
    months -= 1;
  }

  return Math.max(0, months);
});

const latestAssessment = computed(() => {
  if (!latestRecord.value) {
    return null;
  }

  const val = latestRecord.value[activeMetric.value];

  if (val === undefined) {
    return null;
  }

  return assessChildGrowth(
    activeMetric.value,
    val,
    childAgeMonths.value,
    props.child.gender ?? 'boy',
  );
});

const milestones = computed(() => getRecommendedMilestones(props.child.birthDate, today.value));

// SVG Chart plotting points
const plotData = computed(() => {
  const points = sortedRecords.value
    .filter((r) => r[activeMetric.value] !== undefined)
    .map((r) => {
      const [rY, rM, rD] = r.date.split('-').map(Number);
      const [bY, bM, bD] = props.child.birthDate.split('-').map(Number);
      let m = (rY - bY) * 12 + (rM - bM);

      if (rD < bD) {
        m -= 0.5;
      }

      return {
        date: r.date,
        month: Math.max(0, m),
        value: Number(r[activeMetric.value]),
      };
    });

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

function addMilestoneToTasks(item: { title: string; targetDate: string; description: string }) {
  const success = addTask({
    title: `${props.child.name}：${item.title}`,
    date: item.targetDate,
    time: '09:00',
    repeat: 'once',
  });

  if (success) {
    taskNotice.value = `已添加提醒「${item.title}」至 ${item.targetDate} 日常计划！`;
    setTimeout(() => {
      taskNotice.value = '';
    }, 4000);
  }
}
</script>

<template>
  <div class="growth-tracker">
    <div class="tracker-header">
      <h4>生长发育监测与健康体检</h4>
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
            max="50"
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
            max="150"
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
            max="70"
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

    <!-- 评估简报 -->
    <div
      v-if="latestAssessment"
      class="assessment-card"
      :class="latestAssessment.status"
    >
      <div class="assessment-badge">
        {{ latestAssessment.percentileBand }}
      </div>
      <div class="assessment-text">
        <strong>{{ latestAssessment.summary }}</strong>
        <p>
          WHO 儿童生长标准参考：P3 ({{ latestAssessment.p3 }}) · 中位数 P50 ({{
            latestAssessment.p50
          }}) · P97 ({{ latestAssessment.p97 }})
        </p>
      </div>
    </div>

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
        <span>最新测量：{{ latestRecord?.[activeMetric] }}</span>
        <span>{{ plotData.maxMonth }} 月龄</span>
      </div>
    </div>
    <div
      v-else
      class="empty-growth"
    >
      <p class="muted">暂未录入该项测量数据，点击上方“记录生长数据”开始追踪成长曲线。</p>
    </div>

    <!-- 疫苗与体检里程碑计划 -->
    <div class="milestones-section">
      <h5>国家免疫规划与儿童健康体检建议</h5>
      <p
        v-if="taskNotice"
        class="success-message"
        role="status"
      >
        {{ taskNotice }}
      </p>
      <div class="milestone-list">
        <div
          v-for="item in milestones.slice(0, 5)"
          :key="item.id"
          class="milestone-item"
          :class="{ overdue: item.isOverdue }"
        >
          <div class="milestone-info">
            <span class="milestone-tag">
              {{ item.ageLabel }} · {{ item.type === 'vaccine' ? '疫苗接种' : '健康体检' }}
            </span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.targetDate }} · {{ item.description }}</small>
          </div>
          <button
            class="button button-secondary button-sm"
            type="button"
            @click="addMilestoneToTasks(item)"
          >
            添加至计划
          </button>
        </div>
      </div>
    </div>
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

.assessment-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: var(--pink-light);
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
}

.assessment-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: var(--primary);
  color: #fff;
  font-weight: bold;
  font-size: 0.75rem;
}

.assessment-text strong {
  display: block;
  color: var(--text-heading);
}

.assessment-text p {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.775rem;
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

.milestones-section h5 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-heading);
}

.milestone-list {
  display: grid;
  gap: 0.5rem;
}

.milestone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 0.85rem;
}

.milestone-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.milestone-tag {
  font-size: 0.725rem;
  color: var(--primary);
  font-weight: bold;
}

.milestone-info small {
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
