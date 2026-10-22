<script setup lang="ts">
import { computed } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { pregnancyOutcome } from '@/domain/family';

const { data } = useFamily();
const outcome = computed(() => pregnancyOutcome(data.value.pregnancyRecords));
const stages = [
  {
    title: '建档与早期安排',
    description: '保存孕期日历、就诊地点和联系人；把医护团队建议的检查记入安排。',
    links: [
      { label: '家庭档案', to: '/family' },
      { label: '就医卡', to: '/pregnancy?tab=medical' },
      { label: '产检安排', to: '/pregnancy?tab=checkups' },
    ],
  },
  {
    title: '孕期日常与持续随访',
    description: '根据需要留下体征、胎动、心情和陪伴记录；日期与观察方式以医嘱为准。',
    links: [
      { label: '体征记录', to: '/pregnancy?tab=vitals' },
      { label: '胎动记录', to: '/pregnancy?tab=movements' },
      { label: '心情日记', to: '/pregnancy?tab=mood' },
      { label: '胎教陪伴', to: '/pregnancy?tab=bonding' },
    ],
  },
  {
    title: '待产准备与分娩沟通',
    description: '整理物品和家庭分工，提前讨论分娩意愿；需要时使用宫缩计时并联系就医团队。',
    links: [
      { label: '待产清单', to: '/pregnancy?tab=packing' },
      { label: '分娩沟通计划', to: '/pregnancy?tab=birth-plan' },
      { label: '宫缩计时', to: '/pregnancy?tab=contractions' },
    ],
  },
  {
    title: '分娩与孕期归档',
    description: '确认实际结束日期后停止孕期倒计时，保留历史资料；其他原因结束时进入静默关怀。',
    links: [{ label: '分娩与孕期结束', to: '/pregnancy?tab=outcome' }],
  },
  {
    title: '产后交接与家庭照护',
    description: '按出院交代记录恢复、喂养、复诊和照护支持，继续处理日常计划、费用与报销。',
    links: [
      { label: '产后交接', to: '/pregnancy?tab=postpartum' },
      { label: '照护计划', to: '/tasks' },
      { label: '费用与报销', to: '/ledger' },
      { label: '备份全部资料', to: '/family' },
    ],
  },
];
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <h2>全周期总览</h2>
      <span class="tag">{{ outcome ? '孕期已结束' : '孕期进行中' }}</span>
    </div>
    <p class="muted">
      这里串联本次孕期的记录和交接，不设必须完成的打卡，也不自动生成医疗检查或治疗方案。
    </p>
    <ol class="cycle-stages">
      <li
        v-for="stage in stages"
        :key="stage.title"
      >
        <h3>{{ stage.title }}</h3>
        <p>{{ stage.description }}</p>
        <div class="form-actions">
          <RouterLink
            v-for="link in stage.links"
            :key="link.to"
            class="text-button"
            :to="link.to"
          >
            {{ link.label }} →
          </RouterLink>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.cycle-stages {
  display: grid;
  gap: 24px;
  margin: 24px 0 0;
  padding-left: 24px;
}

.cycle-stages li {
  padding: 0 0 24px 8px;
  border-bottom: 1px solid var(--border);
}

.cycle-stages li:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.cycle-stages p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.8;
}

.cycle-stages h3 {
  margin: 0;
  font-size: 16px;
}
</style>
