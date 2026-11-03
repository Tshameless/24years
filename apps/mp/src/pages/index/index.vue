<script setup lang="ts">
import { computed } from 'vue';

import { currency, summarizeExpenses } from '@24years/domain/ledger';
import { pregnancyProgress } from '@24years/domain/profile';
import { localDate } from '@24years/domain/primitives';
import type { PregnancyRecord } from '@24years/domain/pregnancy';
import { taskIsDue } from '@24years/domain/tasks';

import { familyStore, toggleTaskCompletion } from '@/store/family';
import { collabStore } from '@/store/collab';

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

function goPregnancy(): void {
  uni.switchTab({ url: '/pages/pregnancy/index' });
}

function goLedger(): void {
  uni.switchTab({ url: '/pages/ledger/index' });
}

function goCollab(): void {
  uni.navigateTo({ url: '/pages/collab/index' });
}
</script>

<template>
  <view class="page">
    <!-- 未建档引导状态卡片 -->
    <view v-if="!familyStore.data.profile" class="card empty-card">
      <view class="hero-badge-wrap">
        <text class="hero-icon">✨</text>
      </view>
      <view class="section-title text-center">开启家庭循证守护之旅</view>
      <text class="muted text-center empty-desc">建立专属家庭档案，双人协同计算孕周、智能排期产检与跟踪收支。</text>
      <button class="primary-button" type="primary" @click="goProfile">立即新建家庭档案</button>
    </view>

    <!-- 顶部孕周与双人同频状态卡片 (Level 1 Ambient Precision) -->
    <view v-else class="card hero-card">
      <!-- 柔光氛围背景层 -->
      <view class="ambient-glow glow-secondary" />
      <view class="ambient-glow glow-primary" />

      <view class="hero-content">
        <!-- 顶部信息胶囊栏 -->
        <view class="row header-pills">
          <view class="family-badge">
            <text class="family-name">{{ profile?.name || '我的家庭' }}</text>
          </view>
          <view class="collab-status-pill" @click="goCollab">
            <view class="pulse-dot" />
            <text class="collab-text">{{ collabStore.spaceId ? '双人协同' : '单机离线' }}</text>
          </view>
        </view>

        <!-- 孕期阶段核心指标 -->
        <view v-if="!quietMode && progress" class="progress-section">
          <view class="row progress-header">
            <view class="pill-group">
              <view class="pill pill-primary">
                <text>孕 {{ progress.weeks }} 周 + {{ progress.days }} 天</text>
              </view>
              <view class="pill pill-surface">
                <text>距预产期 {{ progress.remaining }} 天</text>
              </view>
            </view>
            <text class="percent-text">{{ Math.round(progress.percent) }}%</text>
          </view>

          <!-- 40周渐变双轨进度条 -->
          <view class="progress-bar-container">
            <view class="progress-bar-track">
              <view class="progress-bar-fill" :style="{ width: progress.percent + '%' }" />
            </view>
          </view>

          <!-- 双人同频节点展示 -->
          <view class="actors-strip">
            <view class="actor-node active">
              <view class="node-dot mom" />
              <text class="actor-title">准妈 · 孕周体征</text>
            </view>
            <view class="actor-node active">
              <view class="node-dot partner" />
              <text class="actor-title">准爸/家人 · 同步守护</text>
            </view>
          </view>
        </view>

        <view v-else-if="quietMode" class="quiet-box">
          <text class="quiet-icon">🌿</text>
          <text class="muted">静默关怀模式已开启，为您隐藏倒计时与孕周焦虑。</text>
        </view>
        <view v-else class="muted text-center py-2">全生命周期档案已同步</view>
      </view>
    </view>

    <!-- 今日协作打卡 / 计划卡片 -->
    <view v-if="!quietMode" class="card task-card">
      <view class="row section-header">
        <view>
          <view class="section-title">今日协作打卡</view>
          <view class="section-subtitle">双向待办与健康计划</view>
        </view>
        <view class="pill pill-surface">
          <text>{{ today }}</text>
        </view>
      </view>

      <view v-if="todayTasks.length === 0" class="empty-task-hint">
        <text class="muted">今天暂无待办，好好休息吧 ✨</text>
      </view>

      <view v-for="task in todayTasks" :key="task.id" class="task-item">
        <view class="task-info">
          <view :class="['check-circle', { checked: isDone(task.id) }]" @click="toggle(task.id)">
            <text v-if="isDone(task.id)" class="check-mark">✓</text>
          </view>
          <view class="task-text-group">
            <text :class="['task-title', { done: isDone(task.id) }]">{{ task.title }}</text>
            <text class="hint">{{ task.time }} · {{ isDone(task.id) ? '已完成' : '待处理' }}</text>
          </view>
        </view>
        <button
          size="mini"
          :class="['action-btn', isDone(task.id) ? 'btn-done' : 'btn-active']"
          @click="toggle(task.id)"
        >
          {{ isDone(task.id) ? '撤销' : '打卡' }}
        </button>
      </view>
    </view>

    <!-- 真实生娃收支大卡片 (Net Maternity Impact Ledger) -->
    <view class="card ledger-hero-card" @click="goLedger">
      <view class="row section-header">
        <view>
          <view class="section-title">家庭账本与生育津贴</view>
          <view class="section-subtitle">真实自费与补贴穿透</view>
        </view>
        <text class="view-link">明细 ›</text>
      </view>

      <view class="net-cost-highlight">
        <text class="net-cost-label">本月真实净自费</text>
        <view class="net-cost-value">
          <text class="currency-symbol">¥</text>
          <text class="cost-number">{{ (summary.net / 100).toFixed(2) }}</text>
        </view>
      </view>

      <view class="finance-telemetry-grid">
        <view class="finance-col expense-col">
          <text class="col-title">总支出</text>
          <text class="col-value text-expense">{{ currency(summary.total) }}</text>
        </view>
        <view class="finance-divider" />
        <view class="finance-col allowance-col">
          <text class="col-title">已报销 / 津贴</text>
          <text class="col-value text-allowance">{{ currency(summary.reimbursed + summary.allowance) }}</text>
        </view>
      </view>
    </view>

    <!-- 待完成产检卡片 (Upcoming Checkups) -->
    <view v-if="upcomingCheckups.length > 0" class="card checkup-card" @click="goPregnancy">
      <view class="row section-header">
        <view>
          <view class="section-title">近期产检与监测</view>
          <view class="section-subtitle">循证指南与去焦虑解读</view>
        </view>
        <text class="view-link">全部 ›</text>
      </view>

      <view v-for="record in upcomingCheckups" :key="record.id" class="checkup-item">
        <view class="checkup-date-badge">
          <text class="badge-icon">📅</text>
          <text class="badge-date">{{ record.date }}</text>
        </view>
        <view class="checkup-details">
          <text class="checkup-title">{{ record.title }}</text>
          <text class="hint">{{ record.notes || '建议提前预约挂号' }}</text>
        </view>
        <view class="pill pill-primary">
          <text>待检查</text>
        </view>
      </view>
    </view>

    <!-- 儿童关怀卡片 (如果存在儿童档案) -->
    <view v-if="children.length > 0" class="card child-card">
      <view class="section-title">宝宝成长档案</view>
      <view v-for="child in children" :key="child.id" class="child-row">
        <view class="child-avatar">👶</view>
        <view class="child-info">
          <text class="child-name">{{ child.name }}</text>
          <text class="hint">出生日期：{{ child.birthDate }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  padding-bottom: 50rpx;
}

