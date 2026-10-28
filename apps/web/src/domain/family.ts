import { isObject } from './primitives.ts';
import { validProfile } from './profile.ts';
import { validTask } from './tasks.ts';
import { validExpense } from './ledger.ts';
import { validChild } from './child.ts';
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
  isPostpartumCareRecord,
  postpartumWindowEnd,
  withinPostpartumWindow,
  validPregnancyLifecycle,
  validPregnancyRecord,
  type FamilyData,
  type PregnancyChange,
  type PregnancyOutcome,
  type PregnancyRecord,
} from './pregnancy.ts';
export {
  childIdForOutcome,
  formatChildAge,
  validChild,
  type Child,
  type ChildAge,
  type ChildBloodType,
  type ChildGender,
} from './child.ts';
export {
  ageInMonthsAt,
  correctedAgeInMonthsAt,
  formatGrowthAge,
  validGrowthRecord,
  type ChildGrowthRecord,
  type GrowthMetric,
} from './growth.ts';

export const emptyFamily = (): FamilyData => ({
  version: 2,
  profile: null,
  tasks: [],
  expenses: [],
  pregnancyRecords: [],
  children: [],
  theme: 'light',
});

export function decodeFamily(raw: string): FamilyData {
  const value: unknown = JSON.parse(raw);

  if (!validFamilyData(value)) {
    throw new Error('存档格式无法识别，原始数据已保留。');
  }

  return value;
}

export type FamilyMetadata = Pick<FamilyData, 'version' | 'profile' | 'theme'>;

export function decodeFamilyMetadata(raw: string): FamilyMetadata {
  const value: unknown = JSON.parse(raw);

  if (
    !isObject(value) ||
    value.version !== 2 ||
    !(value.profile === null || validProfile(value.profile)) ||
    !Object.keys(value).every((key) => ['version', 'profile', 'theme'].includes(key)) ||
    !['version', 'profile', 'theme'].every((key) => key in value) ||
    !['light', 'dark'].includes(String(value.theme))
  ) {
    throw new Error('家庭元数据格式无效。');
  }

  return { version: 2, profile: value.profile, theme: value.theme as 'light' | 'dark' };
}

function validFamilyData(value: unknown): value is FamilyData {
  return (
    isObject(value) &&
    value.version === 2 &&
    Object.keys(value).every((key) =>
      ['version', 'profile', 'tasks', 'expenses', 'pregnancyRecords', 'children', 'theme'].includes(
        key,
      ),
    ) &&
    ['version', 'profile', 'tasks', 'expenses', 'pregnancyRecords', 'children', 'theme'].every(
      (key) => key in value,
    ) &&
    (value.profile === null || validProfile(value.profile)) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(validTask) &&
    new Set(value.tasks.map((task) => task.id)).size === value.tasks.length &&
    Array.isArray(value.expenses) &&
    value.expenses.every(validExpense) &&
    new Set(value.expenses.map((expense) => expense.id)).size === value.expenses.length &&
    Array.isArray(value.pregnancyRecords) &&
    value.pregnancyRecords.every(validPregnancyRecord) &&
    new Set(value.pregnancyRecords.map((item) => item.id)).size === value.pregnancyRecords.length &&
    validPregnancyLifecycle(value.pregnancyRecords) &&
    !(value.profile === null && pregnancyOutcome(value.pregnancyRecords) !== null) &&
    value.pregnancyRecords.filter((item) => item.type === 'contraction' && item.endedAt === null)
      .length <= 1 &&
    Array.isArray(value.children) &&
    value.children.every(validChild) &&
    new Set(value.children.map((item) => item.id)).size === value.children.length &&
    ['light', 'dark'].includes(String(value.theme))
  );
}
