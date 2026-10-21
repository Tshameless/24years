<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useFamily } from '@/composables/useFamily';
import CheckupsPanel from '@/components/pregnancy/CheckupsPanel.vue';
import VitalsPanel from '@/components/pregnancy/VitalsPanel.vue';
import ContractionsPanel from '@/components/pregnancy/ContractionsPanel.vue';
import MedicalCardPanel from '@/components/pregnancy/MedicalCardPanel.vue';
import BondingPanel from '@/components/pregnancy/BondingPanel.vue';
import PackingPanel from '@/components/pregnancy/PackingPanel.vue';
import '@/assets/pregnancy.css';
import CareJournal from '@/components/pregnancy/CareJournal.vue';

const { data, locked, cloud } = useFamily();
const route = useRoute();
const tabs = [
  { id: 'bonding', label: '胎教陪伴', component: BondingPanel },
  { id: 'mood', label: '心情日记', component: CareJournal },
  { id: 'packing', label: '待产清单', component: PackingPanel },
  { id: 'checkups', label: '产检安排', component: CheckupsPanel },
  { id: 'vitals', label: '体征记录', component: VitalsPanel },
  { id: 'contractions', label: '宫缩计时', component: ContractionsPanel },
  { id: 'medical', label: '就医卡', component: MedicalCardPanel },
];
const selected = computed(() => tabs.find((item) => item.id === route.query.tab) ?? tabs[3]);
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
          class="pregnancy-tab"
          :class="{ selected: selected.id === item.id }"
          :aria-current="selected.id === item.id ? 'page' : undefined"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <CareJournal
        v-if="selected.component === CareJournal"
        :key="selected.id"
        kind="mood"
      />
      <component
        :is="selected.component"
        v-else
      />
    </template>
  </div>
</template>

<style scoped>
.pregnancy-tabs {
  flex-wrap: wrap;
  display: flex;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 14px;
  margin-bottom: 24px;
}

.pregnancy-tab {
  flex: 1 0 100px;
  text-align: center;
  padding: 14px 6px;
  border-radius: 9px;
  font-size: 14px;
}

.pregnancy-tab.selected {
  background: var(--green-light);
  color: var(--green);
  font-weight: 600;
}

@media (max-width: 480px) {
  .pregnancy-tab {
    font-size: 13px;
  }
}
</style>
