<script setup lang="ts">
import { computed } from 'vue';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import { useFamily } from '@/composables/useFamily';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import {
  childIdForOutcome,
  localDate,
  validPregnancyRecord,
  type Child,
  type PregnancyOutcome,
} from '@/domain/family';

const { outcome, outcomeDisabled, saveOutcome, error, message, reportError } =
  usePregnancyRecords();
const familyStore = useFamily();
const syncedChild = computed(() => {
  const currentOutcome = outcome.value;

  return currentOutcome?.kind === 'birth'
    ? familyStore.data.value.children.find(
        (child) =>
          child.sourceOutcomeId === currentOutcome.id ||
          child.id === childIdForOutcome(currentOutcome.id),
      )
    : null;
});
const { form, before, stale, draft, reset, cancel } = usePregnancyDraft({
  type: 'outcome',
  initial: outcome.value,
  defaults: () => ({
    kind: 'birth',
    date: localDate(),
    time: '',
    mode: 'unknown',
    location: '',
    babyName: '',
    birthGestationalWeeks: '',
    birthWeightGrams: '',
    birthLengthCm: '',
    headCircumferenceCm: '',
    apgarOne: '',
    apgarFive: '',
    notes: '',
  }),
  fields: (item: PregnancyOutcome) => ({
    kind: item.kind,
    date: item.date,
    time: item.time ?? '',
    mode: item.mode ?? 'unknown',
    location: item.location ?? '',
    babyName: item.babyName ?? '',
    birthGestationalWeeks: String(item.birthGestationalWeeks ?? ''),
    birthWeightGrams: String(item.birthWeightGrams ?? ''),
    birthLengthCm: String(item.birthLengthCm ?? ''),
    headCircumferenceCm: String(item.headCircumferenceCm ?? ''),
    apgarOne: String(item.apgarOne ?? ''),
    apgarFive: String(item.apgarFive ?? ''),
    notes: item.notes,
  }),
});
const measurements = [
  { key: 'birthGestationalWeeks', label: '出生孕周（周，可留空）', max: 45, step: 1, min: 20 },
  { key: 'birthWeightGrams', label: '出生体重（克）', max: 10000, step: 1, min: 1 },
  { key: 'birthLengthCm', label: '出生身长（厘米）', max: 100, step: 0.1, min: 0.1 },
  { key: 'headCircumferenceCm', label: '头围（厘米）', max: 100, step: 0.1, min: 0.1 },
  { key: 'apgarOne', label: '1 分钟 Apgar（按病历）', max: 10, step: 1, min: 0 },
  { key: 'apgarFive', label: '5 分钟 Apgar（按病历）', max: 10, step: 1, min: 0 },
] as const;
const birth = computed(() => form.kind === 'birth');

function linkedChildFor(outcome: PregnancyOutcome | null) {
  if (!outcome) {
    return null;
  }

  const children = familyStore.data.value.children;
  const linked = children.find(
    (child) => child.sourceOutcomeId === outcome.id || child.id === childIdForOutcome(outcome.id),
  );

  if (linked || outcome.kind !== 'birth') {
    return linked ?? null;
  }

  const matches = children.filter(
    (child) =>
      child.birthDate === outcome.date && child.name === (outcome.babyName?.trim() || '宝宝'),
  );

  return matches.length === 1 ? matches[0] : null;
}

function childChangeWhenEnding(outcome: PregnancyOutcome | null) {
  const child = linkedChildFor(outcome);

  if (!child || !outcome || outcome.kind !== 'birth') {
    return null;
  }

  const canDelete =
    child.sourceOutcomeId === outcome.id && (child.growthRecords?.length ?? 0) === 0;
  const remove =
    canDelete &&
    window.confirm(
      `「${child.name}」档案由本次分娩记录自动创建且没有成长记录。确定同时删除该档案？取消将保留档案并解除关联。`,
    );

  if (remove) {
    return { before: child, value: null };
  }

  const detached = { ...child };
  delete detached.sourceOutcomeId;

  return { before: child, value: detached };
}

