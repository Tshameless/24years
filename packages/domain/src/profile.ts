import { addDays, dayDifference, isDate, isObject, shortText } from './primitives.ts';

export interface FamilyProfile {
  name: string;
  nickname: string;
  dueDate: string;
  quietMode: boolean;
  /** Optional clinical anchors retained alongside the display due date. */
  lmpDate?: string;
  prePregnancyWeightKg?: number;
  heightCm?: number;
  familyMode: 'single' | 'couple';
  parentRole: 'single_parent' | 'mother' | 'father';
}

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

// Display estimate only; the persisted clinical anchors remain independent profile fields.
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

export function validProfile(value: unknown): value is FamilyProfile {
  return (
    isObject(value) &&
    Object.keys(value).every((key) =>
      [
        'name',
        'nickname',
        'dueDate',
        'quietMode',
        'lmpDate',
        'prePregnancyWeightKg',
        'heightCm',
        'familyMode',
        'parentRole',
      ].includes(key),
    ) &&
    shortText(value.name, 30) &&
    shortText(value.nickname, 20) &&
    isDate(value.dueDate) &&
    typeof value.quietMode === 'boolean' &&
    (value.familyMode === 'single' || value.familyMode === 'couple') &&
    (value.parentRole === 'single_parent' ||
      value.parentRole === 'mother' ||
      value.parentRole === 'father') &&
    (value.lmpDate === undefined || isDate(value.lmpDate)) &&
    (value.prePregnancyWeightKg === undefined ||
      (typeof value.prePregnancyWeightKg === 'number' &&
        Number.isFinite(value.prePregnancyWeightKg) &&
        value.prePregnancyWeightKg > 0 &&
        value.prePregnancyWeightKg <= 500)) &&
    (value.heightCm === undefined ||
      (typeof value.heightCm === 'number' &&
        Number.isFinite(value.heightCm) &&
        value.heightCm >= 50 &&
        value.heightCm <= 250)) &&
    (value.familyMode === 'single'
      ? value.parentRole === 'single_parent'
      : value.parentRole === 'mother' || value.parentRole === 'father')
  );
}
