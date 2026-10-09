<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily, type ImportTarget } from '@/composables/useFamily';
import { MAX_BACKUP_BYTES, readFamilyBackup } from '@/domain/backup';
import type { FamilyData } from '@/domain/family';

const store = useFamily();
const { cloud } = store;
const { active, busy, ready, expired, role, state } = cloud;
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
const unavailable = computed(
  () => !ready.value || busy.value || (active.value && (expired.value || role.value !== 'owner')),
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
      throw new Error('请选择小于 800 KB 的 JSON 备份。');
    }

    const raw = await file.text();
    const data = readFamilyBackup(raw);

    if (attempt === selection) {
      preview.value = { raw, data, target, operationId: crypto.randomUUID() };
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
          : '当前操作本浏览器的记录。账号与成员权限不包含在 JSON 备份中。'
      }}
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
          恢复会替换档案、计划和账目。仅保留最近一次导入前副本；重要记录请另行导出保存。同步家庭的成员、身份和权限保持当前设置。
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
          <p>{{ preview.data.tasks.length }} 条计划 · {{ preview.data.expenses.length }} 笔账目</p>
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
