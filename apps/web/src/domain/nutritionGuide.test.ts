import { describe, expect, it } from 'vitest';
import { filterFoodSafetyItems, foodSafetyItems, supplementClockTemplates } from './nutritionGuide';

describe('nutritionGuide domain', () => {
  it('filters food items by keyword, alias, category, and safety level', () => {
    expect(filterFoodSafetyItems('')).toHaveLength(foodSafetyItems.length);

    const crabMatches = filterFoodSafetyItems('大闸蟹');
    expect(crabMatches.length).toBeGreaterThan(0);
    expect(crabMatches[0]?.level).toBe('safe');

    const avoidItems = filterFoodSafetyItems('', 'all', 'avoid');
    expect(avoidItems.length).toBeGreaterThanOrEqual(4);
    expect(avoidItems.every((item) => item.level === 'avoid')).toBe(true);

    const dairySafe = filterFoodSafetyItems('', '乳品奶酪', 'safe');
    expect(dairySafe.length).toBeGreaterThan(0);
    expect(dairySafe.every((item) => item.category === '乳品奶酪')).toBe(true);
  });

  it('provides staggered supplement templates for iron and calcium separation', () => {
    expect(supplementClockTemplates).toHaveLength(3);
    expect(supplementClockTemplates.map((item) => item.timeLabel.slice(0, 5))).toEqual([
      '08:30',
      '13:30',
      '21:00',
    ]);
  });
});
