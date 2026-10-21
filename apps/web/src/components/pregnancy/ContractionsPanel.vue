<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
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
  if (active.value) {
    const before = { ...active.value };
    await save({
      type: 'pregnancy',
      before,
      value: { ...before, endedAt: Math.max(Date.now(), before.startedAt) },
    });
  } else {
    draft ??= {
      id: crypto.randomUUID(),
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
        class="button button-primary"
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

.timer-note {
  margin-top: 24px;
}
</style>
