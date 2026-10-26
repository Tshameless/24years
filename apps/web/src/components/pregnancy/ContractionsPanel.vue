<script setup lang="ts">
import { createId } from '@/domain/id';
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { analyzeContractions } from '@/domain/contractions';
import type { PregnancyRecord } from '@/domain/family';

type Contraction = Extract<PregnancyRecord, { type: 'contraction' }>;
const { quietMode, records, disabled, message, error, save, remove } = usePregnancyRecords();
const now = shallowRef(Date.now());
const entries = computed(() =>
  records.value
    .filter((item): item is Contraction => item.type === 'contraction')
    .sort((a, b) => b.startedAt - a.startedAt),
);
const active = computed(() => entries.value.find((item) => item.endedAt === null));
const analysis = computed(() => analyzeContractions(entries.value, now.value));
let draft: Contraction | null = null;
let interval: ReturnType<typeof setInterval>;
onMounted(() => {
  interval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(interval));

function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));

  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`;
}

async function toggle() {
  if ('vibrate' in navigator) {
    navigator.vibrate(active.value ? [40] : [80, 40, 80]);
  }

  if (active.value) {
    const before = { ...active.value };
    await save({
      type: 'pregnancy',
      before,
      value: { ...before, endedAt: Math.max(Date.now(), before.startedAt) },
    });
  } else {
    draft ??= {
      id: createId(),
      type: 'contraction',
      startedAt: Date.now(),
      endedAt: null,
    };

    if (await save({ type: 'pregnancy', before: null, value: draft })) {
      draft = null;
      now.value = Date.now();
    }
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel timer-panel">
      <div class="panel-heading">
        <h2>宫缩计时</h2>
        <span class="tag">{{ active ? '计时中' : '准备就绪' }}</span>
      </div>
      <p
        class="timer-value numbers"
        aria-label="本次持续时间"
      >
        {{ active ? duration(now - active.startedAt) : '0分00秒' }}
      </p>
      <button
        class="button button-primary timer-button"
        :disabled="disabled || (!active && !!quietMode)"
        @click="toggle"
      >
        {{ active ? '结束本次宫缩' : '开始本次宫缩' }}
      </button>
      <p
        v-if="quietMode"
        class="muted"
      >
        安静关怀已开启，暂停新计时；已开始的计时仍可结束。
      </p>
      <p class="muted timer-note">
        以开始、结束时间计算。刷新页面后可继续结束正在记录的一次；关闭页面不会自动结束。请及时结束记录，修改系统时间可能影响时长。
      </p>
      <div
        v-if="analysis.completedCount > 0"
        class="pattern-card"
        :class="`pattern-${analysis.status}`"
      >
        <div class="pattern-header">
          <strong>{{ analysis.title }}</strong>
          <span class="tag">{{ analysis.badge }}</span>
        </div>
        <p class="pattern-advice">{{ analysis.advice }}</p>
        <div
          v-if="analysis.avgIntervalMinutes !== null"
          class="pattern-stats"
        >
          <span>
            平均间隔：
            <strong>{{ analysis.avgIntervalMinutes }} 分钟</strong>
          </span>
          <span>
            平均持续：
            <strong>{{ analysis.avgDurationSeconds }} 秒</strong>
          </span>
        </div>
        <div
          v-if="analysis.matches511"
          class="pattern-actions"
        >
          <RouterLink
            to="/pregnancy?tab=medical"
            class="button button-primary"
          >
            就医卡 / 医院电话
          </RouterLink>
          <RouterLink
            to="/pregnancy?tab=packing"
            class="button"
          >
            核对待产包
          </RouterLink>
        </div>
      </div>
      <p class="muted">此工具仅记录时间，不判断是否临产；如有不适或疑问，请联系医护人员。</p>
      <p
        v-if="error"
        class="form-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="message"
        class="success-message"
        role="status"
      >
        {{ message }}
      </p>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>计时历史</h2>
        <span class="tag">{{ entries.length }} 次</span>
      </div>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        暂无计时记录，准备好时再开始。
      </p>
      <ul
        v-else
        class="record-list"
      >
        <li
          v-for="(item, index) in entries"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>
              {{ new Date(item.startedAt).toLocaleString('zh-CN', { hour12: false }) }}
            </strong>
            <span class="tag">
              {{ item.endedAt === null ? '进行中' : duration(item.endedAt - item.startedAt) }}
            </span>
          </div>
          <p
            v-if="entries[index + 1]"
            class="muted"
          >
            与上次开始相隔 {{ duration(item.startedAt - entries[index + 1].startedAt) }}
          </p>
          <button
            class="text-button"
            :disabled="disabled"
            @click="remove(item)"
          >
            {{ item.endedAt === null ? '丢弃本次计时' : '删除' }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.timer-value {
  font-size: clamp(32px, 5vw, 52px);
  color: var(--green);
  margin: 36px 0;
}

.timer-button {
  width: min(100%, 320px);
  min-height: 120px;
  margin: 0 auto;
  border-radius: 24px;
  font-size: 18px;
}

.timer-note {
  margin-top: 24px;
}

.pattern-card {
  margin: 20px 0;
  padding: 16px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  text-align: left;
}

.pattern-card.pattern-active_labor_511 {
  background: var(--pink-light);
  border-color: var(--primary);
}

.pattern-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.pattern-advice {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  margin: 6px 0;
}

.pattern-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  margin: 10px 0;
  color: var(--text-secondary);
}

.pattern-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

@media (max-width: 600px) {
  .timer-button {
    min-height: 160px;
    font-size: 20px;
  }

  .pattern-actions .button {
    flex: 1 1 100%;
  }
}
</style>
