<script setup lang="ts">
import { createId } from '@/domain/id';
import { computed, shallowRef } from 'vue';
import { useFamily, type ImportTarget } from '@/composables/useFamily';
import { MAX_BACKUP_BYTES, readFamilyBackup } from '@/domain/backup';
import type { FamilyData } from '@/domain/family';
import { MAX_CLOUD_BYTES, familyBlobBytes, familyBytes } from '@/domain/capacity';

const store = useFamily();
const { cloud } = store;
const { active, busy, ready, online, expired, role, state } = cloud;
const preview = shallowRef<{
  raw: string;
  data: FamilyData;
  target: ImportTarget;
  operationId: string;
} | null>(null);
const loading = shallowRef(false);
const error = shallowRef('');
const message = shallowRef('');
const confirmed = shallowRef(false);
const usedBytes = computed(() =>
  active.value
    ? familyBlobBytes(state.value.family?.data ?? store.data.value)
    : familyBytes(store.data.value),
);
const nearCapacity = computed(() => active.value && usedBytes.value >= MAX_CLOUD_BYTES * 0.9);
const unavailable = computed(
  () =>
    !ready.value ||
    busy.value ||
    (active.value && (!online.value || expired.value || role.value !== 'owner')),
);
let selection = 0;

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const attempt = ++selection;
  preview.value = null;
  confirmed.value = false;
  message.value = '';
  error.value = '';

  if (!file) {
    return;
  }

  const target = store.importTarget();
  loading.value = true;

  try {
    if (file.size >= MAX_BACKUP_BYTES) {
      throw new Error('请选择小于 32 MiB 的 JSON 备份。');
    }

    const raw = await file.text();
    const data = readFamilyBackup(raw);

    if (active.value) {
      const current = state.value.family;
      const member = current?.members.find((item) => item.id === state.value.user?.id);
      const cloudData = {
        ...data,
        theme: current?.data.theme ?? data.theme,
        profile:
          data.profile && current
            ? { ...data.profile, familyMode: current.mode, parentRole: member?.familyRole }
            : data.profile,
      };

      if (familyBlobBytes(cloudData) >= MAX_CLOUD_BYTES) {
        throw new Error('家庭档案字段超过云端 800 KB 容量上限，可退出账号后恢复到本机。');
      }
    }

    if (attempt === selection) {
      preview.value = { raw, data, target, operationId: createId() };
    }
  } catch (reason) {
    if (attempt === selection) {
      error.value = reason instanceof Error ? reason.message : '文件读取失败。';
    }
  } finally {
    if (attempt === selection) {
      loading.value = false;
    }

    input.value = '';
  }
}

async function restore() {
  if (!preview.value || !confirmed.value || unavailable.value || loading.value) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const { raw, target, operationId } = preview.value;

    if (await store.importBackup(raw, target, operationId)) {
      preview.value = null;
      confirmed.value = false;
      message.value = '备份已恢复；替换前的数据已保留，可下载导入前备份。';
    }
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '恢复失败，原记录未替换。请检查存储空间。';
  } finally {
    loading.value = false;
  }
}

async function downloadPrevious() {
  error.value = '';

  try {
    await store.exportBeforeImport();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '暂时无法下载备份。';
  }
}
</script>

<template>
  <section class="panel backup-panel">
    <div class="panel-heading">
      <h2>你的记录，由你掌握</h2>
      <span class="tag">备份与恢复</span>
    </div>
    <p class="muted">
      {{
        active
          ? '当前操作账号中的家庭记录，恢复结果会同步给家庭成员。'
          : '无需登录即可导入和导出。数据仅保存在当前浏览器，请定期导出 JSON 备份；换设备后可在这里导入恢复。账号与成员权限不包含在备份中，备份含个人记录，请妥善保管。'
      }}
    </p>
    <p class="muted">
      {{ active ? '云端档案字段' : '本机数据' }}：{{ (usedBytes / 1000).toFixed(1) }} KB
      <template v-if="active">/ 800 KB</template>
    </p>
    <p
      v-if="nearCapacity"
      class="form-error"
    >
      云端家庭档案字段接近上限；计划、账目、孕期记录和孩子资料存于关系表，不计入此容量。
    </p>
    <div class="backup-actions">
      <button
        class="button button-secondary"
        @click="store.exportBackup"
      >
        导出我的数据
      </button>
      <button
        class="text-button"
        :disabled="unavailable || loading"
        @click="downloadPrevious"
      >
        下载导入前备份
      </button>
    </div>
    <details class="restore-details">
      <summary>从 JSON 备份恢复</summary>
      <div class="form-grid restore-form">
        <p class="muted">
          恢复会替换档案、计划、账目和孕期记录。仅保留最近一次导入前副本；重要记录请另行导出保存。同步家庭的成员、身份和权限保持当前设置。进行中的宫缩计时也会恢复，请核对开始时间。
        </p>
        <p
          v-if="active && role !== 'owner'"
          class="muted"
        >
          {{
            state.family
              ? '只有管理员可以恢复共享家庭。'
              : '请先创建家庭，或退出账号后恢复本机数据。'
          }}
        </p>
        <label class="field">
          选择 JSON 备份
          <input
            type="file"
            accept=".json,application/json"
            :disabled="unavailable || loading"
            @change="selectFile"
          />
        </label>
        <div
          v-if="preview"
          class="backup-preview"
        >
          <strong>{{ preview.data.profile?.name || '未命名档案' }}</strong>
          <p>
            {{ preview.data.tasks.length }} 条计划 · {{ preview.data.expenses.length }} 笔账目 ·
            {{ preview.data.pregnancyRecords?.length ?? 0 }} 条孕期记录
          </p>
          <label class="confirm-option">
            <input
              v-model="confirmed"
              type="checkbox"
            />
            我理解恢复会替换当前记录
          </label>
          <button
            class="button button-primary"
            :disabled="!confirmed || unavailable || loading"
            @click="restore"
          >
            {{ loading ? '正在恢复…' : '确认恢复备份' }}
          </button>
        </div>
      </div>
    </details>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      class="success-message"
      role="status"
    >
      {{ message }}
    </p>
  </section>
</template>

<style scoped>
.backup-panel .muted {
  font-size: 13px;
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  margin: 18px 0;
}

.restore-details {
  border-top: 1px solid var(--border);
  padding-top: 18px;
}

.restore-details summary {
  cursor: pointer;
  font-size: 14px;
}

.restore-form {
  margin-top: 18px;
}

.backup-preview {
  background: var(--green-light);
  padding: 16px;
  border-radius: 10px;
  overflow-wrap: anywhere;
}

.backup-preview p {
  font-size: 13px;
  margin: 10px 0;
}

.confirm-option {
  display: flex;
  align-items: start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.7;
  margin: 14px 0;
}

.confirm-option input {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  accent-color: var(--green);
}
</style>
