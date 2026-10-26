<script setup lang="ts">
import { computed } from 'vue';
import { weekDays } from '@/domain/family';

const weekdays = defineModel<string>({ required: true });

const selectedDays = computed(() => (weekdays.value ? weekdays.value.split(',').map(Number) : []));

function toggleWeekday(day: number) {
  const next = selectedDays.value.includes(day)
    ? selectedDays.value.filter((value) => value !== day)
    : [...selectedDays.value, day];
  weekdays.value = next.sort((a, b) => a - b).join(',');
}
</script>

<template>
  <fieldset class="weekday-picker">
    <legend>重复星期（至少选一天）</legend>
    <div class="weekday-options">
      <button
        v-for="day in weekDays"
        :key="day.value"
        type="button"
        :aria-pressed="selectedDays.includes(day.value)"
        :class="{ selected: selectedDays.includes(day.value) }"
        @click="toggleWeekday(day.value)"
      >
        {{ day.label }}
      </button>
    </div>
    <p class="muted">从开始日期起，仅在选定星期出现在今日计划中。修改周期不会删除历史打卡。</p>
  </fieldset>
</template>

<style scoped>
.weekday-picker {
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.weekday-picker legend {
  font-size: 13px;
  padding: 0 6px;
}

.weekday-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.weekday-options button {
  min-height: 44px;
  min-width: 44px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-secondary);
}

.weekday-options .selected {
  background: var(--green-light);
  color: var(--green);
  border-color: var(--green);
}

.weekday-picker p {
  font-size: 12px;
  line-height: 1.8;
  margin: 12px 0 0;
}
</style>
