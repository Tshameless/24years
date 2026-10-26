import { isDate, isObject, shortText } from './primitives.ts';

export interface ChildGrowthRecord {
  id: string;
  date: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

export function validGrowthRecord(value: unknown): value is ChildGrowthRecord {
  if (!isObject(value)) {
    return false;
  }

  const { id, date, weightKg, heightCm, headCircumferenceCm, notes } = value as Record<
    string,
    unknown
  >;

  if (!shortText(id, 64) || !isDate(date)) {
    return false;
  }

  const hasWeight =
    weightKg !== undefined &&
    typeof weightKg === 'number' &&
    Number.isFinite(weightKg) &&
    weightKg >= 0.5 &&
    weightKg <= 40;

  const hasHeight =
    heightCm !== undefined &&
    typeof heightCm === 'number' &&
    Number.isFinite(heightCm) &&
    heightCm >= 20 &&
    heightCm <= 140;

  const hasHead =
    headCircumferenceCm !== undefined &&
    typeof headCircumferenceCm === 'number' &&
    Number.isFinite(headCircumferenceCm) &&
    headCircumferenceCm >= 20 &&
    headCircumferenceCm <= 60;

  if (weightKg !== undefined && !hasWeight) {
    return false;
  }

  if (heightCm !== undefined && !hasHeight) {
    return false;
  }

  if (headCircumferenceCm !== undefined && !hasHead) {
    return false;
  }

  if (!hasWeight && !hasHeight && !hasHead) {
    return false;
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
    return false;
  }

  return true;
}

export type GrowthMetric = 'weightKg' | 'heightCm' | 'headCircumferenceCm';

export function ageInMonthsAt(birthDate: string, date: string): number {
  const [bYear, bMonth, bDay] = birthDate.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  let months = (year - bYear) * 12 + month - bMonth;

  if (day < bDay) {
    months -= 1;
  }

  return Math.max(0, months);
}
