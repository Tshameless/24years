<script setup lang="ts">
import { computed } from 'vue';

const count = defineModel<string>({ required: true });
const { disabled = false } = defineProps<{ disabled?: boolean }>();
const current = computed(() => Number(count.value));
const valid = computed(
  () =>
    count.value !== '' &&
    Number.isInteger(current.value) &&
    current.value >= 0 &&
    current.value <= 9999,
);

function change(delta: number) {
  if (!disabled && valid.value && current.value + delta >= 0 && current.value + delta <= 9999) {
    count.value = String(current.value + delta);
  }
}
</script>

<template>
  <div class="movement-counter">
    <button
      type="button"
      class="button button-primary count-button"
      :disabled="disabled || !valid || current >= 9999"
      @click="change(1)"
    >
      记录一次胎动 +1
    </button>
    <p
      class="count-value"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ count || '—' }} 次
    </p>
    <button
      type="button"
      class="text-button"
      :disabled="disabled || !valid || current <= 0"
      @click="change(-1)"
    >
      误点减一
    </button>
    <label class="field count-field">
      本次记录次数
      <input
        :value="count"
        type="number"
        min="0"
        max="9999"
        step="1"
        required
        :disabled="disabled"
        @input="count = ($event.target as HTMLInputElement).value"
      />
    </label>
  </div>
</template>

<style scoped>
.movement-counter {
  display: grid;
  gap: 14px;
  justify-items: center;
}

.count-button {
  min-height: 120px;
  width: 100%;
  max-width: 280px;
  border-radius: 24px;
  font-size: 19px;
}

.count-value {
  margin: 0;
  font-size: 28px;
  font-variant-numeric: tabular-nums;
}

.count-field {
  width: 100%;
}
</style>
