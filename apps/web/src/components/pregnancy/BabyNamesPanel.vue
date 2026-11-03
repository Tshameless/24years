<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import { useFamily } from '@/composables/useFamily';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';

type BabyName = Extract<PregnancyRecord, { type: 'babyName' }>;

const { familyMode } = useFamily();
const { records, disabled, save, remove, error, reportError, message } = usePregnancyRecords();

const filterMode = shallowRef<'all' | 'consensus' | 'liked'>('all');

const entries = computed(() =>
  records.value
    .filter((item): item is BabyName => item.type === 'babyName')
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'zh-CN')),
);

const consensusCount = computed(
  () => entries.value.filter((item) => item.likedByMother && item.likedByFather).length,
);

const visibleEntries = computed(() =>
  entries.value.filter((item) => {
    if (filterMode.value === 'consensus') {
      return familyMode.value === 'couple'
        ? item.likedByMother && item.likedByFather
        : item.likedBySingle;
    }

    if (filterMode.value === 'liked') {
      return familyMode.value === 'couple'
        ? item.likedByMother || item.likedByFather
        : item.likedBySingle;
    }

    return true;
  }),
);

const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'babyName',
  defaults: () => ({
    name: '',
    pronunciation: '',
    meaning: '',
    likedByMother: false,
    likedByFather: false,
    likedBySingle: false,
    date: localDate(),
    notes: '',
  }),
  fields: (item: BabyName) => ({
    name: item.name,
    pronunciation: item.pronunciation ?? '',
    meaning: item.meaning,
    likedByMother: item.likedByMother,
    likedByFather: item.likedByFather,
    likedBySingle: item.likedBySingle,
    date: item.date,
    notes: item.notes,
  }),
});

