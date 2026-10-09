<script setup lang="ts">
import type { FamilyTask } from '@/domain/family';
import { taskIsDue } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';

defineProps<{
  tasks: readonly {
    readonly [K in keyof FamilyTask]: FamilyTask[K] extends string[]
      ? readonly string[]
      : FamilyTask[K];
  }[];
  date: string;
  disabled?: boolean;
  removable?: boolean;
}>();

defineEmits<{ toggle: [id: string]; remove: [id: string]; edit: [id: string] }>();
</script>

<template>
  <ul
    v-if="tasks.length"
    class="task-list"
  >
    <li
      v-for="task in tasks"
      :key="task.id"
      class="task-row"
      :class="{ done: task.completedDates.includes(date) }"
    >
      <button
        class="task-check"
        :aria-label="`${task.completedDates.includes(date) ? '撤销完成' : '完成'}：${task.title}`"
        :aria-pressed="task.completedDates.includes(date)"
        :disabled="disabled || !taskIsDue(task, date)"
        @click="$emit('toggle', task.id)"
      >
        <span>
          <AppIcon
            v-if="task.completedDates.includes(date)"
            name="check"
            :size="16"
          />
        </span>
      </button>
      <div class="task-content">
        <strong>{{ task.title }}</strong>
        <small>
          {{ task.repeat === 'daily' ? `每日 · 始于 ${task.date}` : task.date }}
          <span v-if="!taskIsDue(task, date)">· 非今日计划</span>
        </small>
      </div>
      <time class="numbers">{{ task.time }}</time>
      <button
        v-if="removable"
        class="icon-button"
        :aria-label="`编辑计划：${task.title}`"
        :disabled="disabled"
        @click="$emit('edit', task.id)"
      >
        <AppIcon
          name="edit"
          :size="16"
        />
      </button>
      <button
        v-if="removable"
        class="icon-button"
        :aria-label="`删除计划：${task.title}`"
        :disabled="disabled"
        @click="$emit('remove', task.id)"
      >
        <AppIcon
          name="trash"
          :size="16"
        />
      </button>
    </li>
  </ul>
  <div
    v-else
    class="empty-state"
  >
    <span class="empty-icon">
      <AppIcon
        name="calendar"
        :size="25"
      />
    </span>
    <h3>给今天，留一点小期待</h3>
    <p>还没有计划。可以从记录一件想做的小事开始。</p>
  </div>
</template>

<style scoped>
.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 0;
  border-bottom: 1px solid var(--border);
}

.task-row:last-child {
  border-bottom: 0;
}

.task-check {
  width: 48px;
  height: 48px;
  border: 0;
  background: transparent;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  padding: 0;
}

.task-check span {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 1px solid var(--muted);
  display: grid;
  place-items: center;
}

.done .task-check span {
  background: var(--green);
  color: var(--surface);
  border-color: var(--green);
}

.task-content {
  min-width: 0;
  flex: 1;
}

.task-content strong {
  display: block;
  font-size: 14px;
  font-weight: 500;
  overflow-wrap: anywhere;
  line-height: 1.7;
}

.done .task-content strong {
  text-decoration: line-through;
  color: var(--muted);
}

.task-content small {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 6px;
}

.task-row time {
  font-size: 13px;
  color: var(--text-secondary);
}

@media (max-width: 480px) {
  .task-row {
    gap: 4px;
  }

  .task-row .icon-button {
    width: 40px;
  }
}
</style>
