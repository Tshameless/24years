<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { dueDateFromGestation, localDate, pregnancyProgress } from '@/domain/family';
import AppIcon from '@/components/AppIcon.vue';
import AccountPanel from './AccountPanel.vue';
import FamilyPairing from './FamilyPairing.vue';
import FamilySetupChoice from './FamilySetupChoice.vue';
import type { FamilyMode, FamilyParentRole } from '@/domain/collaboration';

const { data, saveProfile, exportBackup, profileLocked, canManage, cloud } = useFamily();
const { active, state } = cloud;
const currentMember = computed(() =>
  state.value.family?.members.find((member) => member.id === state.value.user?.id),
);
const initialMode =
  state.value.family?.mode ??
  data.value.profile?.familyMode ??
  (data.value.profile ? 'single' : '');
const before = shallowRef(data.value.profile);
const dirty = shallowRef(false);

// Anchor the draft to the displayed date; saving after midnight must not shift it.
const referenceDate = shallowRef(localDate());
const initialProgress = data.value.profile
  ? pregnancyProgress(data.value.profile.dueDate, referenceDate.value)
  : null;

const form = reactive({
  familyMode: initialMode as FamilyMode | '',
  parentRole:
    (active.value ? currentMember.value?.familyRole : data.value.profile?.parentRole) ??
    ((initialMode === 'single' ? 'single_parent' : '') as FamilyParentRole | ''),
  name: data.value.profile?.name ?? '',
  nickname: data.value.profile?.nickname ?? '',
  weeks: initialProgress?.weeks ?? ('' as number | ''),
  days: initialProgress?.days ?? 0,
  quietMode: data.value.profile?.quietMode ?? false,
});

const estimatedDueDate = computed(() =>
  typeof form.weeks === 'number'
    ? dueDateFromGestation(form.weeks, form.days, referenceDate.value)
    : null,
);

const error = shallowRef('');
const saved = shallowRef(false);

const stale = computed(() => JSON.stringify(before.value) !== JSON.stringify(data.value.profile));

function reloadProfile() {
  before.value = data.value.profile;
  referenceDate.value = localDate();
  const progress = before.value
    ? pregnancyProgress(before.value.dueDate, referenceDate.value)
    : null;
  Object.assign(form, {
    familyMode:
      state.value.family?.mode ?? before.value?.familyMode ?? (before.value ? 'single' : ''),
    parentRole: (active.value ? currentMember.value?.familyRole : before.value?.parentRole) ?? '',
    name: before.value?.name ?? '',
    nickname: before.value?.nickname ?? '',
    weeks: progress?.weeks ?? '',
    days: progress?.days ?? 0,
    quietMode: before.value?.quietMode ?? false,
  });
  dirty.value = false;
  saved.value = false;
  cloud.clearError();
}

watch(
  () => data.value.profile,
  () => {
    if (!dirty.value && stale.value) {
      reloadProfile();
    }
  },
);

async function submit() {
  error.value = '';
  saved.value = false;

  if (
    !form.familyMode ||
    (form.familyMode === 'couple' && form.parentRole !== 'mother' && form.parentRole !== 'father')
  ) {
    error.value = '请选择家庭类型；多人家庭还需选择母亲或父亲身份。';

    return;
  }

  if (!form.name.trim() || !form.nickname.trim()) {
    error.value = '请填写家庭名称和你的称呼。';

    return;
  }

  if (!estimatedDueDate.value) {
    error.value = '请填写有效怀孕时期：孕周为 0–42 的整数，天数为 0–6。';

    return;
  }

  saved.value = await saveProfile(
    {
      name: form.name.trim(),
      nickname: form.nickname.trim(),
      dueDate: estimatedDueDate.value,
      quietMode: form.quietMode,
      familyMode: form.familyMode,
      parentRole:
        form.familyMode === 'single' ? 'single_parent' : (form.parentRole as FamilyParentRole),
    },
    before.value,
  );

  if (saved.value) {
    before.value = data.value.profile;
    dirty.value = false;
  }
}
</script>

<template>
  <div class="settings-grid">
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ data.profile ? '家庭档案' : '从认识你开始' }}</h2>
        <span class="tag">
          {{
            form.familyMode === 'couple'
              ? '多人家庭'
              : form.familyMode === 'single'
                ? '单人家庭'
                : '选择陪伴方式'
          }}
        </span>
      </div>
      <form
        class="form-grid"
        @submit.prevent="submit"
        @input="
          saved = false;
          dirty = true;
        "
        @change="
          saved = false;
          dirty = true;
        "
      >
        <FamilySetupChoice
          v-model:mode="form.familyMode"
          v-model:parent-role="form.parentRole"
          :disabled="profileLocked"
          :disable-single="(state.family?.members.length ?? 0) > 1"
        />
        <p
          v-if="!active && form.familyMode === 'couple'"
          class="gestation-help"
        >
          先保存档案，再开启账号同步，即可邀请另一位家长加入。当前支持母亲、父亲两位成员。
        </p>
        <p
          v-if="!canManage"
          class="muted"
        >
          家庭档案由管理员维护，你可以查看最新信息。
        </p>
        <p
          v-if="stale"
          class="form-error"
        >
          档案已有更新。你的输入已保留，载入最新档案后可重新编辑。
          <button
            type="button"
            class="text-button"
            @click="reloadProfile"
          >
            载入最新档案
          </button>
        </p>
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
            <span v-if="form.parentRole === 'father'">请填写母亲的怀孕时期。</span>
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
            :disabled="profileLocked || stale"
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
      <AccountPanel />
      <FamilyPairing />
      <section class="panel data-note">
        <span class="empty-icon">
          <AppIcon
            name="shield"
            :size="26"
          />
        </span>
        <h2>你的记录，由你掌握</h2>
        <p class="muted">
          {{
            active
              ? '同步模式的记录保存在服务端；家庭内成员按权限共同访问。退出账号不会删除已同步记录。'
              : '本机模式的数据保存在当前浏览器。开启同步并上传后，才会存入服务端。'
          }}
        </p>
        <p class="muted">
          可导出当前档案的 JSON 备份。未提交的表单不会自动同步，离开前请保存；本版尚不支持 JSON
          导入。
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

.settings-aside {
  display: grid;
  gap: 24px;
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
