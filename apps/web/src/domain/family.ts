import { isObject } from './primitives.ts';
import { validProfile } from './profile.ts';
import { validTask } from './tasks.ts';
import { validExpense } from './ledger.ts';
import {
  pregnancyOutcome,
  validPregnancyLifecycle,
  validPregnancyRecord,
  type FamilyData,
} from './pregnancy.ts';

export {
  addDays,
  canonicalJson,
  cents,
  dayDifference,
  isDate,
  isObject,
  localDate,
  sameValue,
  shortText,
} from './primitives.ts';
export {
  dueDateFromGestation,
  pregnancyProgress,
  validProfile,
  type FamilyProfile,
} from './profile.ts';
export { taskIsDue, taskScheduleLabel, validTask, weekDays, type FamilyTask } from './tasks.ts';
export {
  currency,
  expenseCategories,
  parseMoney,
  summarizeExpenses,
  validExpense,
  type Expense,
  type ExpenseCategory,
} from './ledger.ts';
export {
  applyPregnancyChange,
  PregnancyChangeError,
  pregnancyOutcome,
  validPregnancyLifecycle,
  validPregnancyRecord,
  type FamilyData,
  type PregnancyChange,
  type PregnancyOutcome,
  type PregnancyRecord,
} from './pregnancy.ts';

export const emptyFamily = (): FamilyData => ({
  version: 1,
  profile: null,
  tasks: [],
  expenses: [],
  theme: 'light',
});

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
        !validPregnancyLifecycle(value.pregnancyRecords) ||
        (value.profile === null && pregnancyOutcome(value.pregnancyRecords) !== null) ||
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
