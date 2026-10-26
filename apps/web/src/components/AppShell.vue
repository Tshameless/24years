<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { useFamily } from '@/composables/useFamily';
import AppIcon from './AppIcon.vue';
import AppSidebar from './AppSidebar.vue';

const { data, error, toggleTheme, exportBackup, cloud, familyMode } = useFamily();
const { active, label, lastSynced, busy, online, state } = cloud;
const route = useRoute();
const browserOnline = shallowRef(navigator.onLine);
const disconnected = computed(() => !browserOnline.value || (active.value && !online.value));

function handleOnline() {
  browserOnline.value = true;
}

function handleOffline() {
  browserOnline.value = false;
}

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});

const navigation = [
  { to: '/', label: '今日陪伴', icon: 'home' },
  { to: '/tasks', label: '日常计划', icon: 'calendar' },
  { to: '/pregnancy', label: '孕期记录', icon: 'heart' },
  { to: '/ledger', label: '家庭账本', icon: 'wallet' },
  { to: '/family', label: '我的家庭', icon: 'heart' },
] as const;

const section = computed(
  () => navigation.find((item) => item.to === route.path)?.label ?? '24Years',
);
</script>

<template>
  <a
    class="skip-link"
    href="#main-content"
  >
    跳到主要内容
  </a>
  <div class="app-layout">
    <AppSidebar
      :navigation="navigation"
      :current-path="route.path"
      :profile="data.profile"
      :family-mode="familyMode"
      :active="active"
    />
    <div class="main-wrap">
      <header class="topbar">
        <span class="breadcrumb">
          我的陪伴空间
          <span>/</span>
          <strong>{{ section }}</strong>
        </span>
        <span class="mobile-brand">24Years</span>
        <div class="top-actions">
          <RouterLink
            v-if="!active"
            to="/login"
            class="text-button"
          >
            登录
          </RouterLink>
          <span class="local-badge">
            <i />
            {{ label }}
          </span>
          <button
            class="icon-button"
            :aria-label="data.theme === 'light' ? '切换夜间模式' : '切换日间模式'"
            @click="toggleTheme"
          >
            <AppIcon :name="data.theme === 'light' ? 'moon' : 'sun'" />
          </button>
        </div>
      </header>
      <div
        v-if="disconnected"
        class="offline-notice"
        role="status"
        aria-live="polite"
      >
        {{
          active
            ? state.family
              ? '无法连接云端：正在显示最近同步的只读快照，恢复连接后可同步最新记录。'
              : '无法连接云端：没有可用的家庭快照；恢复连接后可同步记录。'
            : '当前离线：已缓存的应用页面可以打开，本机记录仍保存在当前浏览器。'
        }}
      </div>
      <div
        v-if="error"
        class="storage-error"
        role="alert"
      >
        {{ error }}
        <button
          v-if="active"
          class="text-button"
          :disabled="busy"
          @click="cloud.refresh"
        >
          同步最新记录
        </button>
        <button
          class="text-button"
          @click="exportBackup"
        >
          导出原始备份
        </button>
      </div>
      <main
        id="main-content"
        class="main-content"
        tabindex="-1"
      >
        <slot />
      </main>
      <footer class="page-footer">
        <RouterLink
          to="/backup"
          class="text-button"
        >
          导入 / 导出备份
        </RouterLink>
        <AppIcon
          name="shield"
          :size="15"
        />
        {{
          active
            ? `记录保存到服务端 · 最近同步 ${lastSynced || '尚未完成'}`
            : '记录仅保存在当前浏览器，请定期导出备份。'
        }}
        <span>24Years · 每一程，都有陪伴</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.main-wrap {
  margin-left: 238px;
}

.topbar {
  height: 88px;
  padding: 0 44px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.breadcrumb {
  font-size: 12px;
  color: var(--muted);
}

.breadcrumb span {
  margin: 0 14px;
  color: var(--border);
}

.breadcrumb strong {
  font-weight: 400;
  color: var(--text-secondary);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.local-badge {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 7px;
}

.local-badge i {
  height: 5px;
  width: 5px;
  background: var(--green);
  border-radius: 50%;
}

.main-content {
  max-width: 1260px;
  margin: auto;
  padding: 40px 44px 25px;
}

.page-footer {
  flex-wrap: wrap;
  max-width: 1260px;
  margin: auto;
  padding: 16px 44px 28px;
  display: flex;
  gap: 7px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}

.page-footer span {
  margin-left: auto;
}

.storage-error {
  background: var(--pink-light);
  color: var(--primary-ink);
  padding: 16px 32px;
  font-size: 14px;
}

.offline-notice {
  padding: 12px 32px;
  background: var(--pink-light);
  color: var(--primary-ink);
  font-size: 13px;
}

.mobile-brand {
  display: none;
}

@media (max-width: 1100px) {
  .main-wrap {
    margin-left: 205px;
  }

  .main-content {
    padding: 30px 25px;
  }

  .topbar {
    padding-inline: 25px;
  }

  .page-footer {
    padding-inline: 25px;
  }

  .page-footer span {
    display: none;
  }
}

@media (max-width: 760px) {
  .main-wrap {
    margin: 0;
    padding-bottom: 78px;
  }

  .topbar {
    height: 70px;
    padding-inline: 20px;
  }

  .breadcrumb {
    display: none;
  }

  .mobile-brand {
    display: inline;
    font:
      26px Georgia,
      serif;
  }

  .main-content {
    padding: 26px 18px 16px;
  }

  .offline-notice {
    padding-inline: 18px;
  }

  .page-footer {
    padding: 15px 18px;
    font-size: 12px;
  }

  .top-actions {
    gap: 12px;
  }
}
</style>
