import { dayDifference, isDate, isObject, shortText } from './primitives.ts';
import { validGrowthRecord, type ChildGrowthRecord } from './growth.ts';

export type ChildGender = 'boy' | 'girl' | 'other' | 'unknown';
export type ChildBloodType = 'A' | 'B' | 'AB' | 'O' | 'unknown';

export interface Child {
  id: string;
  name: string;
  birthDate: string;
  gender?: ChildGender;
  bloodType?: ChildBloodType;
  birthWeightGrams?: number;
  birthLengthCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
  growthRecords?: readonly ChildGrowthRecord[];
}

export function validChild(value: unknown): value is Child {
  if (!isObject(value)) {
    return false;
  }

  const {
    id,
    name,
    birthDate,
    gender,
    bloodType,
    birthWeightGrams,
    birthLengthCm,
    headCircumferenceCm,
    notes,
    growthRecords,
  } = value as Record<string, unknown>;

  if (!shortText(id, 64) || !shortText(name, 50) || !name.trim() || !isDate(birthDate)) {
    return false;
  }

  if (
    gender !== undefined &&
    gender !== 'boy' &&
    gender !== 'girl' &&
    gender !== 'other' &&
    gender !== 'unknown'
  ) {
    return false;
  }

  if (
    bloodType !== undefined &&
    bloodType !== 'A' &&
    bloodType !== 'B' &&
    bloodType !== 'AB' &&
    bloodType !== 'O' &&
    bloodType !== 'unknown'
  ) {
    return false;
  }

  if (
    birthWeightGrams !== undefined &&
    (typeof birthWeightGrams !== 'number' ||
      !Number.isFinite(birthWeightGrams) ||
      birthWeightGrams <= 0 ||
      birthWeightGrams > 10000)
  ) {
    return false;
  }

  if (
    birthLengthCm !== undefined &&
    (typeof birthLengthCm !== 'number' ||
      !Number.isFinite(birthLengthCm) ||
      birthLengthCm <= 0 ||
      birthLengthCm > 150)
  ) {
    return false;
  }

  if (
    headCircumferenceCm !== undefined &&
    (typeof headCircumferenceCm !== 'number' ||
      !Number.isFinite(headCircumferenceCm) ||
      headCircumferenceCm <= 0 ||
      headCircumferenceCm > 100)
  ) {
    return false;
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
    return false;
  }

  if (
    growthRecords !== undefined &&
    (!Array.isArray(growthRecords) ||
      !growthRecords.every(validGrowthRecord) ||
      new Set(growthRecords.map((r) => r.id)).size !== growthRecords.length)
  ) {
    return false;
  }

  return true;
}

export interface ChildAge {
  totalDays: number;
  months: number;
  days: number;
  label: string;
}

/**
 * Calculates child age in total days, months, and descriptive localized label.
 */
export function formatChildAge(birthDate: string, today: string): ChildAge {
  const totalDays = dayDifference(today, birthDate);

  if (totalDays < 0) {
    return { totalDays: 0, months: 0, days: 0, label: '出生前 / 未到期' };
  }

  if (totalDays === 0) {
    return { totalDays: 0, months: 0, days: 0, label: '新生儿出生当天' };
  }

  const [bYear, bMonth, bDay] = birthDate.split('-').map(Number);
  const [tYear, tMonth, tDay] = today.split('-').map(Number);

  let years = tYear - bYear;
  let months = tMonth - bMonth;
  let days = tDay - bDay;

  if (days < 0) {
    months -= 1;
    // Days in previous month of 'today'
    const prevMonthDays = new Date(Date.UTC(tYear, tMonth - 1, 0)).getUTCDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  if (totalMonths === 0) {
    return { totalDays, months: 0, days: totalDays, label: `${totalDays} 天` };
  }

  if (years === 0) {
    return {
      totalDays,
      months: totalMonths,
      days,
      label: days > 0 ? `${totalMonths} 个月 ${days} 天` : `${totalMonths} 个月`,
    };
  }

  return {
    totalDays,
    months: totalMonths,
    days,
    label: months > 0 ? `${years} 岁 ${months} 个月` : `${years} 岁`,
  };
}
