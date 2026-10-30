<script setup lang="ts">
import { computed } from 'vue';

import { currency, summarizeExpenses } from '@24years/domain/ledger';
import { pregnancyProgress } from '@24years/domain/profile';
import { localDate } from '@24years/domain/primitives';
import type { PregnancyRecord } from '@24years/domain/pregnancy';
import { taskIsDue } from '@24years/domain/tasks';

import { familyStore, toggleTaskCompletion } from '@/store/family';

const today = localDate();
const profile = computed(() => familyStore.data.profile);
const quietMode = computed(() => profile.value?.quietMode ?? false);
const progress = computed(() =>
  profile.value ? pregnancyProgress(profile.value.dueDate, today) : null,
);
const todayTasks = computed(() =>
  familyStore.data.tasks.filter((task) => taskIsDue(task, today)),
);
const summary = computed(() => summarizeExpenses(familyStore.data.expenses));
const upcomingCheckups = computed(() =>
  familyStore.data.pregnancyRecords
    .filter(
      (record): record is Extract<PregnancyRecord, { type: 'checkup' }> =>
        record.type === 'checkup' && !record.completed && record.date >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3),
);
const children = computed(() => familyStore.data.children);

function isDone(taskId: string): boolean {
  const task = familyStore.data.tasks.find((item) => item.id === taskId);

  return task ? task.completedDates.includes(today) : false;
}

function toggle(taskId: string): void {
  toggleTaskCompletion(taskId, today);
}

function goProfile(): void {
  uni.navigateTo({ url: '/pages/profile/edit' });
}
</script>

<template>
  <view class="page">
    <view v-if="!familyStore.data.profile" class="card">
      <view class="section-title">还没有家庭档案</view>
      <text class="muted">先建立档案，才能计算孕周、安排产检与计划。</text>
      <button class="primary-button" type="primary" @click="goProfile">立即建档</button>
    </view>

    <view v-else class="card">
      <view class="row">
        <text class="section-title">{{ profile?.name || '我的家庭' }}</text>
        <text class="muted">{{ today }}</text>
      </view>

      <view v-if="!quietMode && progress" class="progress">
        <view class="row">
          <text>孕 {{ progress.weeks }} 周 {{ progress.days }} 天</text>
          <text class="muted">距预产期 {{ progress.remaining }} 天</text>
        </view>
        <view class="bar">
          <view class="bar-inner" :style="{ width: progress.percent + '%' }" />
        </view>
      </view>

      <view v-else-if="quietMode" class="muted">静默关怀已开启，首页不显示孕周与倒计时。</view>
      <view v-else class="muted">孕周信息暂不可用。</view>
    </view>

    <view v-if="!quietMode" class="card">
      <view class="section-title">今日计划</view>
      <view v-if="todayTasks.length === 0" class="muted">今天没有到期的计划。</view>
      <view v-for="task in todayTasks" :key="task.id" class="task-row">
        <view class="task-main">
          <text :class="['task-title', { done: isDone(task.id) }]">{{ task.title }}</text>
          <text class="muted">{{ task.time }}</text>
        </view>
        <button size="mini" :type="isDone(task.id) ? 'default' : 'primary'" @click="toggle(task.id)">
          {{ isDone(task.id) ? '撤销' : '打卡' }}
        </button>
      </view>
    </view>

    <view class="card">
      <view class="section-title">账本摘要</view>
      <view class="row">
        <text>本月净支出</text>
        <text>{{ currency(summary.net) }}</text>
      </view>
      <view class="row muted">
        <text>支出 {{ currency(summary.total) }}</text>
        <text>已报销 {{ currency(summary.reimbursed) }}</text>
      </view>
      <view class="row muted">
        <text>已到账津贴 {{ currency(summary.allowance) }}</text>
      </view>
    </view>

    <view v-if="upcomingCheckups.length > 0" class="card">
      <view class="section-title">待完成产检</view>
      <view v-for="record in upcomingCheckups" :key="record.id" class="row">
        <text>{{ record.date }}</text>
        <text class="muted">{{ record.title }}</text>
      </view>
    </view>

    <view v-if="children.length > 0" class="card">
      <view class="section-title">孩子</view>
      <view v-for="child in children" :key="child.id" class="row">
        <text>{{ child.name }}</text>
        <text class="muted">{{ child.birthDate }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 40rpx;
}

.progress {
  margin-top: 16rpx;
}

.bar {
  margin-top: 12rpx;
  height: 12rpx;
  border-radius: 6rpx;
  background-color: #e8eaed;
  overflow: hidden;
}

.bar-inner {
  height: 100%;
  background-color: #4caf50;
}

.task-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-top: 2rpx solid #f0f1f3;
}

.task-main {
  display: flex;
  flex-direction: column;
}

.task-title.done {
  color: #9ca3af;
  text-decoration: line-through;
}
</style>
