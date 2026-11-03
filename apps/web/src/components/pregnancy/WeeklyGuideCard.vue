<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { pregnancyProgress } from '@/domain/family';
import { getWeeklyGuide, weeklyGuideStages, type WeeklyActionItem } from '@/domain/weeklyGuide';
import { useFamily } from '@/composables/useFamily';

const { data, today, familyMode, recordLocked, addTask, cloud } = useFamily();

const progress = computed(() =>
  data.value.profile ? pregnancyProgress(data.value.profile.dueDate, today.value) : null,
);
const currentStage = computed(() => getWeeklyGuide(progress.value?.weeks ?? 12));
const selectedStageId = shallowRef(currentStage.value.id);
const addingTitle = shallowRef('');
const notice = shallowRef('');
const actionError = shallowRef('');

watch(
  () => currentStage.value.id,
  (nextId) => {
    selectedStageId.value = nextId;
  },
);

const activeStage = computed(
  () => weeklyGuideStages.find((stage) => stage.id === selectedStageId.value) ?? currentStage.value,
);
const isCurrentStage = computed(() => activeStage.value.id === currentStage.value.id);
const actions = computed(() =>
  familyMode.value === 'couple' ? activeStage.value.coupleActions : activeStage.value.singleActions,
);
const actionHeading = computed(() =>
  familyMode.value === 'couple' ? '伴侣协同行动清单' : '本周自我照护与准备清单',
);

const tabQueryMap: Record<string, string> = {
  checkups: 'checkups',
  nutrition: 'nutrition',
  vitals: 'vitals',
  ultrasound: 'ultrasound',
  movements: 'movements',
  packing: 'packing',
  birthPlan: 'birth-plan',
  contractions: 'contractions',
  emergency: 'emergency',
};

function hasTask(item: WeeklyActionItem): boolean {
  return data.value.tasks.some((task) => task.title === item.title);
}

async function addToPlan(item: WeeklyActionItem) {
  if (recordLocked.value || addingTitle.value || hasTask(item)) {
    return;
  }

  notice.value = '';
  actionError.value = '';
  addingTitle.value = item.title;

  try {
    const assignee = familyMode.value === 'couple' ? 'father' : 'single_parent';
    const saved = await addTask({
      title: item.title,
      date: today.value,
      time: '19:30',
      repeat: 'once',
      assignee,
    });

    if (saved) {
      notice.value =
        cloud.active.value && !cloud.online.value
          ? `「${item.title}」已保存在本机，联网后自动同步。`
          : `已将「${item.title}」加入日常计划。`;
    } else {
      actionError.value = '暂时无法加入日常计划，请稍后重试。';
    }
  } finally {
    addingTitle.value = '';
  }
}
</script>

<template>
  <section
    class="weekly-guide-card"
    aria-label="分孕周科学指南"
  >
    <div class="guide-header">
      <div>
        <div class="guide-badges">
          <span class="tag">{{ activeStage.trimester }}</span>
          <span class="tag guide-stage-tag">{{ activeStage.rangeLabel }}</span>
          <span
            v-if="isCurrentStage && progress"
            class="current-week-pill"
          >
            当前孕 {{ progress.weeks }}+{{ progress.days }}
          </span>
        </div>
        <h3>{{ activeStage.title }}</h3>
      </div>
      <div class="guide-controls">
        <label class="field guide-select-field">
          浏览阶段
          <select v-model="selectedStageId">
            <option
              v-for="stage in weeklyGuideStages"
              :key="stage.id"
              :value="stage.id"
            >
              {{ stage.rangeLabel }} · {{ stage.title }}
            </option>
          </select>
        </label>
        <button
          v-if="!isCurrentStage"
          type="button"
          class="text-button"
          @click="selectedStageId = currentStage.id"
        >
          回到当前阶段
        </button>
      </div>
    </div>

    <div class="guide-grid">
      <article class="guide-block">
        <h4>胎儿发育特征</h4>
        <p>{{ activeStage.fetalMilestone }}</p>
      </article>
      <article class="guide-block">
        <h4>母体常见生理变化</h4>
        <p>{{ activeStage.maternalChanges }}</p>
      </article>
      <article class="guide-block guide-block-wide">
        <div class="guide-block-heading">
          <h4>阶段医疗与记录重点</h4>
          <RouterLink
            class="text-button"
            :to="`/pregnancy?tab=${tabQueryMap[activeStage.recommendedTab] ?? 'checkups'}`"
          >
            前往{{ activeStage.recommendedTabLabel }} →
          </RouterLink>
        </div>
        <p>{{ activeStage.checkupFocus }}</p>
      </article>
    </div>

    <div class="guide-actions-box">
      <div class="guide-block-heading">
        <h4>{{ actionHeading }}</h4>
        <small>可一键转为日常计划事项</small>
      </div>
      <ul class="guide-action-list">
        <li
          v-for="item in actions"
          :key="item.title"
        >
          <div class="guide-action-copy">
            <strong>{{ item.title }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <button
            type="button"
            class="button button-secondary button-sm"
            :disabled="recordLocked || hasTask(item) || addingTitle === item.title"
            @click="addToPlan(item)"
          >
            {{
              hasTask(item) ? '已在计划中' : addingTitle === item.title ? '添加中…' : '加入日常计划'
            }}
          </button>
        </li>
      </ul>
      <p
        v-if="notice"
        class="success-message guide-feedback"
        role="status"
      >
        {{ notice }}
      </p>
      <p
        v-if="actionError"
        class="form-error guide-feedback"
        role="alert"
      >
        {{ actionError }}
      </p>
    </div>
    <p class="muted guide-disclaimer">
      以上内容基于现代循证医学科普整理，个体产检时间与处置方案请始终以建档医院医嘱为准。
    </p>
  </section>
</template>

<style scoped>
.weekly-guide-card {
  margin-top: 22px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--canvas);
}

.guide-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.guide-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.guide-stage-tag {
  background: var(--pink-light);
  color: var(--primary-ink);
}

.current-week-pill {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.guide-header h3 {
  margin: 0;
  font-size: 17px;
}

.guide-controls {
  display: flex;
  align-items: end;
  gap: 10px;
  flex-wrap: wrap;
  min-width: min(100%, 280px);
}

.guide-select-field {
  flex: 1 1 220px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.guide-block {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.guide-block-wide {
  grid-column: 1 / -1;
}

.guide-block h4,
.guide-actions-box h4 {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--text-heading);
}

.guide-block p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.guide-block-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.guide-block-heading h4 {
  margin: 0;
}

.guide-block-heading small {
  color: var(--muted);
  font-size: 12px;
}

.guide-actions-box {
  margin-top: 14px;
  padding: 16px;
  border-radius: 10px;
  background: var(--green-light);
}

.guide-action-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.guide-action-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--green) 18%, transparent);
}

.guide-action-copy {
  min-width: 0;
  flex: 1;
}

.guide-action-copy strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}

.guide-action-copy p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.guide-action-list button {
  flex-shrink: 0;
  white-space: nowrap;
}

.guide-feedback {
  margin: 12px 0 0;
}

.guide-disclaimer {
  margin: 12px 0 0;
  font-size: 12px;
}

@media (max-width: 680px) {
  .guide-grid {
    grid-template-columns: 1fr;
  }

  .guide-action-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .guide-action-list button {
    width: 100%;
  }
}
</style>
