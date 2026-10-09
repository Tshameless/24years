<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import TaskForm from './TaskForm.vue';
import TaskList from './TaskList.vue';

const { data, today, todayTasks, toggleTask, removeTask, locked } = useFamily();
const filter = shallowRef('today');
const notice = shallowRef('');

const visible = computed(() =>
  filter.value === 'today'
    ? todayTasks.value
    : [...data.value.tasks].sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      ),
);

function confirmRemove(id: string) {
  if (window.confirm('删除这项计划及它的打卡记录？此操作无法撤销。') && removeTask(id)) {
    notice.value = '计划已删除。';
  }
}
</script>

<template>
  <div class="task-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>我的计划</h2>
        <select
          v-model="filter"
          class="filter"
          aria-label="筛选计划"
        >
          <option value="today">今天</option>
          <option value="all">全部计划</option>
        </select>
      </div>
      <TaskList
        :tasks="visible"
        :date="today"
        :disabled="locked"
        removable
        @toggle="toggleTask($event, today)"
        @remove="confirmRemove"
      />
      <p
        v-if="notice"
        class="success-message"
        role="status"
      >
        {{ notice }}
      </p>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>记下一件小事</h2>
        <span class="tag">自主安排</span>
      </div>
      <TaskForm @saved="notice = '计划已保存。'" />
    </section>
  </div>
</template>

<style scoped>
.task-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: start;
}

.filter {
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 10px;
  min-height: 44px;
  font-size: 12px;
}

.success-message {
  margin-bottom: 0;
}

@media (max-width: 1000px) {
  .task-columns {
    grid-template-columns: 1fr;
  }
}
</style>
