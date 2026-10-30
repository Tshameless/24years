<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';

onLaunch(() => {
  // 领域层存储注入与本机档案读取已在 main.ts 完成。
});
</script>

<template>
  <slot />
</template>

<style>
page {
  background-color: #f5f6f8;
  color: #1f2328;
  font-size: 28rpx;
  line-height: 1.6;
}

.card {
  margin: 24rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background-color: #ffffff;
  box-shadow: 0 2rpx 12rpx rgba(31, 35, 40, 0.06);
}

.section-title {
  margin-bottom: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
}

.muted {
  color: #6b7280;
  font-size: 26rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gap {
  margin-top: 16rpx;
}
</style>
