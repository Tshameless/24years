<script setup lang="ts">
import { computed } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { pregnancyOutcome, pregnancyProgress } from '@/domain/family';

const { data, today } = useFamily();
const outcome = computed(() => pregnancyOutcome(data.value.pregnancyRecords));
const progress = computed(() =>
  data.value.profile ? pregnancyProgress(data.value.profile.dueDate, today.value) : null,
);
const companionCard = computed(() => {
  const week = progress.value?.weeks ?? 0;

  if (week >= 37) {
    return {
      title: '本周陪伴行动：出发准备',
      items: [
        '核对待产包、证件和就医卡',
        '确认夜间入口、停车和接送路线',
        '和孕妇确认需要联系的医院与家属',
      ],
    };
  }

  if (week >= 28) {
    return {
      title: '本周陪伴行动：稳定支持',
      items: [
        '按医嘱协助记录血压或胎动',
        '分担采购和家务，留出休息时间',
        '一起确认产检问题和下一次预约',
      ],
    };
  }

  if (week >= 13) {
    return {
      title: '本周陪伴行动：一起准备',
      items: [
        '陪同或协助安排下一次产检',
        '准备水、简单餐食和舒适休息环境',
        '把医生交代的事项记录在家庭计划中',
      ],
    };
  }

  return {
    title: '本周陪伴行动：建立支持',
    items: [
      '确认就医卡和紧急联系人信息',
      '主动询问今天需要的帮助',
      '陪同整理产检资料和想问医生的问题',
    ],
  };
});
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
      { label: '异常与急救', to: '/pregnancy?tab=emergency' },
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
    <section class="companion-card">
      <div class="panel-heading">
        <h3>{{ companionCard.title }}</h3>
        <span class="tag">陪伴建议</span>
      </div>
      <ul>
        <li
          v-for="item in companionCard.items"
          :key="item"
        >
          {{ item }}
        </li>
      </ul>
      <p class="muted">
        按家庭实际情况和医护人员建议调整；单人家庭也可以把这些事项作为自己的提醒。
      </p>
    </section>
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

.companion-card {
  margin: 24px 0 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--pink-light);
}

.companion-card .panel-heading {
  margin-bottom: 10px;
}

.companion-card h3 {
  margin: 0;
  font-size: 15px;
}

.companion-card ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.9;
}

.companion-card .muted {
  margin: 10px 0 0;
  font-size: 12px;
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
