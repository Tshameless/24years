<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import {
  filterFoodSafetyItems,
  foodCategories,
  foodSafetyLabels,
  supplementClockTemplates,
  type FoodCategory,
  type FoodSafetyLevel,
  type SupplementClockTemplate,
} from '@/domain/nutritionGuide';
import { useFamily } from '@/composables/useFamily';

const { data, today, recordLocked, addTask, cloud } = useFamily();

const query = shallowRef('');
const selectedCategory = shallowRef<FoodCategory | 'all'>('all');
const selectedLevel = shallowRef<FoodSafetyLevel | 'all'>('all');
const addingId = shallowRef('');
const clockNotice = shallowRef('');
const clockError = shallowRef('');

const filteredItems = computed(() =>
  filterFoodSafetyItems(query.value, selectedCategory.value, selectedLevel.value),
);

function hasSupplementTask(item: SupplementClockTemplate): boolean {
  return data.value.tasks.some((task) => task.title === item.taskTitle && task.repeat === 'daily');
}

async function addSupplementReminder(item: SupplementClockTemplate) {
  if (recordLocked.value || addingId.value || hasSupplementTask(item)) {
    return;
  }

  clockNotice.value = '';
  clockError.value = '';
  addingId.value = item.id;

  try {
    const time = item.timeLabel.slice(0, 5);
    const saved = await addTask({
      title: item.taskTitle,
      date: today.value,
      time,
      repeat: 'daily',
    });

    if (saved) {
      clockNotice.value =
        cloud.active.value && !cloud.online.value
          ? '每日错峰提醒已保存在本机，联网后同步。'
          : `已添加每日 ${time} 补剂错峰提醒。`;
    } else {
      clockError.value = '添加提醒失败，请稍后重试。';
    }
  } finally {
    addingId.value = '';
  }
}
</script>

<template>
  <section
    class="panel food-safety-panel"
    aria-label="孕期循证饮食速查与补剂错峰助手"
  >
    <div class="panel-heading">
      <div>
        <h2>循证饮食安全速查与铁钙错峰参考</h2>
        <p class="muted panel-subtitle">
          基于现代营养与食品安全指南整理，破除民间伪禁忌，聚焦真实微生物、重金属与酒精风险。
        </p>
      </div>
      <span class="tag">循证科普</span>
    </div>

    <div class="food-filters">
      <label class="field food-search-field">
        搜索食物或饮品
        <input
          v-model="query"
          type="search"
          maxlength="40"
          placeholder="例如：螃蟹、咖啡、刺身、奶酪、冰水、木瓜…"
        />
      </label>
      <label class="field">
        食物分类
        <select v-model="selectedCategory">
          <option value="all">全部分类</option>
          <option
            v-for="cat in foodCategories"
            :key="cat"
            :value="cat"
          >
            {{ cat }}
          </option>
        </select>
      </label>
      <label class="field">
        安全等级
        <select v-model="selectedLevel">
          <option value="all">全部等级</option>
          <option value="safe">放心享用</option>
          <option value="caution">适量注意</option>
          <option value="avoid">明确避免</option>
        </select>
      </label>
    </div>

    <p
      v-if="!filteredItems.length"
      class="muted empty-search"
    >
      未找到匹配项。一般原则：彻底加热熟透、巴氏杀菌、零酒精、均衡控糖；特殊疾病饮食请咨询临床营养科。
    </p>
    <div
      v-else
      class="food-card-grid"
    >
      <article
        v-for="item in filteredItems"
        :key="item.id"
        class="food-card"
        :class="`food-level-${item.level}`"
      >
        <div class="food-card-header">
          <strong>{{ item.name }}</strong>
          <span
            class="tag"
            :class="`badge-${item.level}`"
          >
            {{ foodSafetyLabels[item.level] }}
          </span>
        </div>
        <p class="food-summary">{{ item.summary }}</p>
        <p class="food-evidence">{{ item.evidenceNote }}</p>
      </article>
    </div>

    <details class="supplement-clock">
      <summary>展开「铁钙错峰与补剂每日提醒助手」</summary>
      <div class="supplement-clock-body">
        <p class="muted">
          钙与铁同属二价阳离子，同时服用会在肠道竞争转运通道降低吸收率。若医生同时开具铁剂与钙剂，建议间隔
          2 小时以上错峰服用（具体品种与剂量严格遵医嘱）。
        </p>
        <ul class="clock-list">
          <li
            v-for="slot in supplementClockTemplates"
            :key="slot.id"
          >
            <div class="clock-copy">
              <strong>{{ slot.timeLabel }}</strong>
              <p>{{ slot.rationale }}</p>
            </div>
            <button
              type="button"
              class="button button-secondary button-sm"
              :disabled="recordLocked || hasSupplementTask(slot) || addingId === slot.id"
              @click="addSupplementReminder(slot)"
            >
              {{
                hasSupplementTask(slot)
                  ? '已设每日提醒'
                  : addingId === slot.id
                    ? '设置中…'
                    : '设为每日提醒'
              }}
            </button>
          </li>
        </ul>
        <p
          v-if="clockNotice"
          class="success-message clock-feedback"
          role="status"
        >
          {{ clockNotice }}
        </p>
        <p
          v-if="clockError"
          class="form-error clock-feedback"
          role="alert"
        >
          {{ clockError }}
        </p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.food-safety-panel {
  margin-bottom: 22px;
}

.panel-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
}

.food-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.empty-search {
  margin: 0 0 14px;
  padding: 16px;
  border-radius: 10px;
  background: var(--canvas);
}

.food-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.food-card {
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--canvas);
}

.food-level-avoid {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background: color-mix(in srgb, var(--pink-light) 55%, var(--surface));
}

.food-card-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.food-card-header strong {
  font-size: 14px;
  line-height: 1.5;
}

.badge-safe {
  background: var(--green-light);
  color: var(--green);
}

.badge-caution {
  background: var(--surface-secondary);
  color: var(--text);
}

.badge-avoid {
  background: var(--pink-light);
  color: var(--primary-ink);
}

.food-summary {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.65;
}

.food-evidence {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.supplement-clock {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.supplement-clock summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--green);
}

.supplement-clock-body {
  margin-top: 12px;
}

.clock-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.clock-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: var(--green-light);
}

.clock-copy {
  min-width: 0;
  flex: 1;
}

.clock-copy strong {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}

.clock-copy p {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.clock-list button {
  flex-shrink: 0;
  white-space: nowrap;
}

.clock-feedback {
  margin: 10px 0 0;
}

@media (max-width: 760px) {
  .food-filters,
  .food-card-grid {
    grid-template-columns: 1fr;
  }

  .clock-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .clock-list button {
    width: 100%;
  }
}
</style>
