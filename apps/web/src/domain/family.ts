export interface FamilyProfile {
  name: string;
  nickname: string;
  dueDate: string;
  quietMode: boolean;
}

export interface FamilyTask {
  id: string;
  title: string;
  date: string;
  time: string;
  repeat: 'once' | 'daily';
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

// Display estimate only: use the clinician-confirmed EDD, with 40 weeks as the anchor.
// Calendar convention follows the repository's 40-week pregnancy specification.
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

export function taskIsDue(task: Pick<FamilyTask, 'repeat' | 'date'>, date: string): boolean {
  return task.repeat === 'daily' ? task.date <= date : task.date === date;
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
    typeof value.quietMode === 'boolean'
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
    (value.repeat === 'once' || value.repeat === 'daily') &&
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
    !['light', 'dark'].includes(String(value.theme)) ||
    new Set(value.tasks.map((task) => task.id)).size !== value.tasks.length ||
    new Set(value.expenses.map((expense) => expense.id)).size !== value.expenses.length
  ) {
    throw new Error('存档格式无法识别，原始数据已保留。');
  }

  return value as unknown as FamilyData;
}
