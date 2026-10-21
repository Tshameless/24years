export interface FamilyProfile {
  name: string;
  nickname: string;
  dueDate: string;
  quietMode: boolean;
  /** Saved for local profiles so the first sync can use the same family choice. */
  familyMode?: 'single' | 'couple';
  parentRole?: 'single_parent' | 'mother' | 'father';
}

export interface FamilyTask {
  id: string;
  title: string;
  date: string;
  time: string;
  repeat: 'once' | 'daily' | 'weekly';
  /** ISO weekdays: Monday = 1, Sunday = 7. Required for weekly tasks. */
  weekdays?: readonly number[];
  completedDates: string[];
}

export const expenseCategories = ['产检医疗', '营养日用', '宝宝用品', '待产准备', '其他'] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export interface Expense {
  id: string;
  title: string;
  date: string;
  kind: 'expense' | 'allowance';
  category: ExpenseCategory;
  amountCents: number;
  reimbursedCents: number;
}

export interface FamilyData {
  version: 1;
  profile: FamilyProfile | null;
  tasks: FamilyTask[];
  expenses: Expense[];
  theme: 'light' | 'dark';
  pregnancyRecords?: PregnancyRecord[];
}

export type PregnancyRecord =
  | { id: string; type: 'bonding'; date: string; title: string; minutes: number; notes: string }
  | { id: string; type: 'mood'; date: string; title: string; notes: string }
  | { id: string; type: 'packing'; date: string; title: string; completed: boolean; notes: string }
  | { id: string; type: 'checkup'; title: string; date: string; notes: string; completed: boolean }
  | {
      id: string;
      type: 'vital';
      date: string;
      metric: 'weight' | 'bloodPressure' | 'glucose';
      value: number;
      secondary: number | null;
      notes: string;
    }
  | { id: string; type: 'contraction'; startedAt: number; endedAt: number | null }
  | {
      id: string;
      type: 'medical';
      hospital: string;
      contact: string;
      phone: string;
      notes: string;
    };

export interface PregnancyChange {
  type: 'pregnancy';
  before: PregnancyRecord | null;
  value: PregnancyRecord | null;
  /** Only a new checkup completion can create this expense, in the same transaction. */
  expense?: Expense;
}

export function validPregnancyRecord(value: unknown): value is PregnancyRecord {
  if (!isObject(value) || !shortText(value.id, 100)) {
    return false;
  }

  const note = (text: unknown) => typeof text === 'string' && text.length <= 2000;
  const positive = (n: unknown, max: number) =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max;
  switch (value.type) {
    case 'bonding':
      return (
        isDate(value.date) &&
        shortText(value.title, 80) &&
        note(value.notes) &&
        Number.isInteger(value.minutes) &&
        positive(value.minutes, 1440)
      );
    case 'mood':
      return (
        isDate(value.date) &&
        ['愉悦', '平静', '烦躁', '低落', '疲惫'].includes(String(value.title)) &&
        note(value.notes)
      );
    case 'packing':
      return (
        isDate(value.date) &&
        shortText(value.title, 80) &&
        typeof value.completed === 'boolean' &&
        note(value.notes)
      );
    case 'checkup':
      return (
        shortText(value.title, 80) &&
        isDate(value.date) &&
        note(value.notes) &&
        typeof value.completed === 'boolean'
      );
    case 'vital':
      return (
        isDate(value.date) &&
        note(value.notes) &&
        ((value.metric === 'weight' && positive(value.value, 1000) && value.secondary === null) ||
          (value.metric === 'glucose' && positive(value.value, 100) && value.secondary === null) ||
          (value.metric === 'bloodPressure' &&
            positive(value.value, 400) &&
            positive(value.secondary, 400)))
      );
    case 'contraction':
      return (
        Number.isSafeInteger(value.startedAt) &&
        positive(value.startedAt, 8640000000000000) &&
        (value.endedAt === null ||
          (Number.isSafeInteger(value.endedAt) &&
            typeof value.endedAt === 'number' &&
            value.endedAt >= Number(value.startedAt) &&
            value.endedAt <= 8640000000000000))
      );
    case 'medical':
      return (
        value.id === 'medical-card' &&
        typeof value.hospital === 'string' &&
        value.hospital.length <= 100 &&
        typeof value.contact === 'string' &&
        value.contact.length <= 50 &&
        typeof value.phone === 'string' &&
        /^[+\d ()-]{0,30}$/.test(value.phone) &&
        note(value.notes)
      );
    default:
      return false;
  }
}

