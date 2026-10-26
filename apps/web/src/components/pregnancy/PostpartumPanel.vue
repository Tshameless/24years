<script setup lang="ts">
import { computed } from 'vue';
import FormDraftNotice from '@/components/FormDraftNotice.vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import { localDate, validPregnancyRecord, type PregnancyRecord } from '@/domain/family';

type Postpartum = Extract<PregnancyRecord, { type: 'postpartum' }>;
const { records, outcome, outcomeDisabled, savePostpartum, error, message, reportError } =
  usePregnancyRecords();
const saved = computed(
  () => records.value.find((item): item is Postpartum => item.type === 'postpartum') ?? null,
);
const { form, before, stale, draft, reset, cancel } = usePregnancyDraft({
  type: 'postpartum',
  initial: saved.value,
  defaults: () => ({
    date: localDate(),
    followupDate: '',
    newbornFollowupDate: '',
    supportPerson: '',
    recovery: '',
    feeding: '',
    questions: '',
    notes: '',
  }),
  fields: (item: Postpartum) => ({
    date: item.date,
    followupDate: item.followupDate ?? '',
    newbornFollowupDate: item.newbornFollowupDate ?? '',
    supportPerson: item.supportPerson,
    recovery: item.recovery,
    feeding: item.feeding,
    questions: item.questions,
    notes: item.notes,
  }),
});
const fields = [
  { key: 'recovery', label: '恢复与休息安排' },
  { key: 'feeding', label: '喂养与照护交接' },
  { key: 'questions', label: '复诊想问的问题' },
  { key: 'notes', label: '出院交代与其他备注' },
] as const;

async function submit() {
  if (outcomeDisabled.value || stale.value) {
    return;
  }

  reportError('');

  const value: Postpartum = {
    id: 'postpartum-plan',
    type: 'postpartum',
    date: form.date,
    supportPerson: form.supportPerson.trim(),
    recovery: form.recovery.trim(),
    feeding: form.feeding.trim(),
    questions: form.questions.trim(),
    notes: form.notes.trim(),
    ...(form.followupDate ? { followupDate: form.followupDate } : {}),
    ...(form.newbornFollowupDate ? { newbornFollowupDate: form.newbornFollowupDate } : {}),
  };

  if (!validPregnancyRecord(value) || !outcome.value || value.date < outcome.value.date) {
    reportError('交接日期不能早于分娩日期，复诊日期不能早于交接日期。');

    return;
  }

  if (await savePostpartum({ type: 'pregnancy', before: before.value, value })) {
    reset(value);
  }
}

async function remove() {
  if (
    !before.value ||
    outcomeDisabled.value ||
    stale.value ||
    !window.confirm('删除产后交接记录？请先确认重要安排已有备份。')
  ) {
    return;
  }

  if (await savePostpartum({ type: 'pregnancy', before: before.value, value: null })) {
    reset();
  }
}
</script>

<template>
  <section
    v-if="outcome?.kind !== 'birth'"
    class="panel empty-state"
  >
    <h2>产后交接</h2>
    <p>记录实际分娩后，再整理出院交代、复诊和家庭照护分工。</p>
    <RouterLink
      class="button button-secondary"
      to="/pregnancy?tab=outcome"
    >
      查看分娩与孕期结束
    </RouterLink>
  </section>
  <section
    v-else
    class="panel"
  >
    <div class="panel-heading">
      <h2>产后交接</h2>
      <span class="tag">分娩日期 {{ outcome.date }}</span>
    </div>
    <p class="muted">
      按出院医嘱填写复诊日期与照护安排。这里不自动推算医疗随访时间；要设置每日分工或时间提醒，可继续使用日常计划。
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
          交接日期
          <input
            v-model="form.date"
            type="date"
            :min="outcome.date"
            required
          />
        </label>
        <div class="form-row">
          <label class="field">
            产后复诊日期（按医嘱）
            <input
              v-model="form.followupDate"
              type="date"
              :min="form.date"
            />
          </label>
          <label class="field">
            新生儿随访日期（按医嘱）
            <input
              v-model="form.newbornFollowupDate"
              type="date"
              :min="form.date"
            />
          </label>
        </div>
        <label class="field">
          照护支持与联系人
          <input
            v-model="form.supportPerson"
            maxlength="80"
          />
        </label>
        <label
          v-for="item in fields"
          :key="item.key"
          class="field"
        >
          {{ item.label }}
          <textarea
            v-model="form[item.key]"
            rows="4"
            maxlength="2000"
          />
        </label>
        <div class="form-actions">
          <button class="button button-primary">保存产后交接</button>
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
            @click="remove"
          >
            删除交接记录
          </button>
        </div>
      </fieldset>
    </form>
    <p
      v-if="stale"
      class="form-error"
      role="alert"
    >
      交接记录已有更新，请放弃草稿后载入最新记录。
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
    <div class="form-actions">
      <RouterLink
        class="button button-secondary"
        to="/tasks"
      >
        安排照护计划与提醒
      </RouterLink>
      <RouterLink
        class="button button-secondary"
        to="/ledger"
      >
        记录住院费用与报销
      </RouterLink>
      <RouterLink
        class="button button-secondary"
        to="/family"
      >
        备份全部记录
      </RouterLink>
    </div>
  </section>
</template>
