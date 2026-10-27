<script setup lang="ts">
import { computed } from 'vue';
import type { FamilyProfile } from '@/domain/family';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  navigation: readonly { to: string; label: string; icon: string }[];
  currentPath: string;
  profile: FamilyProfile | null;
  familyMode: 'single' | 'couple';
  active: boolean;
}>();
const hasGrowthArchive = computed(() => props.navigation.some((item) => item.to === '/children'));
</script>

<template>
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
      :class="{ 'has-growth-archive': hasGrowthArchive }"
      aria-label="主导航"
    >
      <RouterLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        :class="{ selected: currentPath === item.to }"
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
        {{ profile?.quietMode ? '留一点空间，给自己。' : '慢慢长大，好好陪伴。' }}
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
      <span class="avatar">{{ profile?.nickname.slice(0, 1) || '家' }}</span>
      <div>
        <strong>{{ profile?.name || '我们的家' }}</strong>
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
</template>

<style scoped>
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

@media (max-width: 1100px) {
  .sidebar {
    width: 205px;
    padding-inline: 18px;
  }
}

@media (max-width: 760px) {
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

  .primary-nav.has-growth-archive {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .primary-nav a {
    flex-direction: column;
    padding: 9px 2px;
    gap: 5px;
    font-size: 12px;
    border-radius: 9px;
    min-width: 0;
    white-space: nowrap;
  }

  .primary-nav.has-growth-archive a {
    padding-inline: 0;
    font-size: 11px;
  }

  .nav-dot {
    display: none;
  }
}
</style>
