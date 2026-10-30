import { describe, expect, it } from 'vitest';
import { growthCsv } from './growthReport';
import type { ChildGrowthRecord } from './growth';

describe('生长记录 CSV', () => {
  it('按日期稳定导出测量数据且不修改原列表', () => {
    const records: ChildGrowthRecord[] = [
      { id: 'later', date: '2026-07-01', weightKg: 6.35, notes: '复查' },
      { id: 'earlier', date: '2026-06-01', heightCm: 58.2, headCircumferenceCm: 39 },
    ];
    const csv = growthCsv(records);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"测量日期"');
    expect(csv.indexOf('2026-06-01')).toBeLessThan(csv.indexOf('2026-07-01'));
    expect(csv).toContain('58.2,39,');
    expect(csv).toContain('6.35,,,"复查"');
    expect(records[0]!.id).toBe('later');
  });

  it('转义备注并阻止表格公式注入', () => {
    expect(
      growthCsv([{ id: 'g', date: '2026-06-01', weightKg: 3.2, notes: '=SUM(A1)' }]),
    ).toContain("'=SUM(A1)");
  });

  it('空列表仍导出带中文表头的 CSV', () => {
    expect(growthCsv([]).split('\r\n')).toHaveLength(2);
  });
});