async function toggleLike(
  item: BabyName,
  field: 'likedByMother' | 'likedByFather' | 'likedBySingle',
) {
  if (disabled.value) {
    return;
  }

  await save({
    type: 'pregnancy',
    before: item,
    value: {
      ...item,
      [field]: !item[field],
    },
  });
}

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  reportError('');

  const pronunciation = form.pronunciation.trim();
  const value: BabyName = {
    id: before.value?.id ?? draft.id.value,
    type: 'babyName',
    date: form.date,
    name: form.name.trim(),
    ...(pronunciation ? { pronunciation } : {}),
    meaning: form.meaning.trim(),
    likedByMother: form.likedByMother,
    likedByFather: form.likedByFather,
    likedBySingle: form.likedBySingle,
    notes: form.notes.trim(),
  };

  if (!validPregnancyRecord(value) || value.date > localDate()) {
    reportError('请填写候选名字（不超过 40 字）与不晚于今天的日期。');

    return;
  }

  if (await save({ type: 'pregnancy', before: before.value, value })) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>起名灵感与寄语</h2>
        <span class="tag">
          {{
            familyMode === 'couple'
              ? `共 ${entries.length} 个 · 默契 ${consensusCount} 个`
              : `共 ${entries.length} 个候选`
          }}
        </span>
      </div>
      <p class="muted">
        随时记下灵光一闪的大名或乳名、读音与寓意。启用家庭同步后，伴侣可各自标记心动名字，筛出双人默契候选。
      </p>

      <div
        v-if="entries.length"
        class="name-filters"
      >
        <label class="field">
          筛选候选
          <select v-model="filterMode">
            <option value="all">全部候选名字</option>
            <option
              v-if="familyMode === 'couple'"
              value="consensus"
            >
              双人默契心动（妈妈 & 爸爸均喜欢）
            </option>
            <option value="liked">
              {{ familyMode === 'couple' ? '任一方心动候选' : '心仪标星候选' }}
            </option>
          </select>
        </label>
      </div>

      <p
        v-if="!entries.length"
        class="empty-state"
      >
        还没有候选名字，想到喜欢的字词或小名时随时记下即可。
      </p>
      <ul
        v-else-if="visibleEntries.length"
        class="record-list"
      >
        <li
          v-for="item in visibleEntries"
          :key="item.id"
        >
          <div class="record-heading">
            <div class="name-title-row">
              <strong class="candidate-name">{{ item.name }}</strong>
              <span
                v-if="item.pronunciation"
                class="pronunciation"
              >
                {{ item.pronunciation }}
              </span>
            </div>
            <span
              v-if="familyMode === 'couple' && item.likedByMother && item.likedByFather"
              class="tag consensus-badge"
            >
              双人默契
            </span>
            <span
              v-else-if="familyMode === 'single' && item.likedBySingle"
              class="tag consensus-badge"
            >
              心仪候选
            </span>
          </div>
          <p
            v-if="item.meaning"
            class="record-notes"
          >
            寓意：{{ item.meaning }}
          </p>
          <p
            v-if="item.notes"
            class="muted"
          >
            寄语：{{ item.notes }}
          </p>
          <p class="muted">{{ item.date }}</p>

          <div class="name-like-bar">
            <template v-if="familyMode === 'couple'">
              <button
                type="button"
                class="like-chip"
                :class="{ active: item.likedByMother }"
                :disabled="disabled"
                @click="toggleLike(item, 'likedByMother')"
              >
                {{ item.likedByMother ? '♥ 妈妈心动' : '♡ 妈妈心动' }}
              </button>
              <button
                type="button"
                class="like-chip"
                :class="{ active: item.likedByFather }"
                :disabled="disabled"
                @click="toggleLike(item, 'likedByFather')"
              >
                {{ item.likedByFather ? '♥ 爸爸心动' : '♡ 爸爸心动' }}
              </button>
            </template>
            <button
              v-else
              type="button"
              class="like-chip"
              :class="{ active: item.likedBySingle }"
              :disabled="disabled"
              @click="toggleLike(item, 'likedBySingle')"
            >
              {{ item.likedBySingle ? '★ 心仪候选' : '☆ 标为心仪' }}
            </button>
          </div>

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
      <p
        v-else
        class="empty-state"
      >
        当前筛选条件下暂无候选名字。
      </p>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑候选名字' : '记录名字灵感' }}</h2>
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
          <label class="field">
            候选名字或小名
            <input
              v-model="form.name"
              required
              maxlength="40"
              placeholder="例如：知夏、小满、安禾"
            />
          </label>
          <label class="field">
            拼音或读音备注（可选）
            <input
              v-model="form.pronunciation"
              maxlength="60"
              placeholder="例如：zhī xià"
            />
          </label>
          <label class="field">
            寓意与出处（可选）
            <textarea
              v-model="form.meaning"
              rows="3"
              maxlength="500"
              placeholder="记录喜欢的诗词出处、字义或音律考量"
            />
          </label>

          <template v-if="familyMode === 'couple'">
            <label class="check-option">
              <input
                v-model="form.likedByMother"
                type="checkbox"
              />
              妈妈心动候选
            </label>
            <label class="check-option">
              <input
                v-model="form.likedByFather"
                type="checkbox"
              />
              爸爸心动候选
            </label>
          </template>
          <label
            v-else
            class="check-option"
          >
            <input
              v-model="form.likedBySingle"
              type="checkbox"
            />
            标为心仪候选
          </label>

          <label class="field">
            记录日期
            <input
              v-model="form.date"
              type="date"
              required
              :max="localDate()"
            />
          </label>
          <label class="field">
            给宝宝的寄语或备注（可选）
            <textarea
              v-model="form.notes"
              rows="3"
              maxlength="2000"
              placeholder="写下此刻期待的心情或家人的讨论"
            />
          </label>
          <button class="button button-primary">
            {{ before ? '保存名字修改' : '保存名字灵感' }}
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

<style scoped>
.name-filters {
  margin: 12px 0 16px;
}

.name-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.candidate-name {
  font-size: 16px;
}

.pronunciation {
  font-size: 13px;
  color: var(--text-secondary);
}

.consensus-badge {
  background: var(--pink-light);
  color: var(--primary-ink);
}

.name-like-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.like-chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--canvas);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.like-chip.active {
  border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
  background: var(--pink-light);
  color: var(--primary-ink);
  font-weight: 600;
}

.like-chip:disabled {
  opacity: 60%;
  cursor: not-allowed;
}
</style>
