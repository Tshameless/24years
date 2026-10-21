<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { localDate, type PregnancyRecord } from '@/domain/family';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';

type Entry = Extract<PregnancyRecord, { type: 'bonding' | 'mood' | 'packing' }>;
const props = defineProps<{ kind: Entry['type'] }>();
const labels = { bonding: '陪伴记录', mood: '心情日记', packing: '待产清单' };
const { records, disabled, save, remove, error, message } = usePregnancyRecords();
const entries = computed(() =>
  records.value
    .filter((item): item is Entry => item.type === props.kind)
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const before = shallowRef<Entry | null>(null);
let draftId = crypto.randomUUID();
const form = reactive({
  title: props.kind === 'mood' ? '平静' : '',
  date: localDate(),
  minutes: 10,
  notes: '',
  completed: false,
});
const stale = computed(
  () =>
    before.value &&
    JSON.stringify(records.value.find((item) => item.id === before.value?.id)) !==
      JSON.stringify(before.value),
);

function reset() {
  before.value = null;
  draftId = crypto.randomUUID();
  Object.assign(form, {
    title: props.kind === 'mood' ? '平静' : '',
    date: localDate(),
    minutes: 10,
    notes: '',
    completed: false,
  });
}

function edit(item: Entry) {
  before.value = { ...item };
  Object.assign(form, {
    ...item,
    minutes: item.type === 'bonding' ? item.minutes : 10,
    completed: item.type === 'packing' && item.completed,
  });
}

async function submit() {
  const base = {
    id: before.value?.id ?? draftId,
    date: form.date,
    title: form.title.trim(),
    notes: form.notes.trim(),
  };
  const value: Entry =
    props.kind === 'bonding'
      ? { ...base, type: 'bonding', minutes: Number(form.minutes) }
      : props.kind === 'packing'
        ? { ...base, type: 'packing', completed: form.completed }
        : { ...base, type: 'mood' };

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ labels[kind] }}</h2>
        <span class="tag">{{ entries.length }} 条记录</span>
      </div>
      <p class="muted">启用家庭同步后，所有家庭成员都能看到这些记录。请只填写愿意共享的内容。</p>
      <p
        v-if="kind === 'mood'"
        class="muted"
      >
        记录自己的感受，不进行心理评分或诊断。
      </p>
      <p
        v-if="kind === 'packing'"
        class="muted"
      >
        按医院要求整理证件、个人与宝宝用品。备注可填写数量、负责人和位置；备齐状态不会自动记账。
      </p>
      <p
        v-if="!entries.length"
        class="empty-state"
      >
        还没有记录，按自己的节奏开始即可。
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
            <strong>{{ item.title }}</strong>
            <span
              v-if="item.type === 'bonding'"
              class="tag"
            >
              {{ item.minutes }} 分钟
            </span>
            <span
              v-if="item.type === 'packing'"
              class="tag"
            >
              {{ item.completed ? '已备齐' : '待准备' }}
            </span>
          </div>
          <p class="muted">{{ item.date }}</p>
          <p class="record-notes">{{ item.notes }}</p>
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
        <h2>{{ before ? '编辑' : '添加' }}{{ labels[kind] }}</h2>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <fieldset
          class="record-fields"
          :disabled="disabled || !!stale"
        >
          <label
            v-if="kind === 'mood'"
            class="field"
          >
            此刻心情
            <select v-model="form.title">
              <option
                v-for="mood in ['愉悦', '平静', '烦躁', '低落', '疲惫']"
                :key="mood"
              >
                {{ mood }}
              </option>
            </select>
          </label>
          <label
            v-else
            class="field"
          >
            {{ kind === 'packing' ? '物品名称' : '陪伴内容' }}
            <input
              v-model="form.title"
              required
              maxlength="80"
            />
          </label>
          <label class="field">
            记录日期
            <input
              v-model="form.date"
              required
              type="date"
              :max="localDate()"
            />
          </label>
          <label
            v-if="kind === 'bonding'"
            class="field"
          >
            陪伴时长（分钟）
            <input
              v-model="form.minutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              required
            />
          </label>
          <label class="field">
            记录备注
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="2000"
            />
          </label>
          <label
            v-if="kind === 'packing'"
            class="check-option"
          >
            <input
              v-model="form.completed"
              type="checkbox"
            />
            已经备齐
          </label>
          <button class="button button-primary">保存{{ labels[kind] }}</button>
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
          @click="reset"
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
