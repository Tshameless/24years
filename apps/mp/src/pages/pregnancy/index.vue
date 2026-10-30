<script setup lang="ts">
import { computed, ref } from 'vue';

import { createId } from '@24years/domain/id';
import { localDate } from '@24years/domain/primitives';
import type { PregnancyRecord } from '@24years/domain/pregnancy';

import { applyPregnancy, familyStore } from '@/store/family';

type CheckupRecord = Extract<PregnancyRecord, { type: 'checkup' }>;
type VitalRecord = Extract<PregnancyRecord, { type: 'vital' }>;
type MovementRecord = Extract<PregnancyRecord, { type: 'movement' }>;
type PackingRecord = Extract<PregnancyRecord, { type: 'packing' }>;

const today = localDate();
const now = new Date();
const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

const tab = ref<'checkup' | 'vital' | 'movement' | 'contraction' | 'packing' | 'other'>('checkup');
const tabs = [
  { value: 'checkup', label: '产检' },
  { value: 'vital', label: '体征' },
  { value: 'movement', label: '胎动' },
  { value: 'contraction', label: '宫缩' },
  { value: 'packing', label: '待产' },
  { value: 'other', label: '其他' },
] as const;

const records = computed(() => familyStore.data.pregnancyRecords);
const checkups = computed(() =>
  records.value
    .filter((record): record is CheckupRecord => record.type === 'checkup')
    .sort((a, b) => a.date.localeCompare(b.date)),
);
const vitals = computed(() =>
  records.value
    .filter((record): record is VitalRecord => record.type === 'vital')
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const movements = computed(() =>
  records.value
    .filter((record): record is MovementRecord => record.type === 'movement')
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
);
const packingItems = computed(() =>
  records.value
    .filter((record): record is PackingRecord => record.type === 'packing')
    .sort((a, b) => Number(a.completed) - Number(b.completed)),
);
const otherRecords = computed(() =>
  records.value.filter(
    (record) =>
      !['checkup', 'vital', 'movement', 'contraction', 'packing'].includes(record.type),
  ),
);

const contraction = computed(() => {
  const active = records.value.find(
    (record): record is Extract<PregnancyRecord, { type: 'contraction' }> =>
      record.type === 'contraction' && record.endedAt === null,
  );

  return active ?? null;
});
const contractionHistory = computed(() =>
  records.value
    .filter(
      (record): record is Extract<PregnancyRecord, { type: 'contraction' }> =>
        record.type === 'contraction' && record.endedAt !== null,
    )
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10),
);

// 产检
const checkupTitle = ref('');
const checkupDate = ref(today);
const checkupNotes = ref('');

function addCheckup(): void {
  const trimmed = checkupTitle.value.trim();

  if (!trimmed) {
    uni.showToast({ title: '请填写产检项目', icon: 'none' });

    return;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: {
      id: createId(),
      type: 'checkup',
      title: trimmed,
      date: checkupDate.value,
      notes: checkupNotes.value.trim(),
      completed: false,
    },
  });

  checkupTitle.value = '';
  checkupNotes.value = '';
}

function toggleCheckup(record: CheckupRecord): void {
  applyPregnancy({
    type: 'pregnancy',
    before: record,
    value: { ...record, completed: !record.completed },
  });
}

function removeCheckup(record: CheckupRecord): void {
  uni.showModal({
    title: '删除产检',
    content: '删除后无法恢复，确定继续？',
    success: (result) => {
      if (result.confirm) {
        applyPregnancy({ type: 'pregnancy', before: record, value: null });
      }
    },
  });
}

// 体征
const vitalMetric = ref<'weight' | 'bloodPressure' | 'glucose'>('weight');
const vitalValue = ref('');
const vitalSecondary = ref('');
const vitalDate = ref(today);
const vitalTime = ref(currentTime);
const vitalContext = ref('');

