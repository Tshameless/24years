<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { localDate } from '@/domain/family';
import { dueReminders } from '@/domain/taskReminders';

const { data, cloud, identity, familyMode } = useFamily();
const now = shallowRef(new Date());
const enabled = shallowRef(false);
const notice = shallowRef('');
const supported = typeof Notification !== 'undefined' && window.isSecureContext;
const sent = new Set<string>();
const openNotifications = new Set<Notification>();
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

function closeNotifications() {
  openNotifications.forEach((item) => item.close());
  openNotifications.clear();
}

async function enable() {
  const scope = identity.value;
  const previousRole = cloud.role.value;

  try {
    const granted = supported && (await Notification.requestPermission()) === 'granted';

    if (
      identity.value !== scope ||
      cloud.role.value !== previousRole ||
      data.value.profile?.quietMode ||
      cloud.expired.value
    ) {
      return;
    }

    enabled.value = granted;
    notice.value = enabled.value
      ? '本次页面会话已开启通知；锁屏或关闭页面不保证送达。'
      : '未获通知权限，站内提醒仍可用。';
  } catch {
    notice.value = '此浏览器暂不能显示系统通知，请使用站内提醒。';
  }
}

watch([due, enabled], () => {
  if (!enabled.value || !due.value.length || Notification.permission !== 'granted') {
    return;
  }

  const date = localDate(now.value);
  const fresh = due.value.filter(
    (task) => !sent.has(`${identity.value}:${date}:${task.id}:${task.time}`),
  );

  if (!fresh.length) {
    return;
  }

  try {
    // Keep sensitive task titles off the operating-system notification surface.
    const notification = new Notification('24Years 计划提醒', {
      body: '有计划已到时间，请打开页面查看。',
      tag: '24years-tasks',
    });
    openNotifications.add(notification);
    notification.onclose = () => openNotifications.delete(notification);
    fresh.forEach((task) => sent.add(`${identity.value}:${date}:${task.id}:${task.time}`));
  } catch {
    enabled.value = false;
    notice.value = '此浏览器不支持当前通知方式，已保留站内提醒。';
  }
});
watch(
  [
    identity,
    () => cloud.role.value,
    () => data.value.profile?.quietMode,
    () => cloud.expired.value,
  ],
  () => {
    enabled.value = false;
    sent.clear();
    notice.value = '';
    closeNotifications();
  },
);
watch(
  () => localDate(now.value),
  () => sent.clear(),
);
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 15000);
});
onUnmounted(() => {
  clearInterval(timer);
  closeNotifications();
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
      @click="enable"
    >
      开启本次页面通知
    </button>
    <button
      v-if="enabled"
      type="button"
      class="button button-secondary"
      @click="
        enabled = false;
        closeNotifications();
      "
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
