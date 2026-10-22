<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { useFamily } from '@/composables/useFamily';
import AppIcon from './AppIcon.vue';

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
];

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
    <aside class="sidebar">
      <RouterLink
        to="/"
        class="brand"
        aria-label="24Years 首页"
      >
        <span class="brand-symbol">
          <AppIcon
            name="leaf"
            :size="25"
          />
        </span>
        <span>
          <!-- prettier-ignore -->
          <span>24<span class="brand-years">Years</span></span>
          <small>把陪伴，写成时光。</small>
        </span>
      </RouterLink>
      <div class="sidebar-label">OUR LITTLE JOURNEY</div>
      <nav
        class="primary-nav"
        aria-label="主导航"
      >
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :class="{ selected: route.path === item.to }"
        >
          <AppIcon :name="item.icon" />
          <span>{{ item.label }}</span>
          <span class="nav-dot" />
        </RouterLink>
      </nav>
      <div class="sidebar-note">
        <AppIcon
          name="leaf"
          :size="28"
        />
        <p>
          {{ data.profile?.quietMode ? '留一点空间，给自己。' : '慢慢长大，好好陪伴。' }}
        </p>
        <span>每一种节奏，都值得被尊重。</span>
        <div class="journey-line">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div class="journey-labels">
          <span>今天</span>
          <span>未来</span>
        </div>
      </div>
      <RouterLink
        to="/family"
        class="family-mini"
      >
        <span class="avatar">{{ data.profile?.nickname.slice(0, 1) || '家' }}</span>
        <div>
          <strong>{{ data.profile?.name || '我们的家' }}</strong>
          <small>
            {{
              familyMode === 'couple'
                ? active
                  ? '多人协作 · 一起陪伴'
                  : '多人家庭 · 待开启同步'
                : active
                  ? '账号同步 · 独立记录'
                  : '单人记录 · 随时开始'
            }}
          </small>
        </div>
        <AppIcon
          name="arrow"
          :size="18"
        />
      </RouterLink>
    </aside>
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

.sidebar {
  width: 238px;
  position: fixed;
  inset: 0 auto 0 0;
  border-right: 1px solid var(--border);
  padding: 38px 24px 24px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  z-index: 20;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 31px;
  font-family: Georgia, serif;
  font-weight: 700;
}

.brand-years {
  font-weight: 400;
}

.brand-symbol {
  color: var(--primary);
  transform: rotate(-14deg);
}

.brand small {
  display: block;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--muted);
  font-weight: 400;
  margin-top: 5px;
}

.sidebar-label {
  color: var(--muted);
  font-size: 12px;
  margin: 57px 10px 20px;
}

.primary-nav {
  display: grid;
  gap: 10px;
}

.primary-nav a {
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: 12px;
  padding: 15px;
  font-size: 14px;
  color: var(--text-secondary);
  min-height: 52px;
}

.primary-nav a:hover {
  background: var(--canvas);
}

.primary-nav a.selected {
  background: var(--pink-light);
  color: var(--primary-ink);
  font-weight: 600;
}

.nav-dot {
  margin-left: auto;
  height: 5px;
  width: 5px;
  border-radius: 50%;
}

.selected .nav-dot {
  background: var(--primary);
}

.sidebar-note {
  margin: auto 10px 35px;
  padding-top: 60px;
  color: var(--green);
}

.sidebar-note p {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 25px;
  line-height: 1.8;
  max-width: 150px;
  margin-top: 15px;
}

.sidebar-note > span {
  font-size: 12px;
  color: var(--muted);
}

.journey-line {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  margin-top: 25px;
}

.journey-line i {
  width: 5px;
  height: 5px;
  background: var(--border);
  border-radius: 50%;
  margin-top: -3px;
}

.journey-line i:first-child {
  background: var(--primary);
  width: 7px;
  height: 7px;
  margin-top: -4px;
}

.journey-labels {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
  margin-top: 7px;
}

.family-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 23px;
}

.family-mini strong {
  display: block;
  max-width: 115px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.family-mini small {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.family-mini > svg {
  margin-left: auto;
}

.avatar {
  background: var(--green-light);
  color: var(--green);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
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
  .sidebar {
    width: 205px;
    padding-inline: 18px;
  }

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

  .sidebar {
    position: fixed;
    inset: auto 0 0;
    width: auto;
    padding: 4px 10px max(6px, env(safe-area-inset-bottom));
    border-right: 0;
    border-top: 1px solid var(--border);
  }

  .brand,
  .sidebar-label,
  .sidebar-note,
  .family-mini {
    display: none;
  }

  .primary-nav {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .primary-nav a {
    flex-direction: column;
    padding: 9px 2px;
    gap: 5px;
    font-size: 12px;
    border-radius: 9px;
  }

  .nav-dot {
    display: none;
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
