<script setup lang="ts">
import { useId } from 'vue';
import type { FamilyMode, FamilyParentRole } from '@/domain/collaboration';

const mode = defineModel<FamilyMode | ''>('mode', { required: true });
const parentRole = defineModel<FamilyParentRole | ''>('parentRole', { required: true });
defineProps<{ disabled?: boolean; disableSingle?: boolean; identityOnly?: boolean }>();
const id = useId();

function selectMode(value: FamilyMode) {
  mode.value = value;
  parentRole.value = value === 'single' ? 'single_parent' : '';
}
</script>

<template>
  <div class="family-choice">
    <fieldset
      v-if="!identityOnly"
      class="choice-group"
      :disabled="disabled"
    >
      <legend>家庭类型</legend>
      <div class="choice-options">
        <label
          class="choice-card"
          :class="{ selected: mode === 'single' }"
        >
          <input
            :name="`${id}-mode`"
            type="radio"
            value="single"
            aria-label="单人"
            :checked="mode === 'single'"
            :disabled="disableSingle"
            required
            @change="selectMode('single')"
          />
          <span>
            <strong>单人</strong>
            <small>独立记录，适用于未婚生育、单亲妈妈等情况，无需绑定另一位家长。</small>
          </span>
        </label>
        <label
          class="choice-card"
          :class="{ selected: mode === 'couple' }"
        >
          <input
            :name="`${id}-mode`"
            type="radio"
            value="couple"
            aria-label="多人"
            :checked="mode === 'couple'"
            required
            @change="selectMode('couple')"
          />
          <span>
            <strong>多人</strong>
            <small>母亲、父亲一起参与，共同记录计划与家庭账本。</small>
          </span>
        </label>
      </div>
      <p
        v-if="disableSingle"
        class="choice-help"
      >
        已有另一位成员加入，解除配对后才可改为单人。
      </p>
    </fieldset>
    <fieldset
      v-if="mode === 'couple' || identityOnly"
      class="choice-group"
      :disabled="disabled"
    >
      <legend>你的身份</legend>
      <div class="choice-options identities">
        <label
          class="choice-card"
          :class="{ selected: parentRole === 'mother' }"
        >
          <input
            v-model="parentRole"
            :name="`${id}-parent`"
            type="radio"
            value="mother"
            aria-label="母亲"
            required
          />
          <span>母亲</span>
        </label>
        <label
          class="choice-card"
          :class="{ selected: parentRole === 'father' }"
        >
          <input
            v-model="parentRole"
            :name="`${id}-parent`"
            type="radio"
            value="father"
            aria-label="父亲"
            required
          />
          <span>父亲</span>
        </label>
      </div>
      <p class="choice-help">选择你在家庭中的身份。身份与管理权限分别设置。</p>
    </fieldset>
  </div>
</template>

<style scoped>
.family-choice {
  display: grid;
  gap: 22px;
}

.choice-group {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.choice-group legend {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
  padding: 0;
}

.choice-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.choice-card {
  display: flex;
  align-items: start;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--canvas);
  cursor: pointer;
}

.choice-card.selected {
  border-color: var(--green);
  background: var(--green-light);
}

.choice-card input {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  margin: 3px 0 0;
  accent-color: var(--green);
}

.choice-card strong {
  display: block;
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}

.choice-card small,
.choice-help {
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.choice-help {
  margin: 10px 0 0;
}

.identities .choice-card {
  align-items: center;
  font-size: 14px;
}

@media (max-width: 520px) {
  .choice-options:not(.identities) {
    grid-template-columns: 1fr;
  }
}
</style>
