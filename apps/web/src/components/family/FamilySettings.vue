<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { dueDateFromGestation, localDate, pregnancyProgress } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';

const { data, saveProfile, exportBackup, locked } = useFamily();

// Anchor the draft to the displayed date; saving after midnight must not shift it.
const referenceDate = localDate();
const initialProgress = data.value.profile
  ? pregnancyProgress(data.value.profile.dueDate, referenceDate)
  : null;

const form = reactive({
  name: data.value.profile?.name ?? '',
  nickname: data.value.profile?.nickname ?? '',
  weeks: initialProgress?.weeks ?? ('' as number | ''),
  days: initialProgress?.days ?? 0,
  quietMode: data.value.profile?.quietMode ?? false,
});

const estimatedDueDate = computed(() =>
  typeof form.weeks === 'number'
    ? dueDateFromGestation(form.weeks, form.days, referenceDate)
    : null,
);

const error = shallowRef('');
const saved = shallowRef(false);

function submit() {
  error.value = '';
  saved.value = false;

  if (!form.name.trim() || !form.nickname.trim()) {
    error.value = '请填写家庭名称和你的称呼。';

    return;
  }

  if (!estimatedDueDate.value) {
    error.value = '请填写有效怀孕时期：孕周为 0–42 的整数，天数为 0–6。';

    return;
  }

  saved.value = saveProfile({
    name: form.name.trim(),
    nickname: form.nickname.trim(),
    dueDate: estimatedDueDate.value,
    quietMode: form.quietMode,
  });
}
</script>

<template>
  <div class="settings-grid">
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ data.profile ? '家庭档案' : '从认识你开始' }}</h2>
        <span class="tag">单人模式</span>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
        @input="saved = false"
      >
        <label class="field">
          家庭名称
          <input
            v-model="form.name"
            required
            maxlength="30"
            placeholder="给你们的小家起个名字"
            autocomplete="off"
          />
        </label>
        <label class="field">
          怎么称呼你
          <input
            v-model="form.nickname"
            required
            maxlength="20"
            placeholder="你喜欢的称呼"
            autocomplete="nickname"
          />
        </label>
        <fieldset class="gestation-fields">
          <legend>怀孕时期</legend>
          <p
            id="gestation-help"
            class="gestation-help"
          >
            按 {{ referenceDate }} 已满的孕周填写，例如 24 周 3 天。
          </p>
          <div class="form-row">
            <div class="field">
              <label for="gestation-weeks">孕周（周）</label>
              <input
                id="gestation-weeks"
                v-model.number="form.weeks"
                type="number"
                inputmode="numeric"
                min="0"
                max="42"
                step="1"
                placeholder="例如：24"
                aria-describedby="gestation-help"
                required
              />
            </div>
            <div class="field">
              <label for="gestation-days">天数（天）</label>
              <select
                id="gestation-days"
                v-model.number="form.days"
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
        <label class="quiet-option">
          <input
            v-model="form.quietMode"
            type="checkbox"
          />
          <span>
            <strong>静默关怀</strong>
            <small>隐藏首页孕周、倒计时与每日任务，保留所有历史记录。</small>
          </span>
        </label>
        <p
          v-if="error"
          class="form-error"
          role="alert"
        >
          {{ error }}
        </p>
        <div class="form-actions">
          <button
            class="button button-primary"
            :disabled="locked"
          >
            保存家庭档案
          </button>
          <span
            v-if="saved"
            class="success-message"
            role="status"
          >
            家庭档案已保存
          </span>
        </div>
      </form>
    </section>
    <aside class="settings-aside">
      <section class="panel data-note">
        <span class="empty-icon">
          <AppIcon
            name="shield"
            :size="26"
          />
        </span>
        <h2>你的记录，由你掌握</h2>
        <p class="muted">
          当前版本不需要账号，数据仅保存在本机浏览器，尚未加密。请避免录入身份证、完整病历等敏感资料。
        </p>
        <p class="muted">
          清除浏览器数据或更换设备后，记录不会自动保留。可导出 JSON 备份；本版尚不支持导入恢复。
        </p>
        <button
          class="button button-secondary"
          @click="exportBackup"
        >
          <AppIcon
            name="download"
            :size="17"
          />
          导出我的数据
        </button>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr);
  gap: 26px;
  align-items: start;
}

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

.quiet-option {
  display: flex;
  align-items: start;
  gap: 12px;
  padding: 20px 15px;
  background: var(--green-light);
  border-radius: 10px;
  cursor: pointer;
}

.quiet-option input {
  width: 20px;
  height: 20px;
  accent-color: var(--green);
  flex-shrink: 0;
}

.quiet-option strong {
  display: block;
  font-size: 14px;
  margin-bottom: 8px;
}

.quiet-option small {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.8;
}

.data-note .empty-icon {
  margin: 0 0 22px;
}

.data-note h2 {
  margin-bottom: 18px;
}

.data-note .muted {
  font-size: 13px;
}

@media (max-width: 1000px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
