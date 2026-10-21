<script setup lang="ts">
import { shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';

const { cloud } = useFamily();
const { active, ready } = cloud;
const dismissed = shallowRef(false);

try {
  dismissed.value = localStorage.getItem('24years.local-choice') === 'accepted';
} catch {
  /* Show the explanation if storage is unavailable. */
}

function continueLocally() {
  dismissed.value = true;

  try {
    localStorage.setItem('24years.local-choice', 'accepted');
  } catch {
    /* Storage errors are reported by the family store. */
  }
}
</script>

<template>
  <section
    v-if="ready && !active && !dismissed"
    class="panel usage-choice"
    aria-labelledby="usage-title"
  >
    <p class="eyebrow">WELCOME TO 24YEARS</p>
    <h2 id="usage-title">要登录后使用吗？</h2>
    <p class="muted">登录可跨设备同步、与伴侣共享。不登录也能完整记录。</p>
    <p class="local-warning">
      不登录时，数据仅保存在当前浏览器，清除浏览器数据或使用无痕模式可能导致丢失。请定期导出备份，之后可以在本机或其他设备导入恢复。
    </p>
    <div class="choice-actions">
      <RouterLink
        to="/login"
        class="button button-primary"
      >
        登录 / 注册
      </RouterLink>
      <button
        class="button button-secondary"
        @click="continueLocally"
      >
        暂不登录，使用本机记录
      </button>
      <RouterLink
        to="/backup"
        class="text-button"
      >
        已有备份？导入恢复
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.usage-choice {
  margin-bottom: 28px;
}

.usage-choice h2 {
  margin-bottom: 12px;
}

.local-warning {
  background: var(--green-light);
  padding: 18px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.9;
}

.choice-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
</style>
