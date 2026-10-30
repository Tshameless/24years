import { isDate, isObject, shortText } from './primitives.ts';

export interface FamilyTask {
  id: string;
  title: string;
  date: string;
  time: string;
  repeat: 'once' | 'daily' | 'weekly';
  /** ISO weekdays: Monday = 1, Sunday = 7. Required for weekly tasks. */
  weekdays?: readonly number[];
  /** Responsibility is descriptive, not an access-control boundary. */
  assignee?: 'mother' | 'father' | 'single_parent';
  endDate?: string;
  completedDates: string[];
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
  task: Pick<FamilyTask, 'repeat' | 'date' | 'weekdays' | 'endDate'>,
  date: string,
): boolean {
  if (
    !isDate(date) ||
    !isDate(task.date) ||
    date < task.date ||
    (task.endDate && date > task.endDate)
  ) {
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

export function validTask(value: unknown): value is FamilyTask {
  return (
    isObject(value) &&
    shortText(value.id, 100) &&
    shortText(value.title, 80) &&
    isDate(value.date) &&
    (value.endDate === undefined || (isDate(value.endDate) && value.endDate >= value.date)) &&
    (value.assignee === undefined ||
      value.assignee === 'mother' ||
      value.assignee === 'father' ||
      value.assignee === 'single_parent') &&
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
