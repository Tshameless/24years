<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { pregnancyOutcome } from '@/domain/family';
import { useFamily } from '@/composables/useFamily';

const { data, cloud } = useFamily();
const { ready } = cloud;
const dismissed = shallowRef(readDismissed());
const guideAllowed = computed(
  () =>
    ready.value &&
    Boolean(data.value.profile) &&
    !data.value.profile?.quietMode &&
    !pregnancyOutcome(data.value.pregnancyRecords),
);

function readDismissed() {
  try {
    return localStorage.getItem('24years.getting-started.dismissed') === 'true';
  } catch {
    return false;
  }
}

const steps = computed(() => {
  const profileReady = Boolean(data.value.profile);
  const hasTask = data.value.tasks.length > 0;
  const hasCheckup = data.value.pregnancyRecords.some(
    (record) => record.type === 'checkup',
  );

  return [
    {
      id: 'profile',
      title: '建立家庭档案',
      description: '填写你喜欢的称呼和当前孕周。',
      action: '去建档',
      to: '/family',
      complete: profileReady,
      locked: false,
    },
    {
      id: 'task',
      title: '添加一项日常计划',
      description: '记下一件希望自己记得做的小事。',
      action: '创建第一项计划',
      to: '/tasks',
      complete: hasTask,
      locked: !profileReady,
    },
    {
      id: 'checkup',
      title: '记录下一次产检',
      description: '保存日期与名称，之后可在首页快速查看。',
      action: '添加产检',
      to: { path: '/pregnancy', query: { tab: 'checkups' } },
      complete: hasCheckup,
      locked: !profileReady,
    },
  ];
});

const completedCount = computed(() => steps.value.filter((step) => step.complete).length);

function hide() {
  dismissed.value = true;

  try {
    localStorage.setItem('24years.getting-started.dismissed', 'true');
  } catch {
    // Keep the current-session choice if browser storage is unavailable.
  }
}

function show() {
  dismissed.value = false;

  try {
    localStorage.removeItem('24years.getting-started.dismissed');
  } catch {
    // The guide remains open for this session.
  }
}
</script>

<template>
  <section
    v-if="guideAllowed && !dismissed"
    class="panel getting-started"
    aria-labelledby="getting-started-title"
  >
    <div class="guide-heading">
      <div>
        <p class="eyebrow">YOUR FIRST STEPS</p>
        <h2 id="getting-started-title">从这里开始</h2>
        <p class="muted">跟着这几步熟悉日常流程；随时可以跳过，之后也能重新打开。</p>
      </div>
      <div class="guide-heading-actions">
        <span class="tag">已完成 {{ completedCount }} / {{ steps.length }}</span>
        <button
          class="text-button"
          type="button"
          @click="hide"
        >
          收起指引
        </button>
      </div>
    </div>
    <ol class="guide-steps">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="guide-step"
        :class="{ complete: step.complete, locked: step.locked }"
      >
        <span
          class="step-number"
          :aria-label="step.complete ? '已完成' : `第 ${index + 1} 步`"
        >
          {{ step.complete ? '✓' : index + 1 }}
        </span>
        <div class="step-copy">
          <strong>{{ step.title }}</strong>
          <p>{{ step.description }}</p>
        </div>
        <RouterLink
          v-if="!step.complete && !step.locked"
          class="text-button guide-action"
          :to="step.to"
        >
          {{ step.action }}
          <span aria-hidden="true">→</span>
        </RouterLink>
        <span
          v-else-if="step.complete"
          class="step-status"
        >
          已完成
        </span>
        <span
          v-else
          class="step-status"
        >
          先完成建档
        </span>
      </li>
    </ol>
    <p
      v-if="completedCount === steps.length"
      class="guide-finish"
    >
      基础流程已完成。其他功能可以按需要慢慢探索。
    </p>
  </section>
  <button
    v-else-if="guideAllowed"
    class="text-button guide-reopen"
    type="button"
    @click="show"
  >
    展开首次使用指引
  </button>
</template>

<style scoped>
.getting-started {
  margin-bottom: 24px;
}

.guide-heading,
.guide-heading-actions,
.guide-step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.guide-heading {
  align-items: flex-start;
  margin-bottom: 20px;
}

.guide-heading .eyebrow {
  margin-bottom: 8px;
}

.guide-heading h2 {
  margin-bottom: 8px;
}

.guide-heading .muted {
  margin-bottom: 0;
  font-size: 13px;
}

.guide-heading-actions {
  flex-shrink: 0;
}

.guide-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.guide-step {
  justify-content: flex-start;
  min-height: 64px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--canvas);
}

.step-number {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--green);
  background: var(--green-light);
  font-size: 13px;
  font-weight: 600;
}

.step-copy {
  min-width: 0;
  flex: 1;
}

.step-copy strong {
  font-size: 14px;
}

.step-copy p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.guide-step.complete .step-copy strong,
.step-status {
  color: var(--green);
}

.guide-step.locked {
  opacity: 62%;
}

.step-status {
  flex-shrink: 0;
  font-size: 12px;
}

.guide-action {
  flex-shrink: 0;
}

.guide-finish {
  margin: 16px 0 0;
  color: var(--green);
  font-size: 13px;
}

.guide-reopen {
  margin: -8px 0 24px;
}

@media (max-width: 600px) {
  .guide-heading,
  .guide-heading-actions {
    align-items: flex-start;
  }

  .guide-heading {
    flex-direction: column;
    gap: 8px;
  }

  .guide-heading-actions {
    width: 100%;
    justify-content: space-between;
  }

  .guide-step {
    align-items: flex-start;
    gap: 10px;
  }

  .guide-action,
  .step-status {
    align-self: center;
  }
}
</style>