.text-center {
  text-align: center;
}

/* 顶部 Ambient 渐变卡片 */
.hero-card {
  overflow: hidden;
  position: relative;
  border: 1rpx solid rgba(218, 226, 253, 0.7);

  .ambient-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(40rpx);
    pointer-events: none;
    z-index: 0;

    &.glow-secondary {
      right: -40rpx;
      top: -40rpx;
      width: 180rpx;
      height: 180rpx;
      background-color: rgba(111, 251, 190, 0.35);
    }

    &.glow-primary {
      left: -40rpx;
      bottom: -40rpx;
      width: 160rpx;
      height: 160rpx;
      background-color: rgba(255, 178, 183, 0.3);
    }
  }

  .hero-content {
    position: relative;
    z-index: 1;
  }
}

.header-pills {
  margin-bottom: 24rpx;

  .family-name {
    font-size: 34rpx;
    font-weight: 700;
    color: $color-on-surface;
    letter-spacing: -0.01em;
  }

  .collab-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8rpx;
    padding: 6rpx 16rpx;
    border-radius: $radius-full;
    background-color: $color-secondary-container;
    border: 1rpx solid rgba(0, 108, 73, 0.15);

    .collab-text {
      font-size: 22rpx;
      font-weight: 600;
      color: $color-on-secondary-container;
    }
  }
}

.progress-section {
  .progress-header {
    margin-bottom: 14rpx;

    .pill-group {
      display: flex;
      gap: 12rpx;
    }

    .percent-text {
      font-size: 28rpx;
      font-weight: 700;
      color: $color-primary;
    }
  }

  .progress-bar-container {
    margin: 12rpx 0 24rpx;

    .progress-bar-track {
      height: 16rpx;
      border-radius: $radius-full;
      background-color: $color-surface-container-high;
      overflow: hidden;

      .progress-bar-fill {
        height: 100%;
        border-radius: $radius-full;
        background: linear-gradient(90deg, $color-secondary-fixed, $color-primary);
        transition: width 0.4s ease;
      }
    }
  }

  .actors-strip {
    display: flex;
    justify-content: space-between;
    padding-top: 16rpx;
    border-top: 1rpx dashed rgba(218, 226, 253, 0.8);

    .actor-node {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .node-dot {
        width: 14rpx;
        height: 14rpx;
        border-radius: 50%;

        &.mom {
          background-color: $color-primary;
        }

        &.partner {
          background-color: $color-secondary;
        }
      }

      .actor-title {
        font-size: 22rpx;
        color: $color-on-surface-variant;
      }
    }
  }
}