async function submit() {
  if (outcomeDisabled.value || stale.value) {
    return;
  }

  reportError('');

  const value = {
    id: 'pregnancy-outcome',
    type: 'outcome',
    kind: form.kind,
    date: form.date,
    ...(form.time ? { time: form.time } : {}),
    notes: form.notes.trim(),
    ...(birth.value
      ? {
          mode: form.mode,
          ...(form.location.trim() ? { location: form.location.trim() } : {}),
          ...(form.babyName.trim() ? { babyName: form.babyName.trim() } : {}),
          ...Object.fromEntries(
            measurements
              .filter(({ key }) => String(form[key]).trim() !== '')
              .map(({ key }) => [key, Number(form[key])]),
          ),
        }
      : {}),
  };

  const previousOutcome = before.value?.type === 'outcome' ? before.value : null;
  const children = familyStore.data.value.children;
  const linkedChild =
    linkedChildFor(previousOutcome) ??
    children.find(
      (child) =>
        child.sourceOutcomeId === 'pregnancy-outcome' ||
        child.id === childIdForOutcome('pregnancy-outcome'),
    ) ??
    null;

  if (
    !validPregnancyRecord(value) ||
    value.date > localDate() ||
    (birth.value &&
      measurements.some(
        ({ key, step }) =>
          form[key] !== '' &&
          (!/^\d+(?:\.\d+)?$/.test(form[key]) || (step === 1 && !/^\d+$/.test(form[key]))),
      ))
  ) {
    reportError('请检查日期与出生数据；体重和 Apgar 须为整数，实际结束日期不能晚于今天。');

    return;
  }

  if (
    !window.confirm(
      birth.value
        ? '确认保存分娩记录？孕期记录将转为只读，并开启产后交接。'
        : '确认记录孕期结束？历史记录将保留，并开启静默关怀。',
    )
  ) {
    return;
  }

  const change: Parameters<typeof saveOutcome>[0] = {
    type: 'pregnancy',
    before: before.value,
    value,
  };

  if (birth.value) {
    const babyName = form.babyName.trim() || '宝宝';
    const birthGestationalWeeks = form.birthGestationalWeeks
      ? Number(form.birthGestationalWeeks)
      : previousOutcome?.birthGestationalWeeks !== undefined
        ? undefined
        : linkedChild?.birthGestationalWeeks;
    const child: Child = {
      ...linkedChild,
      id: linkedChild?.id ?? childIdForOutcome(value.id),
      name: babyName,
      birthDate: value.date,
      sourceOutcomeId: value.id,
      ...(birthGestationalWeeks !== undefined ? { birthGestationalWeeks } : {}),
      birthWeightGrams: form.birthWeightGrams ? Number(form.birthWeightGrams) : undefined,
      birthLengthCm: form.birthLengthCm ? Number(form.birthLengthCm) : undefined,
      headCircumferenceCm: form.headCircumferenceCm ? Number(form.headCircumferenceCm) : undefined,
      notes: form.notes.trim()
        ? `出生记录：${form.notes.trim()}`
        : linkedChild?.notes?.startsWith('出生记录：')
          ? undefined
          : linkedChild?.notes,
    };

    if (birthGestationalWeeks === undefined) {
      delete child.birthGestationalWeeks;
    }

    change.child = { before: linkedChild, value: child };
  } else if (previousOutcome?.kind === 'birth') {
    change.child = childChangeWhenEnding(previousOutcome) ?? undefined;
  }

  if (await saveOutcome(change)) {
    reset(value as PregnancyOutcome);
  }
}

