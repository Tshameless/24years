<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import {
  dayDifference,
  formatChildAge,
  pregnancyProgress,
  type Child,
  type PregnancyOutcome,
  type FamilyProfile,
} from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';

const props = defineProps<{
  profile: FamilyProfile | null;
  today: string;
  outcome?: PregnancyOutcome | null;
  children?: readonly Child[];
}>();

const selectedChildIndex = shallowRef(0);
const activeChild = computed(() => {
  const list = props.children ?? [];

  return list[selectedChildIndex.value] ?? list[0] ?? null;
});

const childAge = computed(() =>
  activeChild.value ? formatChildAge(activeChild.value.birthDate, props.today) : null,
);

const progress = computed(() =>
  props.profile ? pregnancyProgress(props.profile.dueDate, props.today) : null,
);
</script>

<template>
  <section
    class="journey-card"
    :class="{ quiet: profile?.quietMode }"
  >
    <div class="journey-copy">
      <template v-if="profile?.quietMode">
        <span class="journey-tag">
          <AppIcon
            name="leaf"
            :size="14"
          />
          静默关怀已开启
        </span>
        <h2>
          不必赶路，
          <br />
          按自己的节奏来。
        </h2>
        <p>
          孕周与每日任务已在首页隐藏。
          <br />
          所有记录都在，想回来时随时可以。
        </p>
        <RouterLink
          to="/family"
          class="text-button"
        >
          管理关怀设置
          <AppIcon
            name="arrow"
            :size="16"
          />
        </RouterLink>
      </template>
      <template v-else-if="outcome">
        <span class="journey-tag">
          {{ outcome.kind === 'birth' ? '新的陪伴阶段' : '按自己的节奏来' }}
        </span>
        <h2>
          {{
            outcome.kind === 'birth'
              ? `产后第 ${Math.max(0, dayDifference(today, outcome.date)) + 1} 天`
              : '本次孕期已结束'
          }}
        </h2>
        <p v-if="outcome.kind === 'birth' && activeChild">
          {{ activeChild.name }} · {{ childAge?.label }}（记录日期：{{ outcome.date }}）
        </p>
        <p v-else>记录日期：{{ outcome.date }}。历史记录已保留。</p>
        <div class="journey-actions">
          <RouterLink
            class="button button-primary"
            :to="outcome.kind === 'birth' ? '/pregnancy?tab=postpartum' : '/pregnancy?tab=outcome'"
          >
            {{ outcome.kind === 'birth' ? '查看产后交接' : '查看结束记录' }}
          </RouterLink>
          <RouterLink
            v-if="outcome.kind === 'birth'"
            class="text-button"
            to="/children"
          >
            孩子成长档案
            <AppIcon
              name="arrow"
              :size="16"
            />
          </RouterLink>
        </div>
      </template>
      <template v-else-if="activeChild && childAge">
        <div
          v-if="(children?.length ?? 0) > 1"
          class="child-tabs"
        >
          <button
            v-for="(child, idx) in children"
            :key="child.id"
            type="button"
            class="child-tab-pill"
            :class="{ active: selectedChildIndex === idx }"
            @click="selectedChildIndex = idx"
          >
            {{ child.name }}
          </button>
        </div>
        <span class="journey-tag">
          <AppIcon
            name="heart"
            :size="14"
          />
          陪伴成长的每一天
        </span>
        <h2>{{ activeChild.name }} · {{ childAge.label }}</h2>
        <p>出生日期：{{ activeChild.birthDate }} · 祝宝宝健康成长</p>
        <RouterLink
          to="/family"
          class="button button-primary"
        >
          查看家庭档案
          <AppIcon
            name="arrow"
            :size="17"
          />
        </RouterLink>
      </template>
      <template v-else-if="profile && progress">
        <span class="journey-tag">
          <AppIcon
            name="heart"
            :size="14"
          />
          每一天，都是新的相遇
        </span>
        <h2 class="gestation">
          孕
          <strong class="numbers">{{ progress.weeks }}</strong>
          周
          <strong class="numbers">{{ progress.days }}</strong>
          天
        </h2>
        <p v-if="progress.remaining > 0">
          距离预产期还有
          <strong>{{ progress.remaining }}</strong>
          天
        </p>
        <p v-else-if="progress.remaining === 0">今天是预产期 · 请以医生安排为准</p>
        <p v-else>已过预产期 {{ -progress.remaining }} 天 · 请按医嘱随访</p>
        <div
          class="journey-progress"
          role="progressbar"
          :aria-valuenow="Math.round(progress.percent)"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="孕期日历进度"
        >
          <span :style="{ width: `${progress.percent}%` }" />
        </div>
        <div class="progress-labels">
          <span>旅程开始</span>
          <span>预产期 {{ profile.dueDate }}</span>
        </div>
        <small>按档案日期推算，仅作日历参考，不替代临床评估。</small>
      </template>
      <template v-else>
        <span class="journey-tag">
          <AppIcon
            name="heart"
            :size="14"
          />
          OUR LITTLE BEGINNING
        </span>
        <h2>
          从一份小小的期待，
          <br />
          开始长长的陪伴。
        </h2>
        <p>
          先建立档案，再添加一项计划或安排产检。
          <br />
          其他工具可以按需要慢慢探索。
        </p>
        <RouterLink
          to="/family"
          class="button button-primary"
        >
          {{ profile ? '检查怀孕时期' : '建立我的家庭档案' }}
          <AppIcon
            name="arrow"
            :size="17"
          />
        </RouterLink>
      </template>
    </div>
  </section>
</template>

<style scoped>
.journey-card {
  background: var(--pink-light);
  border: 1px solid color-mix(in srgb, var(--primary) 13%, transparent);
  border-radius: 18px;
  min-height: 318px;
  display: flex;
  padding: 34px;
  margin-bottom: 25px;
}

.journey-card.quiet {
  background: var(--green-light);
}

.journey-copy {
  width: 100%;
}

.journey-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--primary-ink);
  font-size: 12px;
  margin-bottom: 22px;
}

.quiet .journey-tag {
  color: var(--green);
}

.journey-copy h2 {
  font: 600 30px/1.6 var(--font-serif);
  margin-bottom: 15px;
}

.journey-copy p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.9;
  margin-bottom: 20px;
}

.journey-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.journey-copy .gestation {
  font-family: var(--font-sans);
  font-size: 20px;
}

.gestation strong {
  font-size: 44px;
  font-weight: 500;
}

.journey-progress {
  height: 5px;
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  border-radius: 10px;
  width: 100%;
  margin-top: 30px;
  overflow: hidden;
}

.journey-progress span {
  height: 100%;
  background: var(--primary);
  border-radius: inherit;
  display: block;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 10px 0 17px;
}

.child-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.child-tab-pill {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.child-tab-pill.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.journey-copy small {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1050px) {
  .journey-copy h2 {
    font-size: 27px;
  }
}

@media (max-width: 760px) {
  .journey-card {
    padding: 25px 22px;
    min-height: 305px;
  }

  .journey-copy h2 {
    font-size: 26px;
  }

  .journey-copy p {
    font-size: 14px;
  }
}
</style>
