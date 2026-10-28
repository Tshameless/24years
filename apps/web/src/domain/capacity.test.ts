import { describe, expect, it } from 'vitest';
import { MAX_FAMILY_COLLECTION_RECORDS, withinFamilyCollectionLimits } from './capacity';

describe('家庭云端记录配额', () => {
  it('允许 9,000 条备份记录，并在 10,000 条边界拒绝继续增长', () => {
    expect(MAX_FAMILY_COLLECTION_RECORDS).toBe(10000);
    expect(
      withinFamilyCollectionLimits({
        tasks: [],
        expenses: Array.from({ length: 9000 }),
        pregnancyRecords: [],
        children: [],
      }),
    ).toBe(true);
    expect(
      withinFamilyCollectionLimits({
        tasks: Array.from({ length: 10001 }),
        expenses: [],
        pregnancyRecords: [],
        children: [],
      }),
    ).toBe(false);
  });

  it('按单家庭汇总限制所有孩子的生长记录', () => {
    expect(
      withinFamilyCollectionLimits({
        tasks: [],
        expenses: [],
        pregnancyRecords: [],
        children: [
          { growthRecords: Array.from({ length: 6000 }) },
          { growthRecords: Array.from({ length: 4000 }) },
        ],
      }),
    ).toBe(true);
    expect(
      withinFamilyCollectionLimits({
        tasks: [],
        expenses: [],
        pregnancyRecords: [],
        children: [
          { growthRecords: Array.from({ length: 6000 }) },
          { growthRecords: Array.from({ length: 4001 }) },
        ],
      }),
    ).toBe(false);
  });
});
