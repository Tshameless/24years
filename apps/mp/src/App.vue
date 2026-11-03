<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';

onLaunch(() => {
  // 领域层存储注入与本机档案读取已在 main.ts 完成。
});
</script>

<template>
  <slot />
</template>

<style lang="scss">
page {
  background-color: $color-background;
  color: $color-on-surface;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* 核心卡片容器：温润悬浮与圆角 */
.card {
  position: relative;
  margin: 20rpx 24rpx;
  padding: 30rpx 28rpx;
  border-radius: $radius-lg;
  background-color: $color-surface-lowest;
  box-shadow: $shadow-card;
  border: 1rpx solid rgba(218, 226, 253, 0.5);
  box-sizing: border-box;
}

/* 标题规范 */
.section-title {
  margin-bottom: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-on-surface;
  letter-spacing: -0.01em;
}

.section-subtitle {
  font-size: 24rpx;
  color: $color-on-surface-variant;
  margin-top: -8rpx;
  margin-bottom: 20rpx;
}

/* 辅助文字与状态 */
.muted {
  color: $color-on-surface-variant;
  font-size: 26rpx;
}

.hint {
  color: $color-outline;
  font-size: 22rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gap {
  margin-top: 16rpx;
}

/* 微信小程序原生 input 高度与防压扁规范 */
input {
  box-sizing: border-box;
}

.input {
  width: 100%;
  height: 80rpx;
  min-height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  border-radius: $radius-md;
  background-color: $color-surface-container-low;
  border: 1rpx solid rgba(218, 226, 253, 0.8);
  box-sizing: border-box;
  font-size: 28rpx;
  color: $color-on-surface;
}

.inline-input {
  height: 64rpx;
  min-height: 64rpx;
  line-height: 64rpx;
  padding: 0 16rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  color: $color-on-surface;
}

/* Stitch 胶囊标签 (Pills / Badges) */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 18rpx;
  border-radius: $radius-full;
  font-size: 22rpx;
  font-weight: 500;
  line-height: 1.2;

  &.pill-primary {
    background-color: $color-primary-fixed;
    color: $color-on-primary-fixed-variant;
  }

  &.pill-secondary {
    background-color: $color-secondary-fixed;
    color: $color-on-secondary-fixed;
  }

  &.pill-secondary-dim {
    background-color: $color-secondary-container;
    color: $color-on-secondary-container;
  }

  &.pill-surface {
    background-color: $color-surface-container-high;
    color: $color-on-surface-variant;
  }

  &.pill-alert {
    background-color: $color-tertiary-fixed;
    color: $color-on-tertiary-fixed;
  }
}

/* 脉冲协同绿点 */
.pulse-dot {
  display: inline-block;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: $color-secondary;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

/* 按钮通用提升 */
button[type='primary'] {
  background-color: $color-primary !important;
  color: $color-on-primary !important;
  border-radius: $radius-lg !important;
  font-weight: 500 !important;
  box-shadow: 0 4rpx 14rpx rgba(185, 5, 56, 0.25);
  border: none !important;

  &:active {
    opacity: 0.88;
  }
}

button[type='default'] {
  background-color: $color-surface-container !important;
  color: $color-on-surface !important;
  border-radius: $radius-lg !important;
  border: 1rpx solid rgba(218, 226, 253, 0.8) !important;
}

button.btn-secondary {
  background-color: $color-secondary !important;
  color: #ffffff !important;
  border-radius: $radius-lg !important;
  box-shadow: 0 4rpx 14rpx rgba(0, 108, 73, 0.25);
}
</style>
