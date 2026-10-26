import { describe, expect, it } from 'vitest';
import { formatChildAge, validChild, type Child } from './child.ts';

describe('validChild', () => {
  const baseChild: Child = {
    id: 'child-1',
    name: '小明',
    birthDate: '2026-05-10',
    gender: 'boy',
    bloodType: 'O',
    birthWeightGrams: 3250,
    birthLengthCm: 50.5,
    headCircumferenceCm: 34.2,
    notes: '顺利出生，健康活泼。',
  };

  it('validates a complete, sound child record', () => {
    expect(validChild(baseChild)).toBe(true);
  });

  it('validates a minimal child record with optional fields omitted', () => {
    expect(
      validChild({
        id: 'child-2',
        name: '宝宝',
        birthDate: '2026-10-20',
      }),
    ).toBe(true);
  });

  it('rejects invalid or blank name', () => {
    expect(validChild({ ...baseChild, name: '' })).toBe(false);
    expect(validChild({ ...baseChild, name: '   ' })).toBe(false);
    expect(validChild({ ...baseChild, name: 'a'.repeat(51) })).toBe(false);
  });

  it('rejects invalid birth dates', () => {
    expect(validChild({ ...baseChild, birthDate: 'not-a-date' })).toBe(false);
    expect(validChild({ ...baseChild, birthDate: '2026-02-31' })).toBe(false);
  });

  it('rejects out of bounds measurements', () => {
    expect(validChild({ ...baseChild, birthWeightGrams: 0 })).toBe(false);
    expect(validChild({ ...baseChild, birthWeightGrams: -100 })).toBe(false);
    expect(validChild({ ...baseChild, birthWeightGrams: 15000 })).toBe(false);

    expect(validChild({ ...baseChild, birthLengthCm: 0 })).toBe(false);
    expect(validChild({ ...baseChild, birthLengthCm: 200 })).toBe(false);

    expect(validChild({ ...baseChild, headCircumferenceCm: 0 })).toBe(false);
    expect(validChild({ ...baseChild, headCircumferenceCm: 150 })).toBe(false);
  });

  it('rejects invalid gender or blood type', () => {
    expect(validChild({ ...baseChild, gender: 'invalid' as never })).toBe(false);
    expect(validChild({ ...baseChild, bloodType: 'X' as never })).toBe(false);
  });

  it('rejects excessively long notes', () => {
    expect(validChild({ ...baseChild, notes: 'a'.repeat(501) })).toBe(false);
  });
});

describe('formatChildAge', () => {
  it('formats newborn on the birth date', () => {
    const age = formatChildAge('2026-10-26', '2026-10-26');
    expect(age.totalDays).toBe(0);
    expect(age.label).toBe('新生儿出生当天');
  });

  it('formats age in days for under 1 month', () => {
    const age = formatChildAge('2026-10-10', '2026-10-26');
    expect(age.totalDays).toBe(16);
    expect(age.label).toBe('16 天');
  });

  it('formats age in months and days for under 1 year', () => {
    const age = formatChildAge('2026-08-16', '2026-10-26');
    expect(age.months).toBe(2);
    expect(age.days).toBe(10);
    expect(age.label).toBe('2 个月 10 天');
  });

  it('formats age in years and months for over 1 year', () => {
    const age = formatChildAge('2025-05-10', '2026-10-26');
    expect(age.months).toBe(17);
    expect(age.label).toBe('1 岁 5 个月');
  });

  it('handles future birth date gracefully', () => {
    const age = formatChildAge('2026-11-01', '2026-10-26');
    expect(age.totalDays).toBe(0);
    expect(age.label).toBe('出生前 / 未到期');
  });
});
