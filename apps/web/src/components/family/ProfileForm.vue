<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { useFamily } from '@/composables/useFamily';
import { useFormDraft } from '@/composables/useFormDraft';
import {
  pregnancyOutcome,
  dueDateFromGestation,
  localDate,
  pregnancyProgress,
  sameValue,
} from '@/domain/family';
import FamilySetupChoice from './FamilySetupChoice.vue';
import GestationFields from './GestationFields.vue';
import type { FamilyMode, FamilyParentRole } from '@/domain/collaboration';

const { data, saveProfile, profileLocked, canManage, cloud, identity } = useFamily();
const { active, state } = cloud;
const outcome = computed(() => pregnancyOutcome(data.value.pregnancyRecords));
const currentMember = computed(() =>
  state.value.family?.members.find((member) => member.id === state.value.user?.id),
);
const initialMode =
  state.value.family?.mode ??
  data.value.profile?.familyMode ??
  (data.value.profile ? 'single' : '');
const before = shallowRef(data.value.profile);

// Anchor the draft to the displayed date; saving after midnight must not shift it.
const initialDate = localDate();
const initialProgress = data.value.profile
  ? pregnancyProgress(data.value.profile.dueDate, initialDate)
  : null;

const form = reactive({
  referenceDate: initialDate,
  familyMode: initialMode as FamilyMode | '',
  parentRole:
    (active.value ? currentMember.value?.familyRole : data.value.profile?.parentRole) ??
    ((initialMode === 'single' ? 'single_parent' : '') as FamilyParentRole | ''),
  name: data.value.profile?.name ?? '',
  nickname: data.value.profile?.nickname ?? '',
  weeks: initialProgress ? String(initialProgress.weeks) : '',
  days: initialProgress?.days ?? 0,
  lmpDate: data.value.profile?.lmpDate ?? '',
  prePregnancyWeightKg:
    data.value.profile?.prePregnancyWeightKg === undefined
      ? ''
      : String(data.value.profile.prePregnancyWeightKg),
  heightCm: data.value.profile?.heightCm === undefined ? '' : String(data.value.profile.heightCm),
  quietMode: data.value.profile?.quietMode ?? false,
});

const draft = useFormDraft({
  form,
  scope: () => `${identity.value}:${cloud.role.value ?? 'local'}`,
  name: 'family-profile',
  baseline: () => data.value.profile,
});
const { dirty, restored, changedSource, storageError } = draft;

const estimatedDueDate = computed(() =>
  outcome.value
    ? (before.value?.dueDate ?? null)
    : form.weeks.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.referenceDate)
      ? dueDateFromGestation(Number(form.weeks), form.days, form.referenceDate)
      : null,
);

const error = shallowRef('');
const saved = shallowRef(false);

const stale = computed(() => !sameValue(before.value, data.value.profile));

