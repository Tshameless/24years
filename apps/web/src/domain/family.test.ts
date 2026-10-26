import { describe, expect, it } from 'vitest';
import {
  addDays,
  canonicalJson,
  decodeFamily,
  dueDateFromGestation,
  emptyFamily,
  isDate,
  parseMoney,
  pregnancyProgress,
  sameValue,
  summarizeExpenses,
  taskIsDue,
  validProfile,
  type Expense,
} from './family';

it('旧档案可读取，新档案的家庭类型与身份须匹配', () => {
  const profile = { name: '家', nickname: '家长', dueDate: '2027-01-26', quietMode: false };
  expect(decodeFamily(JSON.stringify({ ...emptyFamily(), profile })).profile).toEqual(profile);
  expect(validProfile({ ...profile, familyMode: 'single', parentRole: 'single_parent' })).toBe(
    true,
  );
  expect(validProfile({ ...profile, familyMode: 'couple', parentRole: 'father' })).toBe(true);
  expect(validProfile({ ...profile, familyMode: 'couple', parentRole: 'mother' })).toBe(true);
  expect(validProfile({ ...profile, familyMode: 'couple' })).toBe(false);
  expect(validProfile({ ...profile, familyMode: 'single', parentRole: 'father' })).toBe(false);
  expect(validProfile({ ...profile, familyMode: 'couple', parentRole: 'single_parent' })).toBe(
    false,
  );
});

describe('日历与每日计划', () => {
  it('从孕周和天数推算日期，支持闰日与超过 40 周的记录', () => {
    expect(dueDateFromGestation(24, 3, '2026-10-09')).toBe('2027-01-26');
    expect(dueDateFromGestation(0, 0, '2026-10-09')).toBe(addDays('2026-10-09', 280));
    expect(dueDateFromGestation(40, 0, '2026-10-09')).toBe('2026-10-09');
    expect(dueDateFromGestation(42, 6, '2026-10-09')).toBe('2026-09-19');
    expect(dueDateFromGestation(39, 6, '2024-02-28')).toBe('2024-02-29');
  });

  it('拒绝负数、小数、超出范围的孕周天数和无效日期', () => {
    for (const weeks of [-1, 24.5, 43, NaN, Infinity]) {
      expect(dueDateFromGestation(weeks, 0, '2026-10-09')).toBeNull();
    }

    for (const days of [-1, 1.5, 7, NaN, Infinity]) {
      expect(dueDateFromGestation(24, days, '2026-10-09')).toBeNull();
    }

    expect(dueDateFromGestation(24, 3, '2026-02-30')).toBeNull();
  });

  it('按日历计算孕周，兼容闰年和预产期当天/之后', () => {
    expect(pregnancyProgress('2027-01-26', '2026-10-09')).toMatchObject({
      weeks: 24,
      days: 3,
      remaining: 109,
    });
    expect(pregnancyProgress('2026-10-09', '2026-10-09')).toMatchObject({
      weeks: 40,
      days: 0,
      remaining: 0,
      percent: 100,
    });
    expect(pregnancyProgress('2026-10-08', '2026-10-09')).toMatchObject({
      weeks: 40,
      days: 1,
      remaining: -1,
      percent: 100,
    });
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
  it('拒绝自动归一化的无效日期，不显示负孕周', () => {
    expect(isDate('2026-02-30')).toBe(false);
    expect(pregnancyProgress('bad', '2026-10-09')).toBeNull();
    expect(pregnancyProgress('2028-01-01', '2026-10-09')).toBeNull();
  });
  it('每日计划从开始日期生效，一次性计划仅在指定日期出现', () => {
    expect(taskIsDue({ repeat: 'daily', date: '2026-10-09' }, '2026-10-08')).toBe(false);
    expect(taskIsDue({ repeat: 'daily', date: '2026-10-09' }, '2026-10-10')).toBe(true);
    expect(taskIsDue({ repeat: 'once', date: '2026-10-09' }, '2026-10-10')).toBe(false);
  });
});

describe('账目金额', () => {
  it('按分计算，不丢失小数精度', () => {
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney(' 1.01 ')).toBe(101);
    expect(parseMoney('99999999.99')).toBe(9999999999);
    for (const value of ['-1', '1.001', '1e2', '', 'NaN', 'Infinity', '100000000']) {
      expect(parseMoney(value)).toBeNull();
    }
  });
  it('津贴和医保只扣减一次，允许负净支出', () => {
    const expense: Expense = {
      id: '1',
      title: '产检',
      date: '2026-10-09',
      kind: 'expense',
      category: '产检医疗',
      amountCents: 10010,
      reimbursedCents: 2000,
    };
    const allowance: Expense = {
      ...expense,
      id: '2',
      kind: 'allowance',
      amountCents: 20000,
      reimbursedCents: 0,
    };
    expect(summarizeExpenses([expense, allowance])).toEqual({
      total: 10010,
      reimbursed: 2000,
      allowance: 20000,
      net: -11990,
    });
    expect(summarizeExpenses([]).net).toBe(0);
  });
});

describe('存档校验', () => {
  it('接受正确版本的空档案', () =>
    expect(decodeFamily(JSON.stringify(emptyFamily()))).toEqual(emptyFamily()));
  it('忽略对象键序比较相等性并生成稳定序列化', () => {
    const first = { b: [1, { y: 'yes', x: 'no' }], a: 'ok' };
    const second = { a: 'ok', b: [1, { x: 'no', y: 'yes' }] };
    expect(sameValue(first, second)).toBe(true);
    expect(sameValue(first, { ...second, a: 'changed' })).toBe(false);
    expect(canonicalJson(first)).toBe(canonicalJson(second));
  });
  it('拒绝损坏、未知版本及非法金额的档案', () => {
    expect(() => decodeFamily('{')).toThrow();
    expect(() => decodeFamily(JSON.stringify({ ...emptyFamily(), version: 2 }))).toThrow();
    expect(() =>
      decodeFamily(
        JSON.stringify({
          ...emptyFamily(),
          expenses: [
            {
              id: 'x',
              title: '账目',
              date: '2026-10-09',
              category: '其他',
              kind: 'expense',
              amountCents: 100,
              reimbursedCents: 101,
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it('支持儿童档案并在格式或唯一性错误时拒绝', () => {
    const validChildData = {
      ...emptyFamily(),
      children: [
        {
          id: 'child-1',
          name: '小宝',
          birthDate: '2026-06-01',
          gender: 'girl',
        },
      ],
    };
    expect(decodeFamily(JSON.stringify(validChildData))).toEqual(validChildData);

    // 拒绝重名/重复 ID
    expect(() =>
      decodeFamily(
        JSON.stringify({
          ...emptyFamily(),
          children: [
            { id: 'child-1', name: '大宝', birthDate: '2026-06-01' },
            { id: 'child-1', name: '二宝', birthDate: '2026-06-01' },
          ],
        }),
      ),
    ).toThrow();

    // 拒绝格式非法的儿童对象
    expect(() =>
      decodeFamily(
        JSON.stringify({
          ...emptyFamily(),
          children: [{ id: 'child-1', name: '', birthDate: '2026-06-01' }],
        }),
      ),
    ).toThrow();
  });
});
