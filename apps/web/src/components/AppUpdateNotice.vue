<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue';

const available = shallowRef(false);
let controller: AbortController | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

async function checkVersion() {
  if (document.visibilityState === 'hidden' || controller || available.value) {
    return;
  }

  controller = new AbortController();
  const timeout = setTimeout(() => controller?.abort(), 10000);

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return;
    }

    const data: unknown = await response.json();

    if (
      data &&
      typeof data === 'object' &&
      'version' in data &&
      typeof data.version === 'string' &&
      data.version.length > 0 &&
      data.version !== import.meta.env.VITE_APP_VERSION &&
      !controller?.signal.aborted
    ) {
      available.value = true;
    }
  } catch {
    // A failed check must not interrupt recording; retry on the next check.
  } finally {
    clearTimeout(timeout);
    controller = undefined;
  }
}

function refresh() {
  // Existing beforeunload guards protect unsaved drafts during a reload.
  window.location.reload();
}

onMounted(() => {
  void checkVersion();
  timer = setInterval(() => void checkVersion(), 60000);
  document.addEventListener('visibilitychange', checkVersion);
  window.addEventListener('online', checkVersion);
});

onUnmounted(() => {
  clearInterval(timer);
  controller?.abort();
  document.removeEventListener('visibilitychange', checkVersion);
  window.removeEventListener('online', checkVersion);
});
</script>

<template>
  <section
    v-if="available"
    class="update-notice"
    role="status"
    aria-live="polite"
  >
    <div>
      <strong>发现新版本</strong>
      <p>页面已更新，请先保存正在填写的内容，再刷新使用新版。</p>
    </div>
    <button
      type="button"
      class="button button-primary"
      @click="refresh"
    >
      刷新更新
    </button>
  </section>
</template>

<style scoped>
.update-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
}

.update-notice p {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.update-notice button {
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .update-notice {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