function reloadProfile() {
  if (!draft.confirmDiscard()) {
    return;
  }

  before.value = data.value.profile;
  const referenceDate = localDate();
  const progress = before.value ? pregnancyProgress(before.value.dueDate, referenceDate) : null;
  Object.assign(form, {
    referenceDate,
    familyMode:
      state.value.family?.mode ?? before.value?.familyMode ?? (before.value ? 'single' : ''),
    parentRole: (active.value ? currentMember.value?.familyRole : before.value?.parentRole) ?? '',
    name: before.value?.name ?? '',
    nickname: before.value?.nickname ?? '',
    weeks: progress ? String(progress.weeks) : '',
    days: progress?.days ?? 0,
    lmpDate: before.value?.lmpDate ?? '',
    prePregnancyWeightKg:
      before.value?.prePregnancyWeightKg === undefined
        ? ''
        : String(before.value.prePregnancyWeightKg),
    heightCm: before.value?.heightCm === undefined ? '' : String(before.value.heightCm),
    quietMode: before.value?.quietMode ?? false,
  });
  draft.accept();
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

  if (profileLocked.value || stale.value || changedSource.value) {
    return;
  }

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

  const prePregnancyWeightKg = form.prePregnancyWeightKg.trim()
    ? Number(form.prePregnancyWeightKg)
    : undefined;
  const heightCm = form.heightCm.trim() ? Number(form.heightCm) : undefined;

  if (
    (prePregnancyWeightKg !== undefined &&
      (!Number.isFinite(prePregnancyWeightKg) || prePregnancyWeightKg <= 0 || prePregnancyWeightKg > 500)) ||
    (heightCm !== undefined &&
      (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250)) ||
    (form.lmpDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.lmpDate))
  ) {
    error.value = '请检查末次月经、孕前体重和身高。';

    return;
  }

  saved.value = await saveProfile(
    {
      name: form.name.trim(),
      nickname: form.nickname.trim(),
      dueDate: estimatedDueDate.value,
      quietMode: form.quietMode,
      ...(form.lmpDate ? { lmpDate: form.lmpDate } : {}),
      ...(prePregnancyWeightKg === undefined ? {} : { prePregnancyWeightKg }),
      ...(heightCm === undefined ? {} : { heightCm }),
      familyMode: form.familyMode,
      parentRole:
        form.familyMode === 'single' ? 'single_parent' : (form.parentRole as FamilyParentRole),
    },
    before.value,
  );

  if (saved.value) {
    before.value = data.value.profile;
    draft.accept();
  }
}
</script>

<template>
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
      @input="saved = false"
      @change="saved = false"
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
        v-if="stale || changedSource"
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
      <p
        v-if="restored || dirty"
        class="muted"
      >
        {{
          restored ? '已恢复当前标签页草稿。' : '未保存输入已暂存在当前标签页。'
        }}草稿不会自动提交。
        <button
          type="button"
          class="text-button"
          @click="reloadProfile"
        >
          放弃草稿，载入最新档案
        </button>
      </p>
      <p
        v-if="storageError"
        class="form-error"
        role="alert"
      >
        {{ storageError }}
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
      <p
        v-if="outcome"
        class="muted"
      >
        本次孕期已结束，原预产期 {{ data.profile?.dueDate }} 已保留。
        <RouterLink to="/pregnancy?tab=outcome">查看或更正结束记录</RouterLink>
      </p>
      <GestationFields
        v-else
        v-model:weeks="form.weeks"
        v-model:days="form.days"
        :reference-date="form.referenceDate"
        :parent-role="form.parentRole"
        :estimated-due-date="estimatedDueDate"
      />
      <div class="form-row">
        <label class="field">
          末次月经第一天（可选）
          <input
            v-model="form.lmpDate"
            type="date"
            :max="form.referenceDate"
          />
          <small>用于保留孕周推算依据；预产期仍以医生核准为准。</small>
        </label>
        <label class="field">
          孕前体重（kg，可选）
          <input
            v-model="form.prePregnancyWeightKg"
            type="number"
            min="1"
            max="500"
            step="0.1"
            inputmode="decimal"
          />
        </label>
      </div>
      <label class="field">
        身高（cm，可选）
        <input
          v-model="form.heightCm"
          type="number"
          min="50"
          max="250"
          step="0.1"
          inputmode="decimal"
        />
      </label>
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
          :disabled="profileLocked || stale || changedSource"
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
    <div
      v-if="saved && !form.quietMode"
      class="saved-next-steps"
    >
      <p>档案准备好了，接下来可以：</p>
      <RouterLink
        class="text-button"
        to="/"
      >
        回首页查看使用指引 →
      </RouterLink>
      <RouterLink
        class="text-button"
        to="/tasks"
      >
        创建第一项计划 →
      </RouterLink>
      <RouterLink
        class="text-button"
        to="/pregnancy?tab=checkups"
      >
        安排下一次产检 →
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.saved-next-steps {
  display: grid;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.saved-next-steps p {
  margin: 0;
  font-size: 13px;
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
</style>
