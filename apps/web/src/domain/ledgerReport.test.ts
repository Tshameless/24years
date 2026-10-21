import { describe, expect, it, vi } from 'vitest';
import { summarizeExpenses, type Expense } from './family';
import { downloadLedgerCsv, filterLedger, ledgerCsv } from './ledgerReport';

const records: Expense[] = [
  {
    id: 'old',
    date: '2025-12-31',
    title: '去年费用',
    kind: 'expense',
    category: '产检医疗',
    amountCents: 20000,
    reimbursedCents: 0,
  },
  {
    id: 'medical',
    date: '2026-01-01',
    title: '产检',
    kind: 'expense',
    category: '产检医疗',
    amountCents: 10010,
    reimbursedCents: 2005,
  },
  {
    id: 'goods',
    date: '2026-01-02',
    title: '宝宝用品',
    kind: 'expense',
    category: '宝宝用品',
    amountCents: 3050,
    reimbursedCents: 0,
  },
  {
    id: 'allowance',
    date: '2026-01-03',
    title: '津贴',
    kind: 'allowance',
    category: '产检医疗',
    amountCents: 20000,
    reimbursedCents: 0,
  },
];

describe('账本筛选与导出', () => {
  it('按月份与分类交集过滤，津贴不混入原分类，不改变源记录', () => {
    const original = JSON.stringify(records);
    expect(filterLedger(records, '', '全部').map((row) => row.id)).toEqual([
      'allowance',
      'goods',
      'medical',
      'old',
    ]);
    expect(filterLedger(records, '2026-01', '产检医疗').map((row) => row.id)).toEqual(['medical']);
    expect(filterLedger(records, '2026-01', '津贴').map((row) => row.id)).toEqual(['allowance']);
    expect(filterLedger(records, '2025-12', '全部')).toHaveLength(1);
    expect(filterLedger(records, '2026-02', '全部')).toEqual([]);
    expect(JSON.stringify(records)).toBe(original);
  });

  it('筛选汇总保持整数分计算，津贴允许产生负净支出', () => {
    expect(summarizeExpenses(filterLedger(records, '2026-01', '全部'))).toEqual({
      total: 13060,
      reimbursed: 2005,
      allowance: 20000,
      net: -8945,
    });
    expect(summarizeExpenses(filterLedger(records, '2026-02', '全部'))).toEqual({
      total: 0,
      reimbursed: 0,
      allowance: 0,
      net: 0,
    });
  });

  it('同日按记录编号稳定排序，空导出只有表头', () => {
    const sameDay = records.map((row) => ({ ...row, date: '2026-01-01' }));
    expect(filterLedger(sameDay, '', '全部').map((row) => row.id)).toEqual([
      'allowance',
      'goods',
      'medical',
      'old',
    ]);
    expect(ledgerCsv([]).split('\r\n')).toHaveLength(2);
  });

  it('CSV 包含 BOM、中文表头和精确金额，津贴不重复计入支出', () => {
    const csv = ledgerCsv(filterLedger(records, '2026-01', '全部'));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"账目名称"');
    expect(csv).toContain('100.10,20.05,0.00,80.05');
    expect(csv).toContain('0.00,0.00,200.00,-200.00');
    expect(csv).not.toContain('去年费用');
    expect(csv.split('\r\n')).toHaveLength(5);
  });

  it('转义逗号、引号与换行，中文标题不变', () => {
    const csv = ledgerCsv([{ ...records[0]!, title: '产检,"复查"\n票据' }]);
    expect(csv).toContain('"产检,""复查""\n票据"');
  });

  it.each([
    '=1+1',
    '+SUM(A1)',
    '-1+1',
    '@SUM(A1)',
    '  =1+1',
    '\t=1+1',
    '\r=1+1',
    '\n=1+1',
    '\u200b=1+1',
  ])('文本 %j 不作为公式导出', (title) => {
    const csv = ledgerCsv([{ ...records[0]!, id: '=id', title }]);
    expect(csv).toContain('"\'=id"');
    expect(csv).toContain('"\'' + title + '"');
  });

  it('下载失败也会清理链接和对象 URL', () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked');
    });

    try {
      expect(() => downloadLedgerCsv(records, 'test.csv')).toThrow('blocked');
      expect(document.querySelector('a[download]')).toBeNull();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith('blob:test');
    } finally {
      vi.useRealTimers();
    }
  });
});
