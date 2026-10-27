import { describe, expect, it } from 'vitest';
import {
  ageInMonthsAt,
  correctedAgeInMonthsAt,
  formatGrowthAge,
  validGrowthRecord,
  type ChildGrowthRecord,
} from './growth.ts';

describe('validGrowthRecord', () => {
  const baseRecord: ChildGrowthRecord = {
    id: 'growth-1',
    date: '2026-10-26',
    weightKg: 4.8,
    heightCm: 56.5,
    headCircumferenceCm: 38.2,
    notes: '精神食欲良好',
  };

  it('validates a complete valid growth record', () => {
    expect(validGrowthRecord(baseRecord)).toBe(true);
  });

  it('accepts record with only weight', () => {
    expect(
      validGrowthRecord({
        id: 'growth-w',
        date: '2026-10-26',
        weightKg: 5.2,
      }),
    ).toBe(true);
  });

  it('rejects record with no measurements', () => {
    expect(
      validGrowthRecord({
        id: 'growth-empty',
        date: '2026-10-26',
      }),
    ).toBe(false);
  });

  it('rejects invalid or extreme values', () => {
    expect(validGrowthRecord({ ...baseRecord, weightKg: 0.1 })).toBe(false);
    expect(validGrowthRecord({ ...baseRecord, weightKg: 100 })).toBe(false);
    expect(validGrowthRecord({ ...baseRecord, heightCm: 10 })).toBe(false);
    expect(validGrowthRecord({ ...baseRecord, heightCm: 250 })).toBe(false);
    expect(validGrowthRecord({ ...baseRecord, headCircumferenceCm: 10 })).toBe(false);
    expect(validGrowthRecord({ ...baseRecord, headCircumferenceCm: 90 })).toBe(false);
  });

  it('rejects invalid date or id', () => {
    expect(validGrowthRecord({ ...baseRecord, date: 'bad-date' })).toBe(false);
    expect(validGrowthRecord({ ...baseRecord, id: '' })).toBe(false);
  });
});

describe('ageInMonthsAt', () => {
  it('uses completed calendar months', () => {
    expect(ageInMonthsAt('2026-01-15', '2026-04-14')).toBe(2);
    expect(ageInMonthsAt('2026-01-15', '2026-04-15')).toBe(3);
    expect(ageInMonthsAt('2026-01-15', '2026-01-14')).toBe(0);
  });
});

describe('correctedAgeInMonthsAt', () => {
  it('subtracts the weeks before 40 weeks only for preterm birth', () => {
    expect(correctedAgeInMonthsAt('2026-01-01', '2026-02-26', 32)).toBe(0);
    expect(correctedAgeInMonthsAt('2026-01-01', '2026-03-26', 32)).toBe(1);
    expect(correctedAgeInMonthsAt('2026-01-01', '2026-03-01', 37)).toBeNull();
  });

  it('formats record age with corrected months within 24 months for preterm children', () => {
    expect(formatGrowthAge('2026-01-01', '2026-04-01', 32)).toBe('3 个月（矫正 1 个月）');
    expect(formatGrowthAge('2026-01-01', '2028-02-01', 32)).toBe('25 个月');
    expect(formatGrowthAge('2026-01-01', '2026-04-01', 39)).toBe('3 个月');
  });
});
