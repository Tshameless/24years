<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { usePregnancyRecords } from '@/composables/usePregnancyRecords';
import { checkupTemplates } from '@/domain/preparationTemplates';
import {
  addDays,
  isDate,
  localDate,
  parseMoney,
  type PregnancyRecord,
  type Expense,
} from '@/domain/family';
import {
  prenatalSchedule,
  scheduleDate,
  prenatalScheduleState,
  scheduledCheckup,
  type PrenatalScheduleItem,
} from '@/domain/prenatalSchedule';
import { useFamily } from '@/composables/useFamily';

import { usePregnancyDraft } from '@/composables/usePregnancyDraft';
import FormDraftNotice from '@/components/FormDraftNotice.vue';

type Checkup = Extract<PregnancyRecord, { type: 'checkup' }>;
const { records, disabled, message, error, reportError, save, remove, hasExpense } =
  usePregnancyRecords();
const family = useFamily();
const { data } = family;
const reminderNotice = shallowRef('');
const reminderError = shallowRef('');
const checkups = computed(() =>
  records.value
    .filter((item): item is Checkup => item.type === 'checkup')
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.date.localeCompare(b.date)),
);

const template = shallowRef('');

function applyTemplate() {
  const selected = checkupTemplates[Number(template.value)];

  if (template.value === '' || !selected || disabled.value || before.value || stale.value) {
    return;
  }

  if (
    (form.title.trim() !== '' || form.notes.trim() !== '') &&
    !window.confirm('用模板替换产检名称和备注？')
  ) {
    return;
  }

  Object.assign(form, selected);
}

const { form, before, stale, draft, reset, edit, cancel } = usePregnancyDraft({
  type: 'checkup',
  defaults: () => ({
    title: '',
    date: localDate(),
    notes: '',
    completed: false,
    amount: '',
    reimbursed: '0',
  }),
  fields: (item: Checkup) => ({
    title: item.title,
    date: item.date,
    notes: item.notes,
    completed: item.completed,
    amount: '',
    reimbursed: '0',
  }),
});

const schedule = computed(() =>
  prenatalSchedule
    .map((item) => ({
      ...item,
      date: scheduleDate(data.value.profile?.dueDate ?? localDate(), item.offsetWeeks),
      checkup: scheduledCheckup(records.value, item),
    }))
    .map((item) => ({
      ...item,
      state: prenatalScheduleState(item.date, family.today.value, item.checkup),
    })),
);

const scheduleStateLabels = {
  upcoming: '即将到期',
  due: '当前节点',
  past: '参考日期已过',
  scheduled: '已加入安排',
  completed: '已完成',
} as const;