export class PregnancyChangeError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Records are flat objects. Compare fields independently of JSON property ordering.
function sameRecord(a: PregnancyRecord | null, b: PregnancyRecord | null): boolean {
  if (!a || !b) {
    return a === b;
  }

  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(
      ([key, value]) => (b as unknown as Record<string, unknown>)[key] === value,
    )
  );
}

export function applyPregnancyChange(data: FamilyData, change: PregnancyChange): FamilyData {
  const { before, value, expense } = change;

  if (
    (before !== null && !validPregnancyRecord(before)) ||
    (value !== null && !validPregnancyRecord(value)) ||
    (!before && !value) ||
    (before && value && (before.id !== value.id || before.type !== value.type))
  ) {
    throw new PregnancyChangeError('记录格式无效。');
  }

  const id = (before ?? value)!.id;
  const records = data.pregnancyRecords ?? [];

  if (!sameRecord(records.find((item) => item.id === id) ?? null, before)) {
    throw new PregnancyChangeError('这条记录已变化，请重新打开最新记录，输入已保留。', 409);
  }

  const updated = [...records.filter((item) => item.id !== id), ...(value ? [value] : [])];

  if (
    data.profile?.quietMode &&
    !before &&
    value?.type === 'contraction' &&
    value.endedAt === null
  ) {
    throw new PregnancyChangeError('安静关怀期间暂停新计时，已有计时仍可结束。');
  }

  if (updated.filter((item) => item.type === 'contraction' && item.endedAt === null).length > 1) {
    throw new PregnancyChangeError('已有一次宫缩正在计时，请先结束它。', 409);
  }

  if (
    expense &&
    (!validExpense(expense) ||
      value?.type !== 'checkup' ||
      !value.completed ||
      before?.type !== 'checkup' ||
      before.completed ||
      expense.id !== `checkup-${id}` ||
      expense.kind !== 'expense' ||
      expense.category !== '产检医疗' ||
      expense.date !== value.date)
  ) {
    throw new PregnancyChangeError('产检费用格式无效。');
  }

  if (expense && data.expenses.some((item) => item.id === expense.id)) {
    throw new PregnancyChangeError('本次产检已有关联账目，请在家庭账本中修改。', 409);
  }

  return {
    ...data,
    pregnancyRecords: updated,
    expenses: expense ? [expense, ...data.expenses] : data.expenses,
  };
}

export const emptyFamily = (): FamilyData => ({
  version: 1,
  profile: null,
  tasks: [],
  expenses: [],
  theme: 'light',
});

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// UTC calendar arithmetic avoids daylight-saving changes while inputs remain local dates.
export function dayDifference(later: string, earlier: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000,
  );
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

// Keep the existing due-date anchor so older profiles remain compatible.
// This is a calendar estimate using the project's 40-week convention.
export function dueDateFromGestation(
  weeks: number,
  days: number,
  referenceDate: string,
): string | null {
  if (
    !Number.isInteger(weeks) ||
    weeks < 0 ||
    weeks > 42 ||
    !Number.isInteger(days) ||
    days < 0 ||
    days > 6 ||
    !isDate(referenceDate)
  ) {
    return null;
  }

  return addDays(referenceDate, 280 - (weeks * 7 + days));
}

// Display estimate only: the date anchor may come from gestational age or an older profile.
export function pregnancyProgress(dueDate: string, today: string) {
  if (!isDate(dueDate) || !isDate(today)) {
    return null;
  }

  const remaining = dayDifference(dueDate, today);
  const elapsed = 280 - remaining;

  if (elapsed < 0) {
    return null;
  }

  return {
    weeks: Math.floor(elapsed / 7),
    days: elapsed % 7,
    remaining,
    percent: Math.min(100, (elapsed / 280) * 100),
  };
}

export const weekDays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
] as const;

export function taskIsDue(
  task: Pick<FamilyTask, 'repeat' | 'date' | 'weekdays'>,
  date: string,
): boolean {
  if (!isDate(date) || !isDate(task.date) || date < task.date) {
    return false;
  }

  if (task.repeat === 'weekly') {
    // Use the supplied calendar date, independent of device timezone / DST.
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay() || 7;

    return task.weekdays?.includes(weekday) ?? false;
  }

  return task.repeat === 'daily' || task.date === date;
}

