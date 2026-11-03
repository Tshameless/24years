<script setup lang="ts">
import { computed, onUnmounted, shallowRef } from 'vue';
import { createId } from '@/domain/id';
import { localDate } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';

interface RhythmPreset {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly activeLabel: string;
  readonly restLabel: string;
  readonly activeSeconds: number;
  readonly restSeconds: number;
  readonly totalCycles: number;
}

const presets: readonly RhythmPreset[] = [
  {
    id: 'pelvic-slow',
    title: '盆底肌慢肌耐力（收 5 秒 · 放 5 秒 × 10 组）',
    summary: '轻柔向上提收盆底肌 5 秒后完全放松 5 秒，练习全程保持自然呼吸，切勿憋气或紧绷臀腹。',
    activeLabel: '轻柔收缩盆底肌（保持自然呼吸）',
    restLabel: '完全放松盆底肌',
    activeSeconds: 5,
    restSeconds: 5,
    totalCycles: 10,
  },
  {
    id: 'pelvic-quick',
    title: '盆底肌快肌节律（收 2 秒 · 放 3 秒 × 12 组）',
    summary: '短促轻收 2 秒后充分放松 3 秒，帮助感知咳嗽、打喷嚏时的盆底支撑节律。',
    activeLabel: '快速轻收盆底肌',
    restLabel: '充分放松休息',
    activeSeconds: 2,
    restSeconds: 3,
    totalCycles: 12,
  },
  {
    id: 'breathing',
    title: '舒缓放松呼吸（吸气 4 秒 · 缓呼 6 秒 × 8 组）',
    summary: '用鼻缓慢吸气 4 秒，微拢双唇轻柔呼气 6 秒，适合睡前放松或产检等待时平复紧张情绪。',
    activeLabel: '用鼻轻柔吸气',
    restLabel: '微拢双唇缓慢呼气',
    activeSeconds: 4,
    restSeconds: 6,
    totalCycles: 8,
  },
];

const { disabled, quietMode, save } = usePregnancyRecords();

const selectedId = shallowRef(presets[0]!.id);
const running = shallowRef(false);
const finished = shallowRef(false);
const elapsedSeconds = shallowRef(0);
const logged = shallowRef(false);
const saving = shallowRef(false);
const feedback = shallowRef('');
const saveError = shallowRef('');

let timerHandle: ReturnType<typeof setInterval> | undefined;

const preset = computed(() => presets.find((item) => item.id === selectedId.value) ?? presets[0]!);
const cycleDuration = computed(() => preset.value.activeSeconds + preset.value.restSeconds);
const totalDuration = computed(() => cycleDuration.value * preset.value.totalCycles);
const currentCycle = computed(() =>
  Math.min(preset.value.totalCycles, Math.floor(elapsedSeconds.value / cycleDuration.value) + 1),
);
const completedCycles = computed(() =>
  Math.min(preset.value.totalCycles, Math.floor(elapsedSeconds.value / cycleDuration.value)),
);
const offsetInCycle = computed(() => elapsedSeconds.value % cycleDuration.value);
const phase = computed<'ready' | 'active' | 'rest' | 'done'>(() => {
  if (finished.value) {
    return 'done';
  }

  if (!running.value && elapsedSeconds.value === 0) {
    return 'ready';
  }

  return offsetInCycle.value < preset.value.activeSeconds ? 'active' : 'rest';
});
const phaseLabel = computed(() => {
  if (phase.value === 'done') {
    return '本轮节律练习已完成';
  }

  if (phase.value === 'ready') {
    return '选择舒适坐姿或侧卧位，准备就绪后点击开始';
  }

  return phase.value === 'active' ? preset.value.activeLabel : preset.value.restLabel;
});
const phaseRemaining = computed(() => {
  if (phase.value === 'done' || phase.value === 'ready') {
    return preset.value.activeSeconds;
  }

  return phase.value === 'active'
    ? preset.value.activeSeconds - offsetInCycle.value
    : cycleDuration.value - offsetInCycle.value;
});

function stopInterval() {
  if (timerHandle !== undefined) {
    clearInterval(timerHandle);
    timerHandle = undefined;
  }

  running.value = false;
}

function pulseFeedback() {
  if (!quietMode.value && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.(25);
  }
}

function tick() {
  const previousPhase = phase.value;
  const next = elapsedSeconds.value + 1;

  if (next >= totalDuration.value) {
    elapsedSeconds.value = totalDuration.value;
    finished.value = true;
    stopInterval();
    pulseFeedback();

    return;
  }

  elapsedSeconds.value = next;

  if (phase.value !== previousPhase) {
    pulseFeedback();
  }
}

function toggleRun() {
  feedback.value = '';
  saveError.value = '';

  if (running.value) {
    stopInterval();

    return;
  }

  if (finished.value) {
    elapsedSeconds.value = 0;
    finished.value = false;
    logged.value = false;
  }

  running.value = true;
  timerHandle = setInterval(tick, 1000);
}

function resetSession() {
  stopInterval();
  elapsedSeconds.value = 0;
  finished.value = false;
  logged.value = false;
  feedback.value = '';
  saveError.value = '';
}