const scheduleSummary = computed(() => ({
  completed: schedule.value.filter((item) => item.state === 'completed').length,
  scheduled: schedule.value.filter((item) => item.state === 'scheduled').length,
  due: schedule.value.filter((item) => item.state === 'due').length,
  past: schedule.value.filter((item) => item.state === 'past').length,
}));

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function exportCalendar() {
  if (!checkups.value.length) {
    reportError('请先添加至少一项产检安排。');

    return;
  }

  const events = checkups.value.map((item) => {
    const date = item.date.replace(/-/g, '');

    return [
      'BEGIN:VEVENT',
      `UID:${item.id}@24years`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcs(`产检：${item.title}`)}`,
      `DESCRIPTION:${escapeIcs(item.notes || '请按医院安排准备')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:三天后有产检安排，请确认医院通知与就诊资料。',
      'TRIGGER:-P3D',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:明天有产检安排，请确认就诊时间与出行安排。',
      'TRIGGER:-P1D',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });
  const blob = new Blob(
    [
      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//24Years//Pregnancy//CN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`,
    ],
    { type: 'text/calendar;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '24years-产检安排.ics';
  link.click();
  URL.revokeObjectURL(url);
}

function addScheduledCheckup(item: PrenatalScheduleItem & { date: string }) {
  if (disabled.value || before.value || stale.value) {
    return;
  }

  Object.assign(form, {
    title: item.title,
    date: item.date,
    notes: `${item.guidance}\n\n实际项目、日期与准备要求请向医院确认。`,
    completed: false,
  });
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function reminderTitle(title: string, kind: 'visit' | 'prep') {
  return kind === 'visit' ? `产检提醒：${title}` : `产检准备：${title}`;
}

async function addCheckupReminder(item: Checkup) {
  reminderNotice.value = '';
  reminderError.value = '';

  const visitTitle = reminderTitle(item.title, 'visit');
  const prepTitle = reminderTitle(item.title, 'prep');
  const hasVisit = family.data.value.tasks.some(
    (task) => task.title === visitTitle && task.date === item.date && task.repeat === 'once',
  );
  const prepDate = addDays(item.date, -1);
  const hasPrep = family.data.value.tasks.some(
    (task) => task.title === prepTitle && task.date === prepDate && task.repeat === 'once',
  );

  if (hasVisit && hasPrep) {
    reminderNotice.value = '这项产检的提醒已经在日常计划中。';

    return;
  }

  if (item.date < family.today.value) {
    reminderError.value = '已过日期不能加入日常计划。';

    return;
  }

  const visitAdded =
    hasVisit ||
    (await family.addTask({
      title: visitTitle,
      date: item.date,
      time: '09:00',
      repeat: 'once',
    }));
  const prepAdded =
    hasPrep ||
    (prepDate >= family.today.value &&
      (await family.addTask({
        title: prepTitle,
        date: prepDate,
        time: '20:00',
        repeat: 'once',
      })));

  if (visitAdded && (prepAdded || prepDate < family.today.value)) {
    reminderNotice.value = '已加入就诊提醒，并在前一晚加入准备提醒。';
  } else {
    reminderError.value = '提醒未完整加入，请检查日常计划状态后重试。';
  }
}

const linkedExpense = computed(() => !!before.value && hasExpense('checkup-' + before.value.id));
const canRecordExpense = computed(
  () => form.completed && !linkedExpense.value && (!before.value || !before.value.completed),
);

async function submit() {
  if (disabled.value || stale.value) {
    return;
  }

  reportError('');

  if (!form.title.trim() || !isDate(form.date)) {
    reportError('请填写产检名称和有效日期。');

    return;
  }

  const value: Checkup = {
    id: before.value?.id ?? draft.id.value,
    type: 'checkup',
    title: form.title.trim(),
    date: form.date,
    notes: form.notes.trim(),
    completed: form.completed,
  };
  let expense: Expense | undefined;

  if (canRecordExpense.value && !form.amount.trim() && parseMoney(form.reimbursed) !== 0) {
    reportError('填写报销金额时，请同时填写本次费用。');

    return;
  }

  if (canRecordExpense.value && form.amount.trim()) {
    const amount = parseMoney(form.amount);
    const reimbursed = parseMoney(form.reimbursed);

    if (
      amount === null ||
      reimbursed === null ||
      reimbursed > amount ||
      (amount === 0 && reimbursed !== 0)
    ) {
      reportError('费用最多两位小数，报销不能超过总额。');

      return;
    }

    if (amount > 0) {
      expense = {
        id: `checkup-${value.id}`,
        title: value.title,
        date: value.date,
        kind: 'expense',
        category: '产检医疗',
        amountCents: amount,
        reimbursedCents: reimbursed,
      };
    }
  }

  if (
    await save({ type: 'pregnancy', before: before.value, value, ...(expense ? { expense } : {}) })
  ) {
    reset();
  }
}
</script>

<template>
  <div class="pregnancy-columns">
    <section class="panel">
      <div class="panel-heading">
        <h2>产检安排</h2>
        <div class="heading-actions">
          <span class="tag">{{ checkups.length }} 次记录</span>
          <button
            class="text-button"
            type="button"
            @click="exportCalendar"
          >
            导出日历
          </button>
        </div>
      </div>
      <div class="schedule-card">
        <div class="schedule-heading">
          <div>
            <h3>孕周产检参考时间轴</h3>
            <p>根据当前预产期估算，仅用于提前整理；最终项目和日期以医院安排为准。</p>
          </div>
          <span class="tag">
            {{ data.profile?.dueDate ? `预产期 ${data.profile.dueDate}` : '未设置预产期' }}
          </span>
        </div>
        <div
          class="schedule-summary"
          aria-label="产检时间轴进度"
        >
          <span class="schedule-summary-item">
            <strong>{{ scheduleSummary.completed }}</strong>
            已完成
          </span>
          <span class="schedule-summary-item">
            <strong>{{ scheduleSummary.scheduled }}</strong>
            已加入安排
          </span>
          <span
            v-if="scheduleSummary.due"
            class="schedule-summary-item schedule-summary-current"
          >
            <strong>{{ scheduleSummary.due }}</strong>
            当前节点
          </span>
          <span
            v-if="scheduleSummary.past"
            class="schedule-summary-item schedule-summary-past"
          >
            <strong>{{ scheduleSummary.past }}</strong>
            参考日期已过
          </span>
        </div>
        <ol class="schedule-list">
          <li
            v-for="item in schedule"
            :key="item.title"
            :class="`schedule-state-${item.state}`"
          >
            <div>
              <div class="schedule-item-heading">
                <strong>{{ item.week }} · {{ item.title }}</strong>
                <span class="tag">{{ scheduleStateLabels[item.state] }}</span>
              </div>
              <small>预计 {{ item.date }}</small>
              <p>{{ item.guidance }}</p>
            </div>
            <button
              v-if="!item.checkup"
              type="button"
              class="text-button"
              :disabled="disabled"
              @click="addScheduledCheckup(item)"
            >
              {{ item.state === 'past' ? '补记安排' : '加入安排' }}
            </button>
            <button
              v-else-if="!item.checkup.completed"
              type="button"
              class="text-button"
              :disabled="disabled"
              @click="addCheckupReminder(item.checkup)"
            >
              加入提醒
            </button>
            <span
              v-else
              class="schedule-completed-mark"
              aria-label="已完成"
            >
              已完成
            </span>
          </li>
        </ol>
      </div>
      <p
        v-if="!checkups.length"
        class="empty-state"
      >
        还没有产检安排。按照医生的建议，记下下一次见面的时间。
      </p>
      <ul
        v-else
        class="record-list"
      >
        <li
          v-for="item in checkups"
          :key="item.id"
        >
          <div class="record-heading">
            <strong>{{ item.title }}</strong>
            <span class="tag">{{ item.completed ? '已完成' : '待产检' }}</span>
          </div>
          <p class="muted">{{ item.date }}</p>
          <p
            v-if="item.notes"
            class="record-notes"
          >
            {{ item.notes }}
          </p>
          <div class="record-actions">
            <button
              v-if="!item.completed"
              class="text-button"
              :disabled="disabled"
              @click="addCheckupReminder(item)"
            >
              加入计划提醒
            </button>
            <button
              class="text-button"
              :disabled="disabled"
              @click="edit(item)"
            >
              {{ item.completed ? '编辑记录' : '编辑 / 完成' }}
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
      <p class="calendar-note">
        导出的日历包含提前 3 天和 1 天提醒；是否弹出通知取决于导入的日历应用及设备通知设置。
      </p>
      <p
        v-if="reminderNotice"
        class="success-message"
        role="status"
      >
        {{ reminderNotice }}
      </p>
      <p
        v-if="reminderError"
        class="form-error"
        role="alert"
      >
        {{ reminderError }}
      </p>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ before ? '编辑产检' : '添加产检' }}</h2>
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
          :disabled="disabled || !!stale"
          class="record-fields"
        >
          <div
            v-if="!before"
            class="field"
          >
            <label for="checkup-template">就诊准备模板</label>
            <select
              id="checkup-template"
              v-model="template"
            >
              <option value="">请选择模板</option>
              <option
                v-for="(item, index) in checkupTemplates"
                :key="item.title"
                :value="String(index)"
              >
                {{ item.title }}
              </option>
            </select>
            <button
              type="button"
              class="button button-secondary"
              :disabled="template === ''"
              @click="applyTemplate"
            >
              填入就诊模板
            </button>
            <small>整理用途，不是标准产检排程；日期、项目与准备要求请向医院确认。</small>
          </div>
          <label class="field">
            产检名称
            <input
              v-model="form.title"
              required
              maxlength="80"
              placeholder="例如：常规产检"
            />
          </label>
          <label class="field">
            产检日期
            <input
              v-model="form.date"
              required
              type="date"
            />
          </label>
          <label class="field">
            产检备注
            <textarea
              v-model="form.notes"
              maxlength="2000"
              rows="4"
              placeholder="检查项目、医生建议或要问的问题"
            />
          </label>
          <label
            v-if="!before || !before.completed"
            class="check-option"
          >
            <input
              v-model="form.completed"
              type="checkbox"
            />
            本次产检已完成
          </label>
          <template v-if="canRecordExpense">
            <label class="field">
              本次费用（元，可留空）
              <input
                v-model="form.amount"
                inputmode="decimal"
                maxlength="11"
                placeholder="留空或填 0 不新增账目"
              />
            </label>
            <label class="field">
              本次已报销（元）
              <input
                v-model="form.reimbursed"
                inputmode="decimal"
                maxlength="11"
              />
            </label>
            <p class="muted">费用与完成状态一起保存到家庭账本。之后可在账本中编辑费用。</p>
          </template>
          <p
            v-if="linkedExpense"
            class="muted"
          >
            已有关联账目，金额请在家庭账本修改。删除产检记录不会删除账目。
          </p>
          <button class="button button-primary">
            {{ before ? '保存产检修改' : '保存产检安排' }}
          </button>
        </fieldset>
        <p
          v-if="stale"
          class="form-error"
          role="alert"
        >
          这条产检已变化。输入仍保留，请取消后重新编辑最新记录。
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
.schedule-card {
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--green-light);
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.schedule-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.schedule-heading h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.schedule-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 14px;
  padding: 10px 0;
  border-top: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
}

.schedule-summary-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}

.schedule-summary-item strong {
  color: var(--text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.schedule-item-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.schedule-list li > div {
  min-width: 0;
  flex: 1;
}

.schedule-completed-mark {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 12px;
}

.schedule-heading p,
.schedule-list p,
.calendar-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.calendar-note {
  margin: 0 0 14px;
}

.schedule-list {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.schedule-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--green) 20%, transparent);
}

.schedule-list small {
  display: block;
}

.schedule-list strong {
  font-size: 13px;
}

.schedule-list small {
  margin: 3px 0;
  color: var(--green);
  font-size: 12px;
}

@media (max-width: 600px) {
  .schedule-heading,
  .schedule-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .schedule-list .text-button {
    justify-content: flex-start;
  }
}
</style>
