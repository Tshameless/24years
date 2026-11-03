import { describe, expect, it } from 'vitest';
import { buildMovementsCsv, summarizeMovementsByDay } from './movementSummary';
import type { PregnancyRecord } from './family';

describe('movementSummary domain', () => {
  const sampleRecords: PregnancyRecord[] = [
    {
      id: 'm-2',
      type: 'movement',
      date: '2026-10-20',
      time: '20:30',
      minutes: 45,
      count: 6,
      notes: '晚间观察',
    },
    {
      id: 'm-1',
      type: 'movement',
      date: '2026-10-20',
      time: '09:00',
      minutes: 30,
      count: 4,
      notes: '=SUM(1,2)',
    },
    {
      id: 'm-3',
      type: 'movement',
      date: '2026-10-21',
      time: '10:00',
      minutes: 60,
      count: 10,
      notes: '',
    },
    {
      id: 'c-1',
      type: 'checkup',
      date: '2026-10-21',
      title: '产检',
      notes: '',
      completed: false,
    },
  ];

  it('aggregates movement sessions by date without 12-hour extrapolation', () => {
    const summary = summarizeMovementsByDay(sampleRecords);
    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({
      date: '2026-10-21',
      sessionCount: 1,
      totalMinutes: 60,
      totalCount: 10,
    });
    expect(summary[1]).toMatchObject({
      date: '2026-10-20',
      sessionCount: 2,
      totalMinutes: 75,
      totalCount: 10,
    });
    expect(summary[1]?.sessions.map((item) => item.time)).toEqual(['09:00', '20:30']);
  });

  it('exports UTF-8 BOM CSV with formula-injection protection', () => {
    const csv = buildMovementsCsv(sampleRecords);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain("'=SUM(1,2)");
    expect(csv.split('\n')).toHaveLength(4);
  });
});