const vitalMetrics = [
  { value: 'weight', label: '体重' },
  { value: 'bloodPressure', label: '血压' },
  { value: 'glucose', label: '血糖' },
] as const;

const glucoseContexts = ['空腹', '餐后 1 小时', '餐后 2 小时', '随机'];

function addVital(): void {
  const value = Number(vitalValue.value);
  const secondary = vitalSecondary.value.trim() ? Number(vitalSecondary.value) : null;

  if (!Number.isFinite(value) || value <= 0) {
    uni.showToast({ title: '请填写有效的测量值', icon: 'none' });

    return;
  }

  if (vitalMetric.value === 'bloodPressure' && (secondary === null || !Number.isFinite(secondary))) {
    uni.showToast({ title: '血压需要填写高压与低压', icon: 'none' });

    return;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: {
      id: createId(),
      type: 'vital',
      date: vitalDate.value,
      time: vitalTime.value,
      context: vitalMetric.value === 'glucose' ? vitalContext.value : undefined,
      metric: vitalMetric.value,
      value,
      secondary: vitalMetric.value === 'bloodPressure' ? secondary : null,
      notes: '',
    },
  });

  vitalValue.value = '';
  vitalSecondary.value = '';
}

function vitalText(record: VitalRecord): string {
  if (record.metric === 'weight') {
    return `体重 ${record.value} kg`;
  }

  if (record.metric === 'bloodPressure') {
    return `血压 ${record.value}/${record.secondary ?? '-'} mmHg`;
  }

  return `血糖 ${record.value} mmol/L${record.context ? ' · ' + record.context : ''}`;
}

function removeVital(record: VitalRecord): void {
  applyPregnancy({ type: 'pregnancy', before: record, value: null });
}

// 胎动
const movementMinutes = ref('');
const movementCount = ref('');

function addMovement(): void {
  const minutes = Number(movementMinutes.value);
  const count = Number(movementCount.value);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    uni.showToast({ title: '请填写观察时长（分钟）', icon: 'none' });

    return;
  }

  if (!Number.isInteger(count) || count <= 0) {
    uni.showToast({ title: '请填写胎动次数', icon: 'none' });

    return;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: {
      id: createId(),
      type: 'movement',
      date: today,
      time: currentTime,
      minutes,
      count,
      notes: '',
    },
  });

  movementMinutes.value = '';
  movementCount.value = '';
}

// 宫缩
const elapsedSeconds = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function startContraction(): void {
  if (contraction.value) {
    return;
  }

  const id = createId();

  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: { id, type: 'contraction', startedAt: Date.now(), endedAt: null },
  });

  elapsedSeconds.value = 0;
  timer = setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
}

function stopContraction(): void {
  const active = contraction.value;

  if (!active) {
    return;
  }

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: active,
    value: { ...active, endedAt: Date.now() },
  });
}

function formatDuration(startedAt: number, endedAt: number): string {
  const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));

  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

// 待产
const packingTitle = ref('');
const packingCategory = ref('');

function addPacking(): void {
  const trimmed = packingTitle.value.trim();

  if (!trimmed) {
    uni.showToast({ title: '请填写待产物品', icon: 'none' });

    return;
  }

  applyPregnancy({
    type: 'pregnancy',
    before: null,
    value: {
      id: createId(),
      type: 'packing',
      date: today,
      title: trimmed,
      completed: false,
      notes: '',
      category: packingCategory.value.trim() || undefined,
    },
  });

  packingTitle.value = '';
  packingCategory.value = '';
}

function togglePacking(record: PackingRecord): void {
  applyPregnancy({
    type: 'pregnancy',
    before: record,
    value: { ...record, completed: !record.completed },
  });
}

function removePacking(record: PackingRecord): void {
  applyPregnancy({ type: 'pregnancy', before: record, value: null });
}
</script>

