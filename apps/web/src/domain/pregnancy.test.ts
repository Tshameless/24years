import { describe, expect, it } from 'vitest';
import {
  applyPregnancyChange,
  decodeFamily,
  emptyFamily,
  validPregnancyRecord,
  type PregnancyRecord,
  type Expense,
} from './family';

const checkup: PregnancyRecord = {
  id: 'visit',
  type: 'checkup',
  title: '常规产检',
  date: '2026-10-21',
  notes: '',
  completed: false,
};
const expense: Expense = {
  id: 'checkup-visit',
  title: '常规产检',
  date: '2026-10-21',
  kind: 'expense',
  category: '产检医疗',
  amountCents: 10010,
  reimbursedCents: 2005,
};
const completion = {
  type: 'pregnancy' as const,
  before: checkup,
  value: { ...checkup, completed: true },
  expense,
};

describe('孕期记录和原子入账', () => {
  it('接受完整新 schema，并在导入时拒绝损坏记录和多个活动计时', () => {
    expect(decodeFamily(JSON.stringify(emptyFamily()))).toEqual(emptyFamily());
    const records: PregnancyRecord[] = [
      checkup,
      { id: 'timer', type: 'contraction', startedAt: 1234, endedAt: null },
    ];
    expect(
      decodeFamily(JSON.stringify({ ...emptyFamily(), pregnancyRecords: records }))
        .pregnancyRecords,
    ).toEqual(records);
    for (const invalid of [
      { ...checkup, date: '2026-02-30' },
      { id: 'timer', type: 'contraction', startedAt: 200, endedAt: 100 },
      {
        id: 'vital',
        type: 'vital',
        date: '2026-10-21',
        metric: 'weight',
        value: Infinity,
        secondary: null,
        notes: '',
      },
    ]) {
      expect(validPregnancyRecord(invalid)).toBe(false);
      expect(() =>
        decodeFamily(JSON.stringify({ ...emptyFamily(), pregnancyRecords: [invalid] })),
      ).toThrow();
    }
    expect(() =>
      decodeFamily(
        JSON.stringify({
          ...emptyFamily(),
          pregnancyRecords: [records[1], { ...records[1], id: 'second' }],
        }),
      ),
    ).toThrow();
  });
  it('心理自查必须完整作答并允许按日期保存多条记录', () => {
    const firstScreening = {
      id: 'mental-screening',
      type: 'mentalScreening' as const,
      date: '2026-10-20',
      score: 1,
      selfHarm: false,
      answers: Array(10).fill(0),
      visibility: 'shared' as const,
      notes: '',
    };
    const next = { ...firstScreening, id: 'screening-2026-10-27', date: '2026-10-27' };
    const first = applyPregnancyChange(emptyFamily(), {
      type: 'pregnancy',
      before: null,
      value: firstScreening,
    });
    const saved = applyPregnancyChange(first, {
      type: 'pregnancy',
      before: null,
      value: next,
    });

    expect(saved.pregnancyRecords).toEqual([firstScreening, next]);
    expect(decodeFamily(JSON.stringify(saved)).pregnancyRecords).toEqual([firstScreening, next]);
    expect(validPregnancyRecord({ ...firstScreening, answers: undefined })).toBe(false);
    expect(validPregnancyRecord({ ...firstScreening, visibility: undefined })).toBe(false);
  });
  it('更正分娩结局必须解除关联，含成长记录的孩子不能随结局删除', () => {
    const birth: Extract<PregnancyRecord, { type: 'outcome' }> = {
      id: 'pregnancy-outcome',
      type: 'outcome' as const,
      kind: 'birth' as const,
      date: '2026-10-20',
      mode: 'unknown' as const,
      notes: '',
    };
    const ended: Extract<PregnancyRecord, { type: 'outcome' }> = {
      id: 'pregnancy-outcome',
      type: 'outcome' as const,
      kind: 'ended' as const,
      date: '2026-10-20',
      notes: '',
    };
    const child = {
      id: 'birth-pregnancy-outcome',
      name: '宝宝',
      birthDate: birth.date,
      sourceOutcomeId: birth.id,
      growthRecords: [{ id: 'measurement', date: '2026-10-27', weightKg: 3.2 }],
    };
    const data = {
      ...emptyFamily(),
      profile: {
        name: '家', nickname: '我', dueDate: '2027-01-01', quietMode: false,
        familyMode: 'single' as const, parentRole: 'single_parent' as const,
      },
      pregnancyRecords: [birth],
      children: [child],
    };

    expect(() =>
      applyPregnancyChange(data, { type: 'pregnancy', before: birth, value: ended }),
    ).toThrow('请先处理关联孩子档案');
    expect(() =>
      applyPregnancyChange(data, {
        type: 'pregnancy',
        before: birth,
        value: ended,
        child: { before: child, value: null },
      }),
    ).toThrow('不能通过更正分娩记录删除孩子档案');
    const detached = { ...child };
    delete (detached as { sourceOutcomeId?: string }).sourceOutcomeId;
    expect(
      applyPregnancyChange(data, {
        type: 'pregnancy',
        before: birth,
        value: ended,
        child: { before: child, value: detached },
      }).children,
    ).toEqual([detached]);
  });

  it('撤销分娩记录时可原子删除无成长记录的自动孩子档案', () => {
    const birth: PregnancyRecord = {
      id: 'pregnancy-outcome',
      type: 'outcome',
      kind: 'birth',
      date: '2026-10-20',
      mode: 'unknown',
      notes: '',
    };
    const child = {
      id: 'birth-pregnancy-outcome',
      name: '宝宝',
      birthDate: birth.date,
      sourceOutcomeId: birth.id,
    };
    const data = {
      ...emptyFamily(),
      profile: {
        name: '家', nickname: '我', dueDate: '2027-01-01', quietMode: false,
        familyMode: 'single' as const, parentRole: 'single_parent' as const,
      },
      pregnancyRecords: [birth],
      children: [child],
    };

    const result = applyPregnancyChange(data, {
      type: 'pregnancy',
      before: birth,
      value: null,
      child: { before: child, value: null },
    });

    expect(result.pregnancyRecords).toEqual([]);
    expect(result.children).toEqual([]);
    expect(data.pregnancyRecords).toEqual([birth]);
    expect(data.children).toEqual([child]);
  });

  it('允许分娩后的身心记录继续维护，但不允许超过两年窗口', () => {
    const birth: PregnancyRecord = {
      id: 'pregnancy-outcome',
      type: 'outcome',
      kind: 'birth',
      date: '2026-01-01',
      mode: 'unknown',
      notes: '',
    };
    const data = {
      ...emptyFamily(),
      profile: {
        name: '家', nickname: '我', dueDate: '2026-01-01', quietMode: false,
        familyMode: 'single' as const, parentRole: 'single_parent' as const,
      },
      pregnancyRecords: [birth],
    };
    const mood: PregnancyRecord = {
      id: 'post-birth-mood',
      type: 'mood',
      date: '2027-01-01',
      title: '平静',
      visibility: 'shared',
      notes: '',
    };

    expect(
      applyPregnancyChange(data, { type: 'pregnancy', before: null, value: mood }).pregnancyRecords,
    ).toContainEqual(mood);
    expect(() =>
      applyPregnancyChange(data, {
        type: 'pregnancy',
        before: null,
        value: { ...mood, date: '2028-01-02' },
      }),
    ).toThrow('24 个月内');

    const preBirthMood: PregnancyRecord = {
      id: 'pre-birth-mood',
      type: 'mood',
      date: '2025-12-15',
      title: '平静',
      visibility: 'shared',
      notes: '',
    };
    const withPreBirth = {
      ...data,
      pregnancyRecords: [preBirthMood, birth],
    };

    expect(() =>
      applyPregnancyChange(withPreBirth, {
        type: 'pregnancy',
        before: preBirthMood,
        value: { ...preBirthMood, date: '2026-01-10', notes: '尝试修改孕期历史' },
      }),
    ).toThrow('仅供查阅');

    const leapBirth: PregnancyRecord = {
      ...birth,
      date: '2024-02-29',
    };
    const leapData = {
      ...data,
      pregnancyRecords: [leapBirth],
    };

    expect(
      applyPregnancyChange(leapData, {
        type: 'pregnancy',
        before: null,
        value: { ...mood, date: '2026-02-28' },
      }).pregnancyRecords,
    ).toHaveLength(2);
    expect(() =>
      applyPregnancyChange(leapData, {
        type: 'pregnancy',
        before: null,
        value: { ...mood, date: '2026-03-01' },
      }),
    ).toThrow('24 个月内');
  });
  it('产检和费用一起保存，旧快照不能覆盖，失败不修改输入', () => {
    const data = { ...emptyFamily(), pregnancyRecords: [checkup] };
    const saved = applyPregnancyChange(data, completion);
    expect(saved.expenses).toEqual([expense]);
    expect(saved.pregnancyRecords?.[0]).toEqual(completion.value);
    expect(data.expenses).toEqual([]);
    expect(data.pregnancyRecords).toEqual([checkup]);
    expect(() => applyPregnancyChange(saved, completion)).toThrow('已变化');
    expect(() =>
      applyPregnancyChange(data, {
        ...completion,
        expense: { ...expense, reimbursedCents: 20000 },
      }),
    ).toThrow();
    expect(() => applyPregnancyChange(data, { ...completion, value: checkup })).toThrow();
    expect(() => applyPregnancyChange({ ...data, expenses: [expense] }, completion)).toThrow(
      '已有关联账目',
    );
    const deleted = applyPregnancyChange(saved, {
      type: 'pregnancy',
      before: completion.value,
      value: null,
    });
    expect(deleted.expenses).toEqual([expense]);
  });
  it('同一家庭只能有一次活动宫缩，结束后可以重新开始', () => {
    const first: PregnancyRecord = {
      id: 'one',
      type: 'contraction',
      startedAt: 1234,
      endedAt: null,
    };
    const data = applyPregnancyChange(emptyFamily(), {
      type: 'pregnancy',
      before: null,
      value: first,
    });
    const second: PregnancyRecord = { ...first, id: 'two', startedAt: 2345 };
    expect(() =>
      applyPregnancyChange(data, { type: 'pregnancy', before: null, value: second }),
    ).toThrow('正在计时');
    const stopped = applyPregnancyChange(data, {
      type: 'pregnancy',
      before: first,
      value: { ...first, endedAt: 2000 },
    });
    const quiet = {
      ...data,
      profile: {
        name: '家', nickname: '我', dueDate: '2027-01-01', quietMode: true,
        familyMode: 'single' as const, parentRole: 'single_parent' as const,
      },
    };
    expect(() =>
      applyPregnancyChange(
        { ...quiet, pregnancyRecords: [] },
        { type: 'pregnancy', before: null, value: first },
      ),
    ).toThrow('安静关怀');
    expect(
      applyPregnancyChange(quiet, {
        type: 'pregnancy',
        before: first,
        value: { ...first, endedAt: 2000 },
      }).pregnancyRecords?.[0],
    ).toEqual({ ...first, endedAt: 2000 });
    expect(
      applyPregnancyChange(stopped, { type: 'pregnancy', before: null, value: second })
        .pregnancyRecords,
    ).toHaveLength(2);
  });
});