export function taskScheduleLabel(task: Pick<FamilyTask, 'repeat' | 'date' | 'weekdays'>): string {
  if (task.repeat === 'weekly') {
    return (
      '每周 ' +
      weekDays
        .filter((day) => task.weekdays?.includes(day.value))
        .map((day) => day.label)
        .join('、') +
      ' · 始于 ' +
      task.date
    );
  }

  return task.repeat === 'daily' ? '每日 · 始于 ' + task.date : task.date;
}

export function parseMoney(value: string): number | null {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const [whole, fraction = ''] = value.trim().split('.');

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function currency(cents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function summarizeExpenses(expenses: readonly Expense[]) {
  const totals = expenses.reduce(
    (sum, item) => {
      if (item.kind === 'allowance') {
        sum.allowance += item.amountCents;
      } else {
        sum.total += item.amountCents;
        sum.reimbursed += item.reimbursedCents;
      }

      return sum;
    },
    { total: 0, reimbursed: 0, allowance: 0 },
  );

  return {
    ...totals,
    net: totals.total - totals.reimbursed - totals.allowance,
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const shortText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const cents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 9999999999;

export function validProfile(value: unknown): value is FamilyProfile {
  return (
    isObject(value) &&
    shortText(value.name, 30) &&
    shortText(value.nickname, 20) &&
    isDate(value.dueDate) &&
    typeof value.quietMode === 'boolean' &&
    (value.familyMode === undefined ||
      value.familyMode === 'single' ||
      value.familyMode === 'couple') &&
    (value.parentRole === undefined ||
      value.parentRole === 'single_parent' ||
      value.parentRole === 'mother' ||
      value.parentRole === 'father') &&
    (value.familyMode === undefined ||
      (value.familyMode === 'single'
        ? value.parentRole === 'single_parent'
        : value.parentRole === 'mother' || value.parentRole === 'father'))
  );
}

export function validTask(value: unknown): value is FamilyTask {
  return (
    isObject(value) &&
    shortText(value.id, 100) &&
    shortText(value.title, 80) &&
    isDate(value.date) &&
    typeof value.time === 'string' &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time) &&
    (value.repeat === 'once' || value.repeat === 'daily' || value.repeat === 'weekly') &&
    (value.repeat === 'weekly'
      ? Array.isArray(value.weekdays) &&
        value.weekdays.length > 0 &&
        value.weekdays.length <= 7 &&
        value.weekdays.every(
          (day: unknown) =>
            typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7,
        ) &&
        new Set(value.weekdays).size === value.weekdays.length
      : value.weekdays === undefined) &&
    Array.isArray(value.completedDates) &&
    value.completedDates.every(isDate)
  );
}

export function validExpense(value: unknown): value is Expense {
  return (
    isObject(value) &&
    shortText(value.id, 100) &&
    shortText(value.title, 80) &&
    isDate(value.date) &&
    (value.kind === 'expense' || value.kind === 'allowance') &&
    expenseCategories.includes(value.category as ExpenseCategory) &&
    cents(value.amountCents) &&
    value.amountCents > 0 &&
    cents(value.reimbursedCents) &&
    value.reimbursedCents <= value.amountCents &&
    (value.kind !== 'allowance' || value.reimbursedCents === 0)
  );
}

export function decodeFamily(raw: string): FamilyData {
  const value: unknown = JSON.parse(raw);

  if (
    !isObject(value) ||
    value.version !== 1 ||
    !(value.profile === null || validProfile(value.profile)) ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(validTask) ||
    !Array.isArray(value.expenses) ||
    !value.expenses.every(validExpense) ||
    (value.pregnancyRecords !== undefined &&
      (!Array.isArray(value.pregnancyRecords) ||
        !value.pregnancyRecords.every(validPregnancyRecord) ||
        new Set(value.pregnancyRecords.map((item) => item.id)).size !==
          value.pregnancyRecords.length ||
        value.pregnancyRecords.filter(
          (item) => item.type === 'contraction' && item.endedAt === null,
        ).length > 1)) ||
    !['light', 'dark'].includes(String(value.theme)) ||
    new Set(value.tasks.map((task) => task.id)).size !== value.tasks.length ||
    new Set(value.expenses.map((expense) => expense.id)).size !== value.expenses.length
  ) {
    throw new Error('存档格式无法识别，原始数据已保留。');
  }

  return value as unknown as FamilyData;
}
