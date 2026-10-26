<script setup lang="ts">
import { computed } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { pregnancyOutcome, type PregnancyRecord } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';
import JourneyCard from './JourneyCard.vue';
import GettingStarted from './GettingStarted.vue';
import DashboardAside from './DashboardAside.vue';
import TaskList from '@/components/tasks/TaskList.vue';

const { data, today, todayTasks, toggleTask, locked, cloud, familyMode } = useFamily();
const { state } = cloud;

const outcome = computed(() => pregnancyOutcome(data.value.pregnancyRecords));
const postpartum = computed(() =>
  data.value.pregnancyRecords?.find((item) => item.type === 'postpartum'),
);
const nextCheckup = computed(
  () =>
    (data.value.pregnancyRecords ?? [])
      .filter(
        (item): item is Extract<PregnancyRecord, { type: 'checkup' }> =>
          item.type === 'checkup' && !item.completed,
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0],
);

const completed = computed(
  () => todayTasks.value.filter((task) => task.completedDates.includes(today.value)).length,
);

const dateLabel = computed(() =>
  new Date(`${today.value}T12:00:00`).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }),
);
</script>

<template>
  <div class="fade-in">
    <header class="page-heading">
      <div>
        <p class="eyebrow">A LITTLE CARE, EVERY DAY</p>
        <h1>
          {{
            state.user?.nickname || data.profile?.nickname
              ? `${state.user?.nickname || data.profile?.nickname}，今天也要好好的`
              : '你好，欢迎来到 24Years'
          }}
        </h1>
        <p>
          {{
            data.profile?.quietMode
              ? '把时间留给自己，不必完成任何期待。'
              : '把平凡的一天，过成值得珍藏的小事。'
          }}
        </p>
      </div>
      <span class="today-date">
        <AppIcon
          name="calendar"
          :size="16"
        />
        {{ dateLabel }}
      </span>
    </header>
    <div class="dashboard-grid">
      <div class="dashboard-main">
        <GettingStarted />
        <JourneyCard
          :profile="data.profile"
          :today="today"
          :outcome="outcome"
          :children="data.children"
        />
        <section
          v-if="data.profile && !data.profile.quietMode && !outcome"
          class="panel"
        >
          <div class="panel-heading">
            <h2>下一次产检</h2>
            <RouterLink
              class="text-button"
              to="/pregnancy"
            >
              查看孕期记录
            </RouterLink>
          </div>
          <p v-if="nextCheckup">{{ nextCheckup.date }} · {{ nextCheckup.title }}</p>
          <p
            v-else
            class="muted"
          >
            还没有待办产检，按医生建议安排即可。
          </p>
        </section>
        <section
          v-if="outcome?.kind === 'birth' && !data.profile?.quietMode"
          class="panel"
        >
          <div class="panel-heading">
            <h2>接下来的照护安排</h2>
            <RouterLink
              class="text-button"
              to="/pregnancy?tab=postpartum"
            >
              管理产后交接
            </RouterLink>
          </div>
          <p>产后复诊：{{ postpartum?.followupDate || '尚未填写，按出院医嘱安排' }}</p>
          <p>新生儿随访：{{ postpartum?.newbornFollowupDate || '尚未填写，按医嘱安排' }}</p>
        </section>
        <section
          v-if="!data.profile?.quietMode"
          class="panel"
        >
          <div class="panel-heading">
            <div class="section-title">
              <span class="section-accent" />
              <h2>今日的小计划</h2>
              <span class="count">{{ completed }}/{{ todayTasks.length }}</span>
            </div>
            <RouterLink
              to="/tasks"
              class="text-button"
            >
              <AppIcon
                name="plus"
                :size="15"
              />
              添加计划
            </RouterLink>
          </div>
          <TaskList
            :tasks="todayTasks"
            :date="today"
            :disabled="locked"
            @toggle="toggleTask($event, today)"
          />
          <p class="task-footnote">留一点时间照顾自己，也是一件重要的事。</p>
        </section>
        <section
          v-else
          class="panel quiet-message"
        >
          <AppIcon
            name="leaf"
            :size="28"
          />
          <div>
            <h2>这里一直为你留着位置</h2>
            <p class="muted">你的资料与历史记录不会被删除。首页不会展示孕周、倒计时或任务提示。</p>
          </div>
        </section>
      </div>
      <DashboardAside
        :profile="data.profile"
        :expenses="data.expenses"
        :family-mode="familyMode"
        :shared-family="state.family"
      />
    </div>
  </div>
</template>

<style scoped>
.today-date {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 285px;
  gap: 25px;
}

.dashboard-main {
  min-width: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-accent {
  width: 3px;
  height: 16px;
  background: var(--green);
  border-radius: 3px;
}

.count {
  font-size: 12px;
  color: var(--muted);
}

.task-footnote {
  padding-top: 18px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--muted);
  margin: 18px 0 0;
}

.quiet-message {
  display: flex;
  gap: 20px;
}

.quiet-message > svg {
  flex-shrink: 0;
  color: var(--green);
}

.quiet-message p {
  margin-top: 15px;
}

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 20px;
  }

  .today-date {
    display: none;
  }
}

@media (max-width: 950px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .section-title {
    gap: 6px;
  }

  .section-title h2 {
    font-size: 16px;
  }
}
</style>