async function reopen() {
  if (!before.value || outcomeDisabled.value || stale.value || !draft.confirmDiscard()) {
    return;
  }

  if (
    !window.confirm(
      '仅用于更正误操作：撤销结束记录并恢复孕期编辑？已有历史保留，静默关怀需在家庭设置中自行调整。',
    )
  ) {
    return;
  }

  const previousOutcome = before.value.type === 'outcome' ? before.value : null;
  const change: Parameters<typeof saveOutcome>[0] = {
    type: 'pregnancy',
    before: before.value,
    value: null,
  };

  if (previousOutcome?.kind === 'birth') {
    change.child = childChangeWhenEnding(previousOutcome) ?? undefined;
  }

  if (await saveOutcome(change)) {
    reset();
  }
}
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <h2>分娩与孕期结束</h2>
      <span class="tag">{{ outcome ? '已归档' : '由你确认' }}</span>
    </div>
    <p class="muted">
      只有你确认实际结束日期后，才会切换阶段。历史记录、账本和日常计划都会保留。已保存的信息随家庭共享。
    </p>
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
        :disabled="outcomeDisabled || stale"
      >
        <label class="field">
          结束方式
          <select
            v-model="form.kind"
            aria-label="结束方式"
          >
            <option value="birth">已分娩</option>
            <option value="ended">其他原因结束孕期</option>
          </select>
        </label>
        <div class="form-row">
          <label class="field">
            实际结束日期
            <input
              v-model="form.date"
              type="date"
              :max="localDate()"
              required
            />
          </label>
          <label class="field">
            时间（可留空）
            <input
              v-model="form.time"
              type="time"
            />
          </label>
        </div>
        <template v-if="birth">
          <label class="field">
            分娩方式
            <select v-model="form.mode">
              <option value="unknown">未填写</option>
              <option value="vaginal">阴道分娩</option>
              <option value="cesarean">剖宫产</option>
              <option value="assisted">助产分娩</option>
            </select>
          </label>
          <label class="field">
            分娩地点（可留空）
            <input
              v-model="form.location"
              maxlength="100"
            />
          </label>
          <label class="field">
            宝宝称呼（可留空）
            <input
              v-model="form.babyName"
              maxlength="40"
            />
          </label>
          <p class="muted">以下仅抄录出生病历，可全部留空，不用于自行评分或诊断。</p>
          <label
            v-for="item in measurements"
            :key="item.key"
            class="field"
          >
            {{ item.label }}
            <input
              :value="form[item.key]"
              type="number"
              :inputmode="item.step === 1 ? 'numeric' : 'decimal'"
              :min="item.min"
              :max="item.max"
              :step="item.step"
              @input="form[item.key] = ($event.target as HTMLInputElement).value"
            />
          </label>
        </template>
        <p
          v-else
          class="muted"
        >
          不需要说明原因。保存后首页会隐藏孕周、倒计时和任务提示，你仍可随时查阅记录。
        </p>
        <label class="field">
          结束记录备注
          <textarea
            v-model="form.notes"
            maxlength="2000"
            rows="4"
          />
        </label>
        <div class="form-actions">
          <button class="button button-primary">
            {{ before ? '保存结束记录修改' : '确认结束孕期' }}
          </button>
          <button
            v-if="before"
            class="button button-secondary"
            type="button"
            @click="cancel"
          >
            放弃修改
          </button>
          <button
            v-if="before"
            class="text-button"
            type="button"
            @click="reopen"
          >
            撤销结束记录
          </button>
        </div>
      </fieldset>
    </form>
    <p
      v-if="stale"
      class="form-error"
      role="alert"
    >
      结束记录已有更新，请放弃草稿后载入最新记录。
    </p>
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
    <div
      v-if="outcome?.kind === 'birth' && syncedChild"
      class="child-sync-banner"
    >
      <p>
        已同步登记新生儿成长档案：
        <strong>{{ syncedChild.name }}</strong>
        （出生日期：{{ syncedChild.birthDate }}）
      </p>
    </div>
    <RouterLink
      v-if="outcome?.kind === 'birth'"
      class="button button-secondary"
      to="/pregnancy?tab=postpartum"
    >
      进入产后交接
    </RouterLink>
  </section>
</template>

<style scoped>
.child-sync-banner {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--pink-light);
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
  font-size: 0.9rem;
}

.child-sync-banner p {
  margin: 0;
  color: var(--text-heading);
}
</style>
