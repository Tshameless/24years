import { describe, expect, it } from 'vitest';
import { selectVitals, vitalPlot, type Vital } from './vitalTrends';

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
});