<template>
  <view class="page">
    <view class="tabs">
      <text
        v-for="item in tabs"
        :key="item.value"
        :class="['tab', { active: tab === item.value }]"
        @click="tab = item.value"
      >
        {{ item.label }}
      </text>
    </view>

    <!-- 产检 -->
    <view v-if="tab === 'checkup'" class="card">
      <view class="section-title">产检安排</view>
      <input v-model="checkupTitle" class="input" placeholder="产检项目，如 NT 检查" />
      <view class="field">
        <text>日期</text>
        <picker mode="date" :value="checkupDate" @change="(e: any) => (checkupDate = e.detail.value)">
          <text class="picker-value">{{ checkupDate }}</text>
        </picker>
      </view>
      <input v-model="checkupNotes" class="input" placeholder="备注（可选）" />
      <button class="submit" size="mini" type="primary" @click="addCheckup">添加产检</button>

      <view v-for="record in checkups" :key="record.id" class="record">
        <view class="row">
          <text :class="{ done: record.completed }">{{ record.title }}</text>
          <text class="muted">{{ record.date }}</text>
        </view>
        <view class="actions">
          <button size="mini" :type="record.completed ? 'default' : 'primary'" @click="toggleCheckup(record)">
            {{ record.completed ? '标记未完成' : '标记完成' }}
          </button>
          <button size="mini" type="warn" @click="removeCheckup(record)">删除</button>
        </view>
      </view>
    </view>

    <!-- 体征 -->
    <view v-if="tab === 'vital'" class="card">
      <view class="section-title">体征记录</view>
      <view class="field">
        <text>指标</text>
        <picker
          mode="selector"
          :range="vitalMetrics"
          range-key="label"
          :value="vitalMetrics.findIndex((item) => item.value === vitalMetric)"
          @change="(e: any) => (vitalMetric = vitalMetrics[e.detail.value].value)"
        >
          <text class="picker-value">{{ vitalMetrics.find((i) => i.value === vitalMetric)?.label }}</text>
        </picker>
      </view>
      <view class="field">
        <text>{{ vitalMetric === 'bloodPressure' ? '高压 (mmHg)' : vitalMetric === 'weight' ? '体重 (kg)' : '血糖 (mmol/L)' }}</text>
        <input v-model="vitalValue" class="inline-input" type="digit" placeholder="0" />
      </view>
      <view v-if="vitalMetric === 'bloodPressure'" class="field">
        <text>低压 (mmHg)</text>
        <input v-model="vitalSecondary" class="inline-input" type="digit" placeholder="0" />
      </view>
      <view v-if="vitalMetric === 'glucose'" class="field">
        <text>测量场景</text>
        <picker
          mode="selector"
          :range="glucoseContexts"
          :value="glucoseContexts.indexOf(vitalContext)"
          @change="(e: any) => (vitalContext = glucoseContexts[e.detail.value])"
        >
          <text class="picker-value">{{ vitalContext || '请选择' }}</text>
        </picker>
      </view>
      <view class="field">
        <text>日期</text>
        <picker mode="date" :value="vitalDate" @change="(e: any) => (vitalDate = e.detail.value)">
          <text class="picker-value">{{ vitalDate }}</text>
        </picker>
      </view>
      <view class="field">
        <text>时间</text>
        <picker mode="time" :value="vitalTime" @change="(e: any) => (vitalTime = e.detail.value)">
          <text class="picker-value">{{ vitalTime }}</text>
        </picker>
      </view>
      <button class="submit" size="mini" type="primary" @click="addVital">保存记录</button>

      <view v-for="record in vitals" :key="record.id" class="record">
        <view class="row">
          <text>{{ vitalText(record) }}</text>
          <text class="muted">{{ record.date }} {{ record.time ?? '' }}</text>
        </view>
        <button size="mini" type="warn" @click="removeVital(record)">删除</button>
      </view>
    </view>

    <!-- 胎动 -->
    <view v-if="tab === 'movement'" class="card">
      <view class="section-title">胎动观察</view>
      <view class="field">
        <text>观察时长（分钟）</text>
        <input v-model="movementMinutes" class="inline-input" type="number" placeholder="30" />
      </view>
      <view class="field">
        <text>胎动次数</text>
        <input v-model="movementCount" class="inline-input" type="number" placeholder="10" />
      </view>
      <button class="submit" size="mini" type="primary" @click="addMovement">保存观察</button>

      <view v-for="record in movements" :key="record.id" class="record">
        <view class="row">
          <text>{{ record.minutes }} 分钟内 {{ record.count }} 次</text>
          <text class="muted">{{ record.date }} {{ record.time }}</text>
        </view>
      </view>
    </view>

    <!-- 宫缩 -->
    <view v-if="tab === 'contraction'" class="card">
      <view class="section-title">宫缩计时</view>
      <view v-if="contraction" class="timer">
        <text class="timer-value">{{ elapsedSeconds }} 秒</text>
        <button size="mini" type="warn" @click="stopContraction">结束本次</button>
      </view>
      <view v-else>
        <text class="muted">记录一次宫缩的开始与结束时间，仅作家庭记录参考。</text>
        <button class="submit" size="mini" type="primary" @click="startContraction">开始计时</button>
      </view>

      <view v-for="record in contractionHistory" :key="record.id" class="record">
        <text>{{ formatDuration(record.startedAt, record.endedAt ?? record.startedAt) }}</text>
        <text class="muted">{{ new Date(record.startedAt).toLocaleString() }}</text>
      </view>
    </view>

    <!-- 待产 -->
    <view v-if="tab === 'packing'" class="card">
      <view class="section-title">待产清单</view>
      <input v-model="packingTitle" class="input" placeholder="待产物品" />
      <input v-model="packingCategory" class="input" placeholder="分类（可选）" />
      <button class="submit" size="mini" type="primary" @click="addPacking">添加物品</button>

      <view v-for="record in packingItems" :key="record.id" class="record">
        <view class="row">
          <text :class="{ done: record.completed }">{{ record.title }}</text>
          <text class="muted">{{ record.category ?? '' }}</text>
        </view>
        <view class="actions">
          <button size="mini" :type="record.completed ? 'default' : 'primary'" @click="togglePacking(record)">
            {{ record.completed ? '取消备齐' : '标记备齐' }}
          </button>
          <button size="mini" type="warn" @click="removePacking(record)">删除</button>
        </view>
      </view>
    </view>

    <!-- 其他 -->
    <view v-if="tab === 'other'" class="card">
      <view class="section-title">其他记录</view>
      <view v-if="otherRecords.length === 0" class="muted">暂无心理、营养、超声、症状等其他记录。</view>
      <view v-for="record in otherRecords" :key="record.id" class="record">
        <view class="row">
          <text>{{ record.type }}</text>
          <text class="muted">{{ 'date' in record ? record.date : '' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 60rpx;
}

.tabs {
  display: flex;
  padding: 20rpx 24rpx;
  gap: 12rpx;
  overflow-x: auto;
}

.tab {
  padding: 10rpx 24rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 28rpx;
  color: #6b7280;
  white-space: nowrap;
}

.tab.active {
  border-color: #4caf50;
  color: #ffffff;
  background-color: #4caf50;
}

.input {
  width: 100%;
  padding: 16rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
}

.inline-input {
  width: 240rpx;
  text-align: right;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 2rpx solid #f0f1f3;
}

.picker-value {
  color: #4caf50;
}

.submit {
  margin: 20rpx 0;
}

.record {
  padding: 18rpx 0;
  border-top: 2rpx solid #f0f1f3;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 10rpx;
}

.timer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timer-value {
  font-size: 44rpx;
  font-weight: 600;
  color: #e0533d;
}

.done {
  color: #9ca3af;
  text-decoration: line-through;
}
</style>
