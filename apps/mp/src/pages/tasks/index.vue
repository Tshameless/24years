<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { weekDays } from '@24years/domain/tasks';
import { localDate } from '@24years/domain/primitives';
import { dueReminders, taskTemplates } from '@24years/domain/taskReminders';

import {
  addTask,
  familyStore,
  removeTask,
  toggleTaskCompletion,
  updateTask,
} from '@/store/family';

const today = localDate();
const editingId = ref<string | null>(null);
const formOpen = ref(false);
const title = ref('');
const date = ref(today);
const time = ref('09:00');
const repeat = ref<'once' | 'daily' | 'weekly'>('once');
const weekdays = ref<number[]>([]);
const assignee = ref<'none' | 'mother' | 'father' | 'single_parent'>('none');
const endDate = ref('');

const sortedTasks = computed(() =>
  [...familyStore.data.tasks].sort((a, b) => b.date.localeCompare(a.date)),
);

/** 到期提醒：只提示今天已到时间、未完成、且未指派他人的计划。每 30 秒刷新一次时钟。 */
function clockText(): string {
  const now = new Date();

  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const clock = ref(clockText());
let timer: ReturnType<typeof setInterval> | null = null;

const dueNow = computed(() =>
  dueReminders(
    familyStore.data.tasks,
    localDate(),
    clock.value,
    !!familyStore.data.profile?.quietMode,
    familyStore.data.profile?.parentRole ?? undefined,
  ),
);

const dueIds = computed(() => new Set(dueNow.value.map((task) => task.id)));

function addFromTemplate(item: (typeof taskTemplates)[number]): void {
  const weekday = new Date().getDay() || 7;

  addTask({
    title: item.title,
    date: today,
    time: item.time,
    repeat: item.repeat,
    weekdays: item.repeat === 'weekly' ? [weekday] : [],
    completedDates: [],
  });
  uni.showToast({ title: '已添加到今日计划', icon: 'none' });
}

onMounted(() => {
  timer = setInterval(() => {
    clock.value = clockText();
  }, 30000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});

function resetForm(): void {
  editingId.value = null;
  title.value = '';
  date.value = today;
  time.value = '09:00';
  repeat.value = 'once';
  weekdays.value = [];
  assignee.value = 'none';
  endDate.value = '';
}

function openCreate(): void {
  resetForm();
  formOpen.value = true;
}

function openEdit(id: string): void {
  const task = familyStore.data.tasks.find((item) => item.id === id);

  if (!task) {
    return;
  }

  editingId.value = task.id;
  title.value = task.title;
  date.value = task.date;
  time.value = task.time;
  repeat.value = task.repeat;
  weekdays.value = task.weekdays ? [...task.weekdays] : [];
  assignee.value = task.assignee ?? 'none';
  endDate.value = task.endDate ?? '';
  formOpen.value = true;
}

function submit(): void {
  const trimmed = title.value.trim();

  if (!trimmed) {
    uni.showToast({ title: '请填写计划标题', icon: 'none' });

    return;
  }

  if (repeat.value === 'weekly' && weekdays.value.length === 0) {
    uni.showToast({ title: '请选择重复的星期', icon: 'none' });

    return;
  }

  if (endDate.value && endDate.value < date.value) {
    uni.showToast({ title: '结束日期不能早于开始日期', icon: 'none' });

    return;
  }

  const payload = {
    title: trimmed,
    date: date.value,
    time: time.value,
    repeat: repeat.value,
    weekdays: repeat.value === 'weekly' ? [...weekdays.value].sort() : undefined,
    assignee: assignee.value === 'none' ? undefined : assignee.value,
    endDate: endDate.value || undefined,
  };

  if (editingId.value) {
    updateTask(editingId.value, payload);
  } else {
    addTask({ ...payload, completedDates: [] });
  }

  formOpen.value = false;
  resetForm();
}

function remove(id: string): void {
  uni.showModal({
    title: '删除计划',
    content: '删除后无法恢复，确定继续？',
    success: (result) => {
      if (result.confirm) {
        removeTask(id);
      }
    },
  });
}

function toggleWeekday(value: number): void {
  weekdays.value = weekdays.value.includes(value)
    ? weekdays.value.filter((item) => item !== value)
    : [...weekdays.value, value];
}

function isDone(id: string): boolean {
  const task = familyStore.data.tasks.find((item) => item.id === id);

  return task ? task.completedDates.includes(today) : false;
}

const assigneeOptions = [
  { value: 'none', label: '不指定' },
  { value: 'mother', label: '母亲' },
  { value: 'father', label: '父亲' },
  { value: 'single_parent', label: '本人' },
] as const;

const repeatOptions = [
  { value: 'once', label: '一次性' },
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
] as const;
</script>

<template>
  <view class="page">
    <view v-if="dueNow.length" class="card reminder">
      <view class="row">
        <text class="section-title">计划提醒 · {{ dueNow.length }} 项已到时间</text>
      </view>
      <view v-for="task in dueNow" :key="task.id" class="row due-row">
        <text>{{ task.time }} · {{ task.title }}</text>
        <button size="mini" type="primary" @click="toggleTaskCompletion(task.id, today)">
          打卡
        </button>
      </view>
      <view class="muted">
        仅显示今天到时且未完成、未指派或由你负责的计划。按设备当地时间检查；关闭页面或后台休眠时不保证提醒，不能用于紧急医疗提醒。
      </view>
    </view>

    <view class="card">
      <view class="section-title">常用计划</view>
      <view class="templates">
        <view
          v-for="item in taskTemplates"
          :key="item.title"
          class="chip"
          @click="addFromTemplate(item)"
        >
          {{ item.title }}
        </view>
      </view>
    </view>

    <view class="card">
      <view class="row">
        <text class="section-title">日常计划</text>
        <button size="mini" type="primary" @click="openCreate">新增</button>
      </view>
      <view v-if="sortedTasks.length === 0" class="muted">还没有计划，先添加一条。</view>
      <view v-for="task in sortedTasks" :key="task.id" class="task-item">
        <view class="row">
          <text :class="['task-title', { done: isDone(task.id) }]">{{ task.title }}</text>
          <text class="muted">{{ task.time }}</text>
        </view>
        <view class="row muted">
          <text>{{ task.repeat === 'weekly' ? '每周' : task.repeat === 'daily' ? '每日' : task.date }}</text>
          <text>{{ task.assignee ?? '' }}</text>
        </view>
        <view class="actions">
          <button size="mini" :type="isDone(task.id) ? 'default' : 'primary'" @click="toggleTaskCompletion(task.id, today)">
            {{ isDone(task.id) ? '撤销打卡' : '今日打卡' }}
          </button>
          <button size="mini" @click="openEdit(task.id)">编辑</button>
          <button size="mini" type="warn" @click="remove(task.id)">删除</button>
        </view>
      </view>
    </view>

    <view v-if="formOpen" class="card">
      <view class="section-title">{{ editingId ? '编辑计划' : '新增计划' }}</view>

      <input v-model="title" class="input" placeholder="计划标题" />

      <view class="field">
        <text>开始日期</text>
        <picker mode="date" :value="date" @change="(e: any) => (date = e.detail.value)">
          <text class="picker-value">{{ date }}</text>
        </picker>
      </view>

      <view class="field">
        <text>时间</text>
        <picker mode="time" :value="time" @change="(e: any) => (time = e.detail.value)">
          <text class="picker-value">{{ time }}</text>
        </picker>
      </view>

      <view class="field">
        <text>重复</text>
        <picker
          mode="selector"
          :range="repeatOptions"
          range-key="label"
          :value="repeatOptions.findIndex((item) => item.value === repeat)"
          @change="(e: any) => (repeat = repeatOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ repeatOptions.find((i) => i.value === repeat)?.label }}</text>
        </picker>
      </view>

      <view v-if="repeat === 'weekly'" class="weekdays">
        <text
          v-for="day in weekDays"
          :key="day.value"
          :class="['weekday', { active: weekdays.includes(day.value) }]"
          @click="toggleWeekday(day.value)"
        >
          {{ day.label }}
        </text>
      </view>

      <view class="field">
        <text>负责人</text>
        <picker
          mode="selector"
          :range="assigneeOptions"
          range-key="label"
          :value="assigneeOptions.findIndex((item) => item.value === assignee)"
          @change="(e: any) => (assignee = assigneeOptions[e.detail.value].value)"
        >
          <text class="picker-value">{{ assigneeOptions.find((i) => i.value === assignee)?.label }}</text>
        </picker>
      </view>

      <view class="field">
        <text>结束日期（可选）</text>
        <picker mode="date" :value="endDate || today" @change="(e: any) => (endDate = e.detail.value)">
          <text class="picker-value">{{ endDate || '不限制' }}</text>
        </picker>
      </view>

      <view class="actions">
        <button size="mini" type="primary" @click="submit">保存</button>
        <button size="mini" @click="formOpen = false">取消</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 40rpx;
}

.task-item {
  padding: 20rpx 0;
  border-top: 2rpx solid #f0f1f3;
}

.task-title.done {
  color: #9ca3af;
  text-decoration: line-through;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.input {
  width: 100%;
  padding: 16rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  background-color: #ffffff;
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

.weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 16rpx 0;
}

.weekday {
  padding: 8rpx 20rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 28rpx;
  color: #6b7280;
}

.weekday.active {
  border-color: #4caf50;
  color: #ffffff;
  background-color: #4caf50;
}

.reminder {
  background: #fdf3f2;
}

.due-row {
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f6e7e5;
  font-size: 27rpx;
}

.templates {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  padding: 12rpx 22rpx;
  background: #f0f1f3;
  border-radius: 24rpx;
  font-size: 25rpx;
}
</style>
