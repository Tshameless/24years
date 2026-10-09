<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { addDays, dayDifference, isDate, localDate } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';

const { data, saveProfile, exportBackup, locked } = useFamily();

const form = reactive({
  name: data.value.profile?.name ?? '',
  nickname: data.value.profile?.nickname ?? '',
  dueDate: data.value.profile?.dueDate ?? '',
  quietMode: data.value.profile?.quietMode ?? false,
});

const error = shallowRef('');
const saved = shallowRef(false);

function submit() {
  error.value = '';
  saved.value = false;

  if (!form.name.trim() || !form.nickname.trim()) {
    error.value = '请填写家庭名称和你的称呼。';

    return;
  }

  if (!isDate(form.dueDate) || dayDifference(form.dueDate, localDate()) > 280) {
    error.value = '请填写有效预产期，且不晚于今天之后 280 天。';

    return;
  }

  saved.value = saveProfile({
    ...form,
    name: form.name.trim(),
    nickname: form.nickname.trim(),
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
        <div class="field">
          <label for="due-date">预产期</label>
          <input
            id="due-date"
            v-model="form.dueDate"
            type="date"
            :max="addDays(localDate(), 280)"
            aria-describedby="due-date-help"
            required
          />
          <small id="due-date-help">填写医生确认的日期。首页孕周仅作日历参考。</small>
        </div>
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
