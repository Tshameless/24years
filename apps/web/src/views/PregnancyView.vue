<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { pregnancyOutcome } from '@/domain/family';
import { useFamily } from '@/composables/useFamily';
import '@/assets/pregnancy.css';

const BirthPlanPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/BirthPlanPanel.vue'),
);
const OutcomePanel = defineAsyncComponent(() => import('@/components/pregnancy/OutcomePanel.vue'));
const PostpartumPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/PostpartumPanel.vue'),
);
const CycleOverview = defineAsyncComponent(
  () => import('@/components/pregnancy/CycleOverview.vue'),
);
const CheckupsPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/CheckupsPanel.vue'),
);
const VitalsPanel = defineAsyncComponent(() => import('@/components/pregnancy/VitalsPanel.vue'));
const ContractionsPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/ContractionsPanel.vue'),
);
const MedicalCardPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/MedicalCardPanel.vue'),
);
const EmergencyGuidePanel = defineAsyncComponent(
  () => import('@/components/pregnancy/EmergencyGuidePanel.vue'),
);
const BondingPanel = defineAsyncComponent(() => import('@/components/pregnancy/BondingPanel.vue'));
const PackingPanel = defineAsyncComponent(() => import('@/components/pregnancy/PackingPanel.vue'));
const MovementsPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/MovementsPanel.vue'),
);
const CareJournal = defineAsyncComponent(() => import('@/components/pregnancy/CareJournal.vue'));
const NutritionPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/NutritionPanel.vue'),
);
const MentalScreeningPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/MentalScreeningPanel.vue'),
);
const UltrasoundPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/UltrasoundPanel.vue'),
);
const SymptomsPanel = defineAsyncComponent(
  () => import('@/components/pregnancy/SymptomsPanel.vue'),
);

const { data, locked, cloud } = useFamily();
const route = useRoute();
const outcome = computed(() => pregnancyOutcome(data.value.pregnancyRecords));

const tabGroups = [
  {
    id: 'cycle',
    label: '全周期管理',
    description: '从建档到分娩，再到产后交接。',
    tabs: [
      { id: 'overview', label: '全周期总览', component: CycleOverview },
      { id: 'outcome', label: '分娩与孕期结束', component: OutcomePanel },
      { id: 'postpartum', label: '产后交接', component: PostpartumPanel },
    ],
  },
  {
    id: 'daily',
    label: '日常陪伴',
    description: '记录今天的感受与身体变化。',
    tabs: [
      { id: 'bonding', label: '胎教陪伴', component: BondingPanel },
      { id: 'mood', label: '心情日记', component: CareJournal },
      { id: 'nutrition', label: '营养与补剂', component: NutritionPanel },
      { id: 'mental', label: '心理自查', component: MentalScreeningPanel },
      { id: 'movements', label: '胎动记录', component: MovementsPanel },
    ],
  },
  {
    id: 'health',
    label: '产检与健康',
    description: '按医生建议安排检查，留下身体记录。',
    tabs: [
      { id: 'checkups', label: '产检安排', component: CheckupsPanel },
      { id: 'vitals', label: '体征记录', component: VitalsPanel },
      { id: 'ultrasound', label: '超声指标', component: UltrasoundPanel },
      { id: 'symptoms', label: '症状观察', component: SymptomsPanel },
    ],
  },
  {
    id: 'preparation',
    label: '待产与应急',
    description: '提前准备物品，需要时快速找到重要信息。',
    tabs: [
      { id: 'birth-plan', label: '分娩沟通计划', component: BirthPlanPanel },
      { id: 'packing', label: '待产清单', component: PackingPanel },
      { id: 'contractions', label: '宫缩计时', component: ContractionsPanel },
      { id: 'medical', label: '就医卡', component: MedicalCardPanel },
      { id: 'emergency', label: '异常与急救', component: EmergencyGuidePanel },
    ],
  },
];

const tabs = computed(() => tabGroups.flatMap((group) => group.tabs));
const selected = computed(
  () =>
    tabs.value.find((item) => item.id === route.query.tab) ??
    tabs.value.find(
      (item) =>
        item.id ===
        (outcome.value?.kind === 'birth' ? 'postpartum' : outcome.value ? 'outcome' : 'checkups'),
    )!,
);
</script>

<template>
  <div class="fade-in">
    <header class="page-heading">
      <div class="pregnancy-heading-copy">
        <p class="eyebrow">CARE AT YOUR OWN PACE</p>
        <h1>孕期记录</h1>
        <p>把安排和身体的变化轻轻记下，就医时多一份从容。</p>
      </div>
      <div class="pregnancy-emergency-actions">
        <RouterLink to="/pregnancy?tab=emergency" class="button button-secondary">异常与急救</RouterLink>
        <a href="tel:120" class="button emergency-call">拨打 120</a>
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
      <p
        v-if="outcome"
        class="muted"
        role="status"
      >
        本次孕期已于
        {{ outcome.date }}
        结束。孕期历史仅供查阅；可在“分娩与孕期结束”更正状态，分娩后可继续维护产后交接。
      </p>
      <nav
        class="pregnancy-groups"
        aria-label="孕期记录类型"
      >
        <section
          v-for="group in tabGroups"
          :key="group.id"
          class="pregnancy-group"
        >
          <div class="pregnancy-group-heading">
            <h2>{{ group.label }}</h2>
            <p>{{ group.description }}</p>
          </div>
          <div class="pregnancy-group-tabs">
            <RouterLink
              v-for="item in group.tabs"
              :key="item.id"
              :to="{ path: '/pregnancy', query: { tab: item.id } }"
              class="pregnancy-tab"
              :class="{ selected: selected.id === item.id }"
              :aria-current="selected.id === item.id ? 'page' : undefined"
            >
              {{ item.label }}
            </RouterLink>
          </div>
        </section>
      </nav>
      <component
        :is="selected.component"
        v-if="selected.id === 'mood'"
        :key="selected.id"
        kind="mood"
      />
      <component
        :is="selected.component"
        v-else-if="selected.id !== 'mood'"
      />
    </template>
  </div>
</template>

<style scoped>
.pregnancy-groups {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 14px;
  margin-bottom: 24px;
}

.pregnancy-heading-copy {
  min-width: 0;
}

.pregnancy-emergency-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.emergency-call {
  background: var(--primary-ink);
  color: #fff;
}

.pregnancy-group {
  display: grid;
  grid-template-columns: minmax(145px, 0.7fr) minmax(0, 1.8fr);
  gap: 14px;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
}

.pregnancy-group + .pregnancy-group {
  border-top: 1px solid var(--border);
  padding-top: 18px;
}

.pregnancy-group-heading h2 {
  margin-bottom: 5px;
  font-size: 14px;
}

.pregnancy-group-heading p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.pregnancy-group-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pregnancy-tab {
  flex: 1 0 110px;
  text-align: center;
  padding: 12px 8px;
  border-radius: 9px;
  font-size: 14px;
  color: var(--text-secondary);
}

.pregnancy-tab:hover {
  background: var(--canvas);
}

.pregnancy-tab.selected {
  background: var(--green-light);
  color: var(--green);
  font-weight: 600;
}

@media (max-width: 600px) {
  .pregnancy-emergency-actions {
    width: 100%;
  }

  .pregnancy-emergency-actions .button {
    flex: 1 1 140px;
    min-height: 48px;
  }

  .pregnancy-group {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .pregnancy-tab {
    flex-basis: 95px;
    font-size: 13px;
  }
}
</style>