function onSelectPreset(id: string) {
  selectedId.value = id;
  resetSession();
}

async function logToBonding() {
  if (disabled.value || saving.value || logged.value || elapsedSeconds.value < 5) {
    return;
  }

  feedback.value = '';
  saveError.value = '';
  saving.value = true;

  try {
    const minutes = Math.max(1, Math.round(elapsedSeconds.value / 60));
    const saved = await save({
      type: 'pregnancy',
      before: null,
      value: {
        id: createId(),
        type: 'bonding',
        date: localDate(),
        title: preset.value.title.split('（')[0] ?? preset.value.title,
        minutes,
        notes: `跟随节律完成 ${completedCycles.value}/${preset.value.totalCycles} 组（共 ${elapsedSeconds.value} 秒）。`,
      },
    });

    if (saved) {
      logged.value = true;
      feedback.value = '已记入下方陪伴记录。';
    } else {
      saveError.value = '暂时无法保存陪伴记录，请稍后重试。';
    }
  } finally {
    saving.value = false;
  }
}

onUnmounted(stopInterval);
</script>

<template>
  <section
    class="panel rhythm-trainer"
    aria-label="盆底肌与放松呼吸节律练习"
  >
    <div class="panel-heading">
      <div>
        <h2>盆底肌与放松呼吸节律引导</h2>
        <p class="muted trainer-subtitle">
          温和的视觉节律辅助，无声音打扰，可随时暂停或结束，不设强制打卡要求。
        </p>
      </div>
      <span class="tag">循证节律辅助</span>
    </div>

    <div
      class="safety-banner"
      role="note"
    >
      <strong>医学安全提示：</strong>
      如有前置胎盘、宫颈机能不全、先兆早产、胎膜早破、不明原因阴道出血、规律宫缩或医生建议限制活动，请暂停盆底肌训练，仅在产科医嘱允许下进行；练习时保持自然呼吸，切勿屏气或向下用力。
    </div>

    <div class="trainer-body">
      <div class="trainer-config">
        <label class="field">
          选择练习模式
          <select
            :value="selectedId"
            :disabled="running"
            @change="onSelectPreset(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="item in presets"
              :key="item.id"
              :value="item.id"
            >
              {{ item.title }}
            </option>
          </select>
        </label>
        <p class="muted preset-summary">{{ preset.summary }}</p>
      </div>

      <div
        class="rhythm-stage"
        :class="`phase-${phase}`"
      >
        <div class="rhythm-meta">
          <span>第 {{ currentCycle }} / {{ preset.totalCycles }} 组</span>
          <span>累计 {{ elapsedSeconds }} / {{ totalDuration }} 秒</span>
        </div>
        <strong
          class="rhythm-cue"
          aria-live="polite"
        >
          {{ phaseLabel }}
        </strong>
        <p
          v-if="running || (elapsedSeconds > 0 && !finished)"
          class="rhythm-countdown"
        >
          当前节拍剩余
          <strong>{{ phaseRemaining }}</strong>
          秒
        </p>
        <div class="trainer-actions">
          <button
            type="button"
            class="button button-primary"
            @click="toggleRun"
          >
            {{
              running
                ? '暂停节律'
                : finished
                  ? '重新开始一轮'
                  : elapsedSeconds > 0
                    ? '继续练习'
                    : '开始节律引导'
            }}
          </button>
          <button
            v-if="elapsedSeconds > 0"
            type="button"
            class="button button-secondary"
            @click="resetSession"
          >
            重置
          </button>
          <button
            v-if="elapsedSeconds >= 5 && !disabled && !running"
            type="button"
            class="button button-secondary"
            :disabled="saving || logged"
            @click="logToBonding"
          >
            {{ logged ? '已记入陪伴记录' : saving ? '保存中…' : '记入陪伴记录' }}
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="feedback"
      class="success-message trainer-feedback"
      role="status"
    >
      {{ feedback }}
    </p>
    <p
      v-if="saveError"
      class="form-error trainer-feedback"
      role="alert"
    >
      {{ saveError }}
    </p>
  </section>
</template>

<style scoped>
.rhythm-trainer {
  margin-bottom: 22px;
}

.trainer-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
}

.safety-banner {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  background: var(--pink-light);
  font-size: 13px;
  line-height: 1.75;
  color: var(--text);
}

.trainer-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 18px;
  align-items: stretch;
}

.trainer-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preset-summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
}

.rhythm-stage {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--canvas);
  transition: background-color 0.25s ease;
}

.rhythm-stage.phase-active {
  background: var(--green-light);
  border-color: color-mix(in srgb, var(--green) 40%, var(--border));
}

.rhythm-stage.phase-rest {
  background: var(--surface-secondary);
}

.rhythm-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.rhythm-cue {
  font-size: 17px;
  color: var(--text-heading);
  line-height: 1.5;
}

.rhythm-countdown {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.rhythm-countdown strong {
  font-size: 20px;
  color: var(--green);
}

.trainer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.trainer-feedback {
  margin: 12px 0 0;
}

@media (max-width: 760px) {
  .trainer-body {
    grid-template-columns: 1fr;
  }
}
</style>
