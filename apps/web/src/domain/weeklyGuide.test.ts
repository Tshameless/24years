import { describe, expect, it } from 'vitest';
import { clampGuideWeek, getWeeklyGuide, weeklyGuideStages } from './weeklyGuide';

describe('weeklyGuide domain', () => {
  it('covers every gestational week from 0 to 42 without gaps', () => {
    expect(clampGuideWeek(-3)).toBe(4);
    expect(clampGuideWeek(24.8)).toBe(24);
    expect(clampGuideWeek(45)).toBe(42);
    expect(clampGuideWeek(Number.NaN)).toBe(12);

    for (let week = 0; week <= 42; week += 1) {
      const stage = getWeeklyGuide(week);
      expect(week).toBeGreaterThanOrEqual(stage.minWeek);
      expect(week).toBeLessThanOrEqual(stage.maxWeek);
      expect(stage.coupleActions.length).toBeGreaterThan(0);
      expect(stage.singleActions.length).toBeGreaterThan(0);
    }
  });

  it('uses modern evidence-based medical guidance without folk or TCM prescriptions', () => {
    const serialized = JSON.stringify(weeklyGuideStages);
    expect(serialized).not.toMatch(/保胎药|生化汤|宫寒|上火|捂月子|艾灸/);
    expect(getWeeklyGuide(12).recommendedTab).toBe('ultrasound');
    expect(getWeeklyGuide(25).recommendedTab).toBe('movements');
    expect(getWeeklyGuide(38).recommendedTab).toBe('contractions');
  });
});
