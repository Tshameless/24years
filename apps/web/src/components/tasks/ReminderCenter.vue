<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useSessionNotifications } from '@/composables/useSessionNotifications';
import { useFamily } from '@/composables/useFamily';
import { localDate } from '@/domain/family';
import { dueReminders } from '@/domain/taskReminders';

const { data, cloud, identity, familyMode } = useFamily();
const now = shallowRef(new Date());
const role = computed(() =>
  familyMode.value === 'single'
    ? 'single_parent'
    : cloud.active.value
      ? cloud.state.value.family?.members.find((member) => member.id === cloud.state.value.user?.id)
          ?.familyRole
      : data.value.profile?.parentRole,
);
const due = computed(() =>
  dueReminders(
    data.value.tasks,
    localDate(now.value),
    `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`,
    !!data.value.profile?.quietMode ||
      !cloud.ready.value ||
      cloud.expired.value ||
      cloud.role.value === 'viewer',
    role.value ?? undefined,
  ),
);

const notificationScope = computed(() =>
  JSON.stringify([
    identity.value,
    cloud.role.value,
    role.value,
    !!data.value.profile?.quietMode,
    cloud.ready.value,
    cloud.expired.value,
  ]),
);
const allowed = computed(
  () =>
    !!data.value.profile &&
    cloud.ready.value &&
    !cloud.expired.value &&
    !data.value.profile.quietMode &&
    cloud.role.value !== 'viewer',
);
const notificationKeys = computed(() =>
  due.value.map((task) => `${identity.value}:${localDate(now.value)}:${task.id}:${task.time}`),
);
const { enabled, pending, notice, supported, enable, disable } = useSessionNotifications({
  scope: notificationScope,
  allowed,
  keys: notificationKeys,
});
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 15000);
});
onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <details
    v-if="
      data.profile &&
      cloud.ready.value &&
      !cloud.expired.value &&
      !data.profile.quietMode &&
      cloud.role.value !== 'viewer'
    "
    class="panel reminder-center"
  >
    <summary>计划提醒 · {{ due.length }} 项已到时间</summary>
    <p class="muted">
      仅显示今天到时且未完成、未指派或由你负责的计划。按设备当地时间检查；关闭页面、后台休眠或断网时不保证提醒。此功能不能用于紧急医疗提醒。
    </p>
    <ul v-if="due.length">
      <li
        v-for="task in due"
        :key="task.id"
      >
        {{ task.time }} · {{ task.title }}
      </li>
    </ul>
    <p v-else>当前没有到时未完成计划。</p>
    <RouterLink
      to="/tasks"
      class="text-button"
    >
      查看并处理计划
    </RouterLink>
    <button
      v-if="supported && !enabled"
      type="button"
      class="button button-secondary"
      :disabled="pending"
      @click="enable"
    >
      开启本次页面通知
    </button>
    <button
      v-if="enabled"
      type="button"
      class="button button-secondary"
      @click="disable"
    >
      关闭本次页面通知
    </button>
    <p
      v-if="notice"
      role="status"
    >
      {{ notice }}
    </p>
  </details>
</template>

<style scoped>
.reminder-center {
  margin-bottom: 20px;
}

.reminder-center summary {
  cursor: pointer;
  min-height: 30px;
  font-weight: 600;
}

.reminder-center ul {
  padding-left: 22px;
  line-height: 1.8;
}

.reminder-center .button {
  margin: 8px 0;
}
</style>
