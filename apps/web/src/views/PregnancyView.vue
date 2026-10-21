<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useFamily } from '@/composables/useFamily';
import CheckupsPanel from '@/components/pregnancy/CheckupsPanel.vue';
import VitalsPanel from '@/components/pregnancy/VitalsPanel.vue';
import ContractionsPanel from '@/components/pregnancy/ContractionsPanel.vue';
import MedicalCardPanel from '@/components/pregnancy/MedicalCardPanel.vue';

const { data, locked, cloud } = useFamily();
const route = useRoute();
const tabs = [
  { id: 'checkups', label: '产检安排', component: CheckupsPanel },
  { id: 'vitals', label: '体征记录', component: VitalsPanel },
  { id: 'contractions', label: '宫缩计时', component: ContractionsPanel },
  { id: 'medical', label: '就医卡', component: MedicalCardPanel },
];
const selected = computed(() => tabs.find((item) => item.id === route.query.tab) ?? tabs[0]);
</script>

<template>
  <div class="fade-in">
    <header class="page-heading">
      <div>
        <p class="eyebrow">CARE AT YOUR OWN PACE</p>
        <h1>孕期记录</h1>
        <p>把安排和身体的变化轻轻记下，就医时多一份从容。</p>
      </div>
    </header>
    <section
      v-if="!data.profile"
      class="panel empty-state"
    >
      <h2>先建立自己的陪伴档案</h2>
      <p>保存家庭档案后，就可以开始记录。</p>
      <RouterLink
        to="/family"
        class="button button-primary"
      >
        建立家庭档案
      </RouterLink>
    </section>
    <template v-else>
      <p
        v-if="locked"
        class="muted"
      >
        {{
          cloud.role.value === 'viewer'
            ? '你有查看权限，记录由家庭管理员和共同编辑维护。'
            : '当前暂不可编辑，请等待同步完成或检查账号状态。'
        }}
      </p>
      <nav
        class="pregnancy-tabs"
        aria-label="孕期记录分类"
      >
        <RouterLink
          v-for="item in tabs"
          :key="item.id"
          :to="{ path: '/pregnancy', query: { tab: item.id } }"
          :class="{ selected: selected.id === item.id }"
          :aria-current="selected.id === item.id ? 'page' : undefined"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <component :is="selected.component" />
    </template>
  </div>
</template>

<style>
.pregnancy-tabs {
  display: flex;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 14px;
  margin-bottom: 24px;
}

.pregnancy-tabs a {
  flex: 1;
  text-align: center;
  padding: 14px 6px;
  border-radius: 9px;
  font-size: 14px;
}

.pregnancy-tabs a.selected {
  background: var(--green-light);
  color: var(--green);
  font-weight: 600;
}

.pregnancy-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.record-fields {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: grid;
  gap: 18px;
}

.record-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.record-list li {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}

.record-list li:first-child {
  padding-top: 0;
}

.record-list li:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.record-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  overflow-wrap: anywhere;
}

.record-heading strong {
  min-width: 0;
  font-size: 15px;
  line-height: 1.8;
}

.record-heading .tag {
  flex-shrink: 0;
}

.record-list .muted {
  margin: 10px 0;
  font-size: 13px;
}

.record-notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.8;
}

.record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 14px;
}

.check-option {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.check-option input {
  width: 18px;
  height: 18px;
  accent-color: var(--green);
}

.pregnancy-columns .muted {
  font-size: 13px;
  line-height: 1.9;
}

@media (max-width: 980px) {
  .pregnancy-columns {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 480px) {
  .pregnancy-tabs a {
    font-size: 13px;
  }

  .pregnancy-columns .panel {
    padding: 20px;
  }
}
</style>
