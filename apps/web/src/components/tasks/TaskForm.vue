<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { isDate, localDate } from '@/domain/family';

const emit = defineEmits<{ saved: [] }>();
const { addTask, locked } = useFamily();

const form = reactive({
  title: '',
  date: localDate(),
  time: '09:00',
  repeat: 'once' as 'once' | 'daily',
});

const error = shallowRef('');

function submit() {
  error.value = '';

  if (!form.title.trim() || !isDate(form.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(form.time)) {
    error.value = '请填写计划名称、日期与时间。';

    return;
  }

  if (addTask({ ...form, title: form.title.trim() })) {
    form.title = '';
    emit('saved');
  }
}
</script>

<template>
  <form
    class="form-grid"
    @submit.prevent="submit"
  >
    <label class="field">
      计划名称
      <input
        v-model="form.title"
        required
        maxlength="80"
        placeholder="例如：整理下一次就诊的问题"
      />
    </label>
    <div class="form-row">
      <label class="field">
        {{ form.repeat === 'daily' ? '开始日期' : '计划日期' }}
        <input
          v-model="form.date"
          type="date"
          required
        />
      </label>
      <label class="field">
        时间
        <input
          v-model="form.time"
          type="time"
          required
        />
      </label>
    </div>
    <label class="field">
      重复方式
      <select v-model="form.repeat">
        <option value="once">仅一次</option>
        <option value="daily">每天重复</option>
      </select>
      <small>仅作为页面计划清单，不会发送系统通知；用药安排请遵医嘱。</small>
    </label>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button button-primary"
      :disabled="locked"
    >
      保存计划
    </button>
  </form>
</template>
