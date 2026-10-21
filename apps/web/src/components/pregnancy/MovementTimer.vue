<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { useSessionNotifications } from '@/composables/useSessionNotifications';

const { running, remaining, dueKey, disabled, quiet, scope, invalid } = defineProps<{
  running: boolean;
  remaining: number;
  dueKey: string;
  disabled: boolean;
  quiet: boolean;
  scope: string;
  invalid: boolean;
}>();
const emit = defineEmits<{ start: [minutes: number]; stop: []; acknowledge: [] }>();
const minutes = shallowRef('30');
const valid = computed(
  () =>
    Number.isInteger(Number(minutes.value)) &&
    Number(minutes.value) >= 1 &&
    Number(minutes.value) <= 1440,
);
const countdown = computed(
  () =>
    `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`,
);
const notificationScope = computed(() => scope);
const allowed = computed(() => !disabled && !quiet);
const keys = computed(() => (dueKey ? [dueKey] : []));
const { supported, enabled, pending, notice, enable, disable } = useSessionNotifications({
  scope: notificationScope,
  allowed,
  keys,
  message: {
    title: '24Years 观察计时结束',
    body: '设定的观察时间已到，请返回页面核对并保存记录。',
    tag: '24years-observation',
  },
});

const soundEnabled = shallowRef(false);
const soundNotice = shallowRef('');
let audio: AudioContext | null = null;
let disposed = false;

function silence() {
  soundEnabled.value = false;
  const current = audio;
  audio = null;
  void current?.close().catch(() => {});
}

async function toggleSound() {
  if (soundEnabled.value) {
    silence();
    return;
  }

  if (!allowed.value) {
    return;
  }

  try {
    audio ??= new AudioContext();
    const current = audio;
    await current.resume();

    if (!disposed && current === audio && allowed.value) {
      soundEnabled.value = current.state === 'running';
      soundNotice.value = soundEnabled.value
        ? '本次页面已启用提示音；支持的设备会同时尝试振动。'
        : '提示音未能启用，请使用站内提示。';
    }
  } catch {
    silence();
    soundNotice.value = '此浏览器无法启用提示音，请使用站内提示。';
  }
}

watch(allowed, (value) => {
  if (!value) silence();
});
watch(
  () => dueKey,
  (key) => {
    if (!key || !soundEnabled.value || !allowed.value || !audio || audio.state !== 'running') {
      return;
    }

    try {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.12, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
      tone.frequency.value = 660;
      tone.connect(gain);
      gain.connect(audio.destination);
      tone.onended = () => {
        tone.disconnect();
        gain.disconnect();
      };
      tone.start();
      tone.stop(audio.currentTime + 0.8);
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      soundNotice.value = '提示音未能播放，请查看站内提示。';
    }
  },
);
onScopeDispose(() => {
  disposed = true;
  silence();
});
</script>

<template>
  <div class="observation-timer">
    <h3>自动计时（可选）</h3>
    <p class="muted">按你获得的计数指导设置时长；计时不会自动判断胎动是否正常。</p>
    <label class="field">
      设定观察时长（分钟）
      <input
        :value="minutes"
        type="number"
        min="1"
        max="1440"
        step="1"
        :disabled="disabled || running"
        @input="minutes = ($event.target as HTMLInputElement).value"
      />
    </label>
    <p
      v-if="running"
      class="timer-value"
      role="timer"
      aria-label="观察倒计时"
    >
      {{ countdown }}
    </p>
    <button
      v-if="!running"
      type="button"
      class="button button-secondary"
      :disabled="disabled || !valid || !!dueKey || invalid"
      @click="emit('start', Number(minutes))"
    >
      开始观察计时
    </button>
    <button
      v-else
      type="button"
      class="button button-secondary"
      :disabled="disabled"
      @click="emit('stop')"
    >
      提前结束计时
    </button>
    <div
      v-if="dueKey"
      class="timer-finished"
      role="alert"
    >
      <strong>观察计时已结束</strong>
      <p>请核对实际观察时长和次数，再保存记录。若期间未持续观察，请修正时长。</p>
      <button
        type="button"
        class="button button-secondary"
        :disabled="disabled"
        @click="emit('acknowledge')"
      >
        知道了
      </button>
    </div>
    <p
      v-if="invalid"
      class="form-error"
      role="alert"
    >
      计时草稿损坏，请清除草稿后重新开始；原始次数仍可核对。
    </p>
    <button
      v-if="supported"
      type="button"
      class="text-button"
      :disabled="!allowed || pending"
      @click="enabled ? disable() : enable()"
    >
      {{ enabled ? '关闭计时系统通知' : '开启计时系统通知' }}
    </button>
    <p
      v-if="notice"
      role="status"
    >
      {{ notice }}
    </p>
    <button
      type="button"
      class="text-button"
      :disabled="!allowed"
      @click="toggleSound"
    >
      {{ soundEnabled ? '关闭计时提示音' : '开启计时提示音与振动' }}
    </button>
    <p
      v-if="soundNotice"
      role="status"
    >
      {{ soundNotice }}
    </p>
    <p
      v-if="quiet"
      class="muted"
    >
      静默关怀已开启，仅显示站内计时结果，不发系统通知或提示音。
    </p>
    <p class="muted">
      刷新可恢复本次计时；离开本页、后台休眠、锁屏或关闭网页时无法保证准时提醒，返回本页后会核对截止时间。需要准时提醒时，请同时设置手机闹钟。提示音与通知需每次打开页面主动启用，勿作为紧急医疗提醒。
    </p>
  </div>
</template>

<style scoped>
.observation-timer {
  display: grid;
  gap: 12px;
}
.timer-value {
  margin: 0;
  font-size: 28px;
  font-variant-numeric: tabular-nums;
}
.timer-finished {
  padding: 16px;
  border: 1px solid currentColor;
  border-radius: 12px;
}
</style>
