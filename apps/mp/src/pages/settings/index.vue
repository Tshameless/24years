<script setup lang="ts">
import { computed, ref } from 'vue';

import { readFamilyBackup } from '@24years/domain/backup';
import { familyBytes, MAX_BACKUP_BYTES } from '@24years/domain/capacity';
import { localDate } from '@24years/domain/primitives';

import {
  exportFamilyJson,
  familyStore,
  importFamilyJson,
  setTheme,
  FAMILY_STORAGE_KEY,
} from '@/store/family';

const pendingImport = ref<{ raw: string; summary: string } | null>(null);
const bytes = computed(() => familyBytes(familyStore.data));

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function exportBackup(): void {
  const raw = exportFamilyJson();

  uni.setClipboardData({
    data: raw,
    success: () => {
      uni.showToast({ title: '档案 JSON 已复制，请粘贴保存', icon: 'none' });
    },
  });
}

function pickBackupFile(): void {
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['json'],
    success: (result) => {
      const file = result.tempFiles?.[0];

      if (!file) {
        return;
      }

      try {
        const raw = uni.getFileSystemManager().readFileSync(file.path, 'utf8') as string;
        const data = readFamilyBackup(raw);

        pendingImport.value = {
          raw,
          summary: `${data.profile?.name || '未命名家庭'} · 计划 ${data.tasks.length} 条 · 账目 ${data.expenses.length} 条 · 孕期记录 ${data.pregnancyRecords.length} 条 · 孩子 ${data.children.length} 位`,
        };
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '文件无法识别',
          icon: 'none',
        });
      }
    },
  });
}

function confirmImport(): void {
  const pending = pendingImport.value;

  if (!pending) {
    return;
  }

  uni.showModal({
    title: '恢复档案',
    content: '恢复会覆盖当前本机数据，确定继续？',
    success: (result) => {
      if (!result.confirm) {
        return;
      }

      try {
        uni.setStorageSync(`${FAMILY_STORAGE_KEY}.before-import`, exportFamilyJson());
        importFamilyJson(pending.raw);
        pendingImport.value = null;
        uni.showToast({ title: '已恢复', icon: 'success' });
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '恢复失败',
          icon: 'none',
        });
      }
    },
  });
}

function restorePrevious(): void {
  const key = `${FAMILY_STORAGE_KEY}.before-import`;

  try {
    const raw = uni.getStorageSync(key);

    if (!raw) {
      uni.showToast({ title: '没有可恢复的副本', icon: 'none' });

      return;
    }

    importFamilyJson(String(raw));
    uni.showToast({ title: '已回滚到恢复前副本', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '回滚失败', icon: 'none' });
  }
}

function onThemeChange(event: any): void {
  setTheme(event.detail.value ? 'dark' : 'light');
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="section-title">本机数据</view>
      <view class="row">
        <text>档案占用</text>
        <text>{{ formatBytes(bytes) }}</text>
      </view>
      <view class="row muted">
        <text>备份上限</text>
        <text>{{ formatBytes(MAX_BACKUP_BYTES) }}</text>
      </view>
      <view class="row muted">
        <text>本机存储键</text>
        <text>{{ FAMILY_STORAGE_KEY }}</text>
      </view>
      <text class="muted gap">数据保存在本机，卸载小程序或清理缓存会丢失，请定期导出备份。</text>
    </view>

    <view v-if="familyStore.damaged" class="card warning">
      <view class="section-title">存档异常</view>
      <text class="muted">
        检测到本机存档无法识别，已保留原始数据未覆盖。可通过导入已验证的备份恢复。
      </text>
    </view>

    <view class="card">
      <view class="section-title">备份与恢复</view>
      <button size="mini" type="primary" @click="exportBackup">导出 JSON（复制）</button>
      <button class="gap" size="mini" @click="pickBackupFile">从文件导入</button>
      <button class="gap" size="mini" @click="restorePrevious">回滚到恢复前副本</button>
    </view>

    <view v-if="pendingImport" class="card">
      <view class="section-title">待恢复档案</view>
      <text class="muted">{{ pendingImport.summary }}</text>
      <view class="actions">
        <button size="mini" type="primary" @click="confirmImport">确认恢复</button>
        <button size="mini" @click="pendingImport = null">取消</button>
      </view>
    </view>

    <view class="card">
      <view class="section-title">外观</view>
      <view class="field">
        <text>深色主题</text>
        <switch
          :checked="familyStore.data.theme === 'dark'"
          color="#4caf50"
          @change="onThemeChange"
        />
      </view>
      <text class="muted gap">今日日期：{{ localDate() }}</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding-bottom: 60rpx;
}

.gap {
  margin-top: 16rpx;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 2rpx solid #f0f1f3;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.warning .section-title {
  color: #e0533d;
}
</style>
