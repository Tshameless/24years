import { describe, expect, it } from 'vitest';
import {
  assessChildGrowth,
  getRecommendedMilestones,
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

describe('assessChildGrowth', () => {
  it('correctly assesses typical median weight for 6-month boy', () => {
    const assessment = assessChildGrowth('weightKg', 7.9, 6, 'boy');
    expect(assessment.status).toBe('normal');
    expect(assessment.percentileBand).toBe('P15 - P85');
    expect(assessment.p50).toBe(7.9);
  });

  it('flags low weight (< P3) for 6-month boy', () => {
    const assessment = assessChildGrowth('weightKg', 5.5, 6, 'boy');
    expect(assessment.status).toBe('low');
    expect(assessment.percentileBand).toBe('< P3');
    expect(assessment.summary).toContain('低于 WHO 标准');
  });

  it('flags high height (> P97) for 12-month girl', () => {
    const assessment = assessChildGrowth('heightCm', 82.0, 12, 'girl');
    expect(assessment.status).toBe('high');
    expect(assessment.percentileBand).toBe('> P97');
    expect(assessment.summary).toContain('高于 WHO 标准');
  });

  it('interpolates smoothly between month intervals', () => {
    const assessment = assessChildGrowth('weightKg', 6.0, 2.5, 'boy');
    expect(assessment.status).toBe('normal');
    expect(assessment.p50).toBeGreaterThan(5.6);
    expect(assessment.p50).toBeLessThan(6.4);
  });
});

describe('getRecommendedMilestones', () => {
  it('calculates expected target dates from birth date', () => {
    const milestones = getRecommendedMilestones('2026-05-01', '2026-10-26');
    expect(milestones).toHaveLength(11);
    expect(milestones[0].targetDate).toBe('2026-05-02');
    expect(milestones[0].isOverdue).toBe(true);

    const year1 = milestones.find((m) => m.id === 'year-1')!;
    expect(year1.targetDate).toBe('2027-05-01');
    expect(year1.isOverdue).toBe(false);
  });
});
