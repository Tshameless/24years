import { describe, expect, it } from 'vitest';
import { analyzeContractions, type Contraction } from './contractions';

describe('contractions domain', () => {
  it('returns empty guidance when no records are present', () => {
    const analysis = analyzeContractions([]);
    expect(analysis.status).toBe('empty');
    expect(analysis.matches511).toBe(false);
    expect(analysis.completedCount).toBe(0);
  });

  it('indicates insufficient data when less than 3 contractions recorded', () => {
    const now = Date.now();
    const records: Contraction[] = [
      { id: '1', type: 'contraction', startedAt: now - 120000, endedAt: now - 60000 },
      { id: '2', type: 'contraction', startedAt: now - 400000, endedAt: now - 350000 },
    ];
    const analysis = analyzeContractions(records, now);
    expect(analysis.status).toBe('insufficient');
    expect(analysis.matches511).toBe(false);
    expect(analysis.completedCount).toBe(2);
  });

  it('detects irregular contractions when intervals are sporadic', () => {
    const now = Date.now();
    const records: Contraction[] = [
      { id: '1', type: 'contraction', startedAt: now - 60000, endedAt: now - 40000 }, // 20s
      { id: '2', type: 'contraction', startedAt: now - 15 * 60000, endedAt: now - 14.5 * 60000 }, // 30s
      { id: '3', type: 'contraction', startedAt: now - 40 * 60000, endedAt: now - 39.5 * 60000 }, // 30s
    ];
    const analysis = analyzeContractions(records, now);
    expect(analysis.status).toBe('irregular');
    expect(analysis.matches511).toBe(false);
  });

  it('identifies 5-1-1 active labor pattern when interval <= 5m, duration >= 50s sustained over an hour', () => {
    const base = Date.now();
    // 10 contractions spaced ~4.5 minutes apart, each lasting 55-65 seconds, spanning 45 minutes
    const records: Contraction[] = [];
    for (let i = 0; i < 9; i++) {
      const start = base - i * 4.5 * 60 * 1000;
      records.push({
        id: `c-${i}`,
        type: 'contraction',
        startedAt: start,
        endedAt: start + 55 * 1000, // 55s duration
      });
    }

    const analysis = analyzeContractions(records, base);
    expect(analysis.matches511).toBe(true);
    expect(analysis.status).toBe('active_labor_511');
    expect(analysis.badge).toBe('5-1-1 规律临产');
    expect(analysis.avgIntervalMinutes).toBeLessThanOrEqual(5.0);
    expect(analysis.avgDurationSeconds).toBeGreaterThanOrEqual(50);
  });
});