.quiet-box {
  padding: 24rpx;
  background-color: $color-surface-container-low;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 16rpx;

  .quiet-icon {
    font-size: 36rpx;
  }
}

.section-header {
  margin-bottom: 20rpx;

  .view-link {
    font-size: 26rpx;
    color: $color-primary;
    font-weight: 500;
  }
}

/* 计划打卡 */
.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0;
  border-top: 1rpx solid rgba(218, 226, 253, 0.6);

  .task-info {
    display: flex;
    align-items: center;
    gap: 16rpx;
    flex: 1;

    .check-circle {
      width: 40rpx;
      height: 40rpx;
      border-radius: 50%;
      border: 2rpx solid $color-outline-variant;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &.checked {
        background-color: $color-secondary;
        border-color: $color-secondary;
      }

      .check-mark {
        color: #ffffff;
        font-size: 24rpx;
        font-weight: bold;
      }
    }

    .task-text-group {
      display: flex;
      flex-direction: column;

      .task-title {
        font-size: 28rpx;
        font-weight: 500;
        color: $color-on-surface;

        &.done {
          color: $color-outline;
          text-decoration: line-through;
        }
      }
    }
  }

  .action-btn {
    border-radius: $radius-full !important;
    font-size: 22rpx !important;
    padding: 4rpx 20rpx !important;
    margin: 0 !important;

    &.btn-active {
      background-color: $color-primary-fixed !important;
      color: $color-on-primary-fixed-variant !important;
      border: 1rpx solid rgba(185, 5, 56, 0.2) !important;
    }

    &.btn-done {
      background-color: $color-surface-container !important;
      color: $color-on-surface-variant !important;
    }
  }
}

.empty-task-hint {
  padding: 24rpx 0;
  text-align: center;
}

/* 净成本工作台卡片 */
.ledger-hero-card {
  background: linear-gradient(180deg, #ffffff 0%, $color-surface-container-low 100%);

  .net-cost-highlight {
    padding: 16rpx 0 24rpx;

    .net-cost-label {
      font-size: 24rpx;
      color: $color-on-surface-variant;
      margin-bottom: 6rpx;
      display: block;
    }

    .net-cost-value {
      display: flex;
      align-items: baseline;
      gap: 6rpx;

      .currency-symbol {
        font-size: 32rpx;
        font-weight: 700;
        color: $color-on-surface;
      }

      .cost-number {
        font-size: 56rpx;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: $color-on-surface;
      }
    }
  }

  .finance-telemetry-grid {
    display: flex;
    align-items: center;
    background-color: #ffffff;
    border-radius: $radius-md;
    padding: 20rpx 24rpx;
    border: 1rpx solid rgba(218, 226, 253, 0.6);

    .finance-col {
      flex: 1;
      display: flex;
      flex-direction: column;

      .col-title {
        font-size: 22rpx;
        color: $color-on-surface-variant;
        margin-bottom: 6rpx;
      }

      .col-value {
        font-size: 30rpx;
        font-weight: 700;

        &.text-expense {
          color: $color-primary;
        }

        &.text-allowance {
          color: $color-secondary;
        }
      }
    }

    .finance-divider {
      width: 1rpx;
      height: 48rpx;
      background-color: rgba(218, 226, 253, 0.8);
      margin: 0 20rpx;
    }
  }
}

/* 近期产检卡片 */
.checkup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0;
  border-top: 1rpx solid rgba(218, 226, 253, 0.6);

  .checkup-date-badge {
    display: flex;
    align-items: center;
    gap: 8rpx;
    background-color: $color-surface-container-high;
    padding: 6rpx 14rpx;
    border-radius: $radius-md;
    font-size: 22rpx;
    font-weight: 500;
    color: $color-on-surface;

    .badge-icon {
      font-size: 20rpx;
    }
  }

  .checkup-details {
    flex: 1;
    margin: 0 16rpx;
    display: flex;
    flex-direction: column;

    .checkup-title {
      font-size: 28rpx;
      font-weight: 600;
      color: $color-on-surface;
    }
  }
}

/* 儿童卡片 */
.child-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid rgba(218, 226, 253, 0.6);

  .child-avatar {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background-color: $color-surface-container-high;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
  }

  .child-info {
    display: flex;
    flex-direction: column;

    .child-name {
      font-size: 28rpx;
      font-weight: 600;
    }
  }
}

/* 空状态卡片 */
.empty-card {
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .hero-badge-wrap {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background-color: $color-primary-fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;

    .hero-icon {
      font-size: 48rpx;
    }
  }

  .empty-desc {
    margin: 12rpx 0 36rpx;
    line-height: 1.6;
  }

  .primary-button {
    width: 100%;
  }
}
</style>
