<script setup lang="ts">
const weeks = defineModel<string>('weeks', { required: true });
const days = defineModel<number>('days', { required: true });

defineProps<{
  referenceDate: string;
  parentRole: string;
  estimatedDueDate: string | null;
}>();
</script>

<template>
  <fieldset class="gestation-fields">
    <legend>怀孕时期</legend>
    <p
      id="gestation-help"
      class="gestation-help"
    >
      <span v-if="parentRole === 'father'">请填写母亲的怀孕时期。</span>
      按 {{ referenceDate }} 已满的孕周填写，例如 24 周 3 天。
    </p>
    <div class="form-row">
      <div class="field">
        <label for="gestation-weeks">孕周（周）</label>
        <input
          id="gestation-weeks"
          v-model="weeks"
          type="text"
          inputmode="numeric"
          pattern="[0-9]{1,2}"
          placeholder="例如：24"
          aria-describedby="gestation-help"
          required
        />
      </div>
      <div class="field">
        <label for="gestation-days">天数（天）</label>
        <select
          id="gestation-days"
          v-model.number="days"
        >
          <option
            v-for="day in 7"
            :key="day"
            :value="day - 1"
          >
            {{ day - 1 }} 天
          </option>
        </select>
      </div>
    </div>
    <p
      v-if="estimatedDueDate"
      class="gestation-help"
    >
      预计预产期：{{ estimatedDueDate }}。按 40 周估算，仅作日历参考，以医生评估为准。
    </p>
  </fieldset>
</template>

<style scoped>
.gestation-fields {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.gestation-fields legend {
  padding: 0;
  font-size: 13px;
  font-weight: 500;
}

.gestation-help {
  margin: 10px 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
