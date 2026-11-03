<script setup lang="ts">
import { computed } from 'vue';
import type { PregnancyRecord } from '@/domain/family';
import { buildMovementsCsv, summarizeMovementsByDay } from '@/domain/movementSummary';

const props = defineProps<{
  records: readonly PregnancyRecord[];
}>();

const dailySummaries = computed(() => summarizeMovementsByDay(props.records));

function exportCsv() {
  if (!dailySummaries.value.length) {
    return;
  }

  const csv = buildMovementsCsv(props.records);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '24years-fetal-movements.csv';
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section
    v-if="dailySummaries.length"
    class="panel movement-daily-summary"
    aria-label="胎动按日汇总"
  >
    <div class="panel-heading">
      <div>
        <h2>按日胎动观察汇总</h2>
        <p class="muted summary-subtitle">
          按观察日期整理原始观察段数、累计观察分钟与累计记录次数，便于产检时向医生展示，不换算全天数值。
        </p>
      </div>
      <button
        type="button"
        class="text-button"
        @click="exportCsv"
      >
        导出胎动 CSV
      </button>
    </div>
    <div class="summary-table-wrap">
      <table class="summary-table">
        <caption>已保存胎动按日统计</caption>
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">观察段数</th>
            <th scope="col">累计时长</th>
            <th scope="col">累计次数</th>
            <th scope="col">各时段明细</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="day in dailySummaries"
            :key="day.date"
          >
            <th
              scope="row"
              class="nowrap"
            >
              {{ day.date }}
            </th>
            <td class="nowrap">{{ day.sessionCount }} 段</td>
            <td class="nowrap">{{ day.totalMinutes }} 分钟</td>
            <td class="nowrap">{{ day.totalCount }} 次</td>
            <td>
              {{
                day.sessions
                  .map((session) => `${session.time}（${session.minutes}分/${session.count}次）`)
                  .join('、')
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.movement-daily-summary {
  margin-bottom: 22px;
}

.summary-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
}

.summary-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.summary-table {
  width: 100%;
  min-width: 540px;
  border-collapse: collapse;
  font-size: 13px;
}

.summary-table caption {
  padding: 6px 0 10px;
  color: var(--text-secondary);
  text-align: left;
}

.summary-table th,
.summary-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.summary-table thead th {
  color: var(--text-secondary);
  font-weight: 500;
}

.nowrap {
  white-space: nowrap;
}
</style>
