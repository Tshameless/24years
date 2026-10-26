import { describe, expect, it } from 'vitest';
import { assessVital, selectVitals, vitalPlot, type Vital } from './vitalTrends';

describe('vitalTrends domain', () => {
  it('correctly filters and sorts vitals by date', () => {
    const vitals: Vital[] = [
      {
        id: 'v2',
        type: 'vital',
        date: '2026-10-25',
        metric: 'weight',
        value: 63,
        secondary: null,
        notes: '',
      },
      {
        id: 'v1',
        type: 'vital',
        date: '2026-10-20',
        metric: 'weight',
        value: 62,
        secondary: null,
        notes: '',
      },
      {
        id: 'v3',
        type: 'vital',
        date: '2026-10-22',
        metric: 'glucose',
        value: 4.8,
        secondary: null,
        notes: '',
      },
    ];

    const selected = selectVitals(vitals, 'weight', '2026-10-19', '2026-10-26');
    expect(selected).toHaveLength(2);
    expect(selected[0]!.id).toBe('v1');
    expect(selected[1]!.id).toBe('v2');
  });

  it('generates plot coordinates for chart rendering', () => {
    const vitals: Vital[] = [
      {
        id: 'v1',
        type: 'vital',
        date: '2026-10-20',
        metric: 'bloodPressure',
        value: 120,
        secondary: 80,
        notes: '',
      },
      {
        id: 'v2',
        type: 'vital',
        date: '2026-10-25',
        metric: 'bloodPressure',
        value: 135,
        secondary: 88,
        notes: '',
      },
    ];
    const plot = vitalPlot(vitals);
    expect(plot).not.toBeNull();
    expect(plot!.points).toHaveLength(2);
    expect(plot!.points[0]!.y2).not.toBeNull();
  });

  it('evaluates blood pressure with clinical EBM thresholds', () => {
    // Normal (< 130/85)
    expect(assessVital('bloodPressure', 118, 75).level).toBe('normal');

    // Attention (130-139 or 85-89)
    expect(assessVital('bloodPressure', 134, 82).level).toBe('attention');
    expect(assessVital('bloodPressure', 122, 86).level).toBe('attention');

    // Warning (>= 140 or >= 90)
    const warningSystolic = assessVital('bloodPressure', 142, 85);
    expect(warningSystolic.level).toBe('warning');
    expect(warningSystolic.badge).toBe('高压警戒');

    const warningDiastolic = assessVital('bloodPressure', 125, 92);
    expect(warningDiastolic.level).toBe('warning');
  });

  it('evaluates glucose with fasting and postprandial criteria', () => {
    expect(assessVital('glucose', 4.8, null, '晨起空腹').level).toBe('normal');
    expect(assessVital('glucose', 5.3, null, '晨起空腹').level).toBe('warning');
    expect(assessVital('glucose', 7.5, null, '午餐后2小时').level).toBe('normal');
    expect(assessVital('glucose', 9.1, null, '午餐后2小时').level).toBe('warning');
  });
});
