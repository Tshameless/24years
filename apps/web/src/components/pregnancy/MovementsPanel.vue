<script setup lang="ts">
import { computed } from 'vue';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { localDate, type PregnancyRecord } from '@/domain/family';
import MovementCounter from './MovementCounter.vue';

type Movement = Extract<PregnancyRecord, { type: 'movement' }>;
const { records, disabled, save, remove, error, message } = usePregnancyRecords();
const entries = computed(() =>
  records.value
    .filter((item): item is Movement => item.type === 'movement')
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.id.localeCompare(b.id),
    ),
);
const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'movement',
  defaults: () => ({ date: localDate(), time: '', minutes: '', count: '0', notes: '' }),
  fields: (item: Movement) => ({
    date: item.date,
    time: item.time,
    minutes: String(item.minutes),
    count: String(item.count),
    notes: item.notes,
  }),
});

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  const value: Movement = {
    id: before.value?.id ?? draft.id.value,
    type: 'movement',
    date: form.date,
    time: form.time,
    minutes: Number(form.minutes),
    count: Number(form.count),
    notes: form.notes.trim(),
  };

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>胎动观察历史</h2>
        <span class="tag">{{ entries.length }} 条</span>
      </div>
      <p class="muted">
        保留每次实际观察的次数与时长，不换算全天次数，不判断正常或异常。计数方式请按就诊时获得的指导填写。
      </p>
      <p class="muted">
        启用家庭同步后，所有家庭成员都能看到已保存记录。未提交计数仅暂存在当前标签页。
      </p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        暂无胎动观察记录。
      </p>
      <ul
        v-else
        class="record-list"
      >
        <li
          v-for="item in entries"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>{{ item.date }} {{ item.time }}</strong>
            <span class="tag">{{ item.count }} 次</span>
          </div>
          <p class="muted">观察时长：{{ item.minutes }} 分钟</p>
          <p
            v-if="item.notes"
            class="record-notes"
          >
            {{ item.notes }}
          </p>
          <div class="record-actions">
            <button
              class="text-button"
              :disabled="disabled"
              @click="edit(item)"
            >
              编辑
            </button>
            <button
              class="text-button"
              :disabled="disabled"
              @click="remove(item)"
            >
              删除
            </button>
          </div>
        </li>
      </ul>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑胎动观察' : '记录胎动观察' }}</h2>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <FormDraftNotice
          :dirty="draft.dirty.value"
          :restored="draft.restored.value"
          :error="draft.storageError.value"
          :blocked="stale"
          @discard="cancel"
        />
        <fieldset
          class="record-fields"
          :disabled="disabled || stale"
        >
          <MovementCounter
            v-model="form.count"
            :disabled="disabled || stale"
          />
          <p class="muted">
            每次点击加一，可用「误点减一」或直接修改次数纠正。不自动合并或过滤点击；本页不自动计时，保存前请填写实际观察时段。
          </p>
          <label class="field">
            观察开始日期
            <input
              v-model="form.date"
              type="date"
              :max="localDate()"
              required
            />
          </label>
          <label class="field">
            观察开始时间
            <input
              v-model="form.time"
              type="time"
              required
            />
          </label>
          <label class="field">
            实际观察时长（分钟）
            <input
              :value="form.minutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              required
              @input="form.minutes = ($event.target as HTMLInputElement).value"
            />
          </label>
          <label class="field">
            观察备注
            <textarea
              v-model="form.notes"
              rows="3"
              maxlength="2000"
              placeholder="例如计数方式、观察时的感受"
            />
          </label>
          <button class="button button-primary">
            {{ before ? '保存胎动修改' : '保存胎动观察' }}
          </button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          记录已变化，输入仍保留，请取消后重新编辑最新记录。
        </p>
        <button
          v-if="before"
          type="button"
          class="button button-secondary"
          :disabled="disabled"
          @click="cancel"
        >
          取消编辑
        </button>
      </form>
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
  </div>
</template>
