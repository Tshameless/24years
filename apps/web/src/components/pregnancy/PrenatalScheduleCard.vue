<script setup lang="ts">
import { computed } from 'vue';
import { localDate, type PregnancyRecord } from '@/domain/family';
import {
  prenatalSchedule,
  prenatalScheduleState,
  scheduleDate,
  scheduledCheckup,
  type PrenatalScheduleItem,
} from '@/domain/prenatalSchedule';

type Checkup = Extract<PregnancyRecord, { type: 'checkup' }>;

const props = defineProps<{
  dueDate?: string;
  today: string;
  records: readonly PregnancyRecord[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  schedule: [item: PrenatalScheduleItem & { date: string }];
  remind: [checkup: Checkup];
}>();

const scheduleStateLabels = {
  upcoming: '即将到期',
  due: '当前节点',
  past: '参考日期已过',
  scheduled: '已加入安排',
  completed: '已完成',
} as const;

const schedule = computed(() =>
  prenatalSchedule
    .map((item) => ({
      ...item,
      date: scheduleDate(props.dueDate ?? localDate(), item.offsetWeeks),
      checkup: scheduledCheckup(props.records, item),
    }))
    .map((item) => ({
      ...item,
      state: prenatalScheduleState(item.date, props.today, item.checkup),
    })),
);

const scheduleSummary = computed(() => ({
  completed: schedule.value.filter((item) => item.state === 'completed').length,
  scheduled: schedule.value.filter((item) => item.state === 'scheduled').length,
  due: schedule.value.filter((item) => item.state === 'due').length,
  past: schedule.value.filter((item) => item.state === 'past').length,
}));
</script>

<template>
  <div class="schedule-card">
    <div class="schedule-heading">
      <div>
        <h3>孕周产检参考时间轴</h3>
        <p>根据当前预产期估算，仅用于提前整理；最终项目和日期以医院安排为准。</p>
      </div>
      <span class="tag">
        {{ dueDate ? `预产期 ${dueDate}` : '未设置预产期' }}
      </span>
    </div>
    <div
      class="schedule-summary"
      aria-label="产检时间轴进度"
    >
      <span class="schedule-summary-item">
        <strong>{{ scheduleSummary.completed }}</strong>
        已完成
      </span>
      <span class="schedule-summary-item">
        <strong>{{ scheduleSummary.scheduled }}</strong>
        已加入安排
      </span>
      <span
        v-if="scheduleSummary.due"
        class="schedule-summary-item schedule-summary-current"
      >
        <strong>{{ scheduleSummary.due }}</strong>
        当前节点
      </span>
      <span
        v-if="scheduleSummary.past"
        class="schedule-summary-item schedule-summary-past"
      >
        <strong>{{ scheduleSummary.past }}</strong>
        参考日期已过
      </span>
    </div>
    <ol class="schedule-list">
      <li
        v-for="item in schedule"
        :key="item.title"
        :class="`schedule-state-${item.state}`"
      >
        <div>
          <div class="schedule-item-heading">
            <strong>{{ item.week }} · {{ item.title }}</strong>
            <span class="tag">{{ scheduleStateLabels[item.state] }}</span>
          </div>
          <small>预计 {{ item.date }}</small>
          <p>{{ item.guidance }}</p>
        </div>
        <button
          v-if="!item.checkup"
          type="button"
          class="text-button"
          :disabled="disabled"
          @click="emit('schedule', item)"
        >
          {{ item.state === 'past' ? '补记安排' : '加入安排' }}
        </button>
        <button
          v-else-if="!item.checkup.completed"
          type="button"
          class="text-button"
          :disabled="disabled"
          @click="emit('remind', item.checkup)"
        >
          加入提醒
        </button>
        <span
          v-else
          class="schedule-completed-mark"
          aria-label="已完成"
        >
          已完成
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.schedule-card {
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--green-light);
}

.schedule-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.schedule-heading h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.schedule-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 14px;
  padding: 10px 0;
  border-top: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
}

.schedule-summary-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}

.schedule-summary-item strong {
  color: var(--text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.schedule-item-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.schedule-list {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.schedule-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
}

.schedule-list li > div {
  min-width: 0;
  flex: 1;
}

.schedule-completed-mark {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 12px;
}

.schedule-heading p,
.schedule-list p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.schedule-list strong {
  font-size: 13px;
}

.schedule-list small {
  display: block;
  margin: 3px 0;
  color: var(--green);
  font-size: 12px;
}

@media (max-width: 600px) {
  .schedule-heading,
  .schedule-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .schedule-list .text-button {
    justify-content: flex-start;
  }
}
</style>
