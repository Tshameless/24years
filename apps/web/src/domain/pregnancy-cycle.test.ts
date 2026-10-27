import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyPregnancyChange,
  decodeFamily,
  emptyFamily,
  localDate,
  validPregnancyRecord,
  type FamilyData,
  type PregnancyRecord,
} from './family';

const birth: PregnancyRecord = {
  id: 'pregnancy-outcome',
  type: 'outcome',
  kind: 'birth',
  date: '2026-01-01',
  mode: 'unknown',
  notes: '',
};
const ended: PregnancyRecord = {
  id: 'pregnancy-outcome',
  type: 'outcome',
  kind: 'ended',
  date: '2026-01-01',
  notes: '',
};
const plan: PregnancyRecord = {
  id: 'birth-plan',
  type: 'birthPlan',
  date: '2025-12-20',
  supportPerson: '家人',
  discussPainRelief: true,
  discussPosition: false,
  discussProcedures: true,
  discussNewbornCare: true,
  discussEarlyContact: true,
  questions: '请介绍镇痛选择',
  notes: '',
};
const handoff: PregnancyRecord = {
  id: 'postpartum-plan',
  type: 'postpartum',
  date: '2026-01-02',
  followupDate: '2026-02-01',
  supportPerson: '家人',
  recovery: '安排休息',
  feeding: '按出院交代',
  questions: '',
  notes: '',
};
const base = (): FamilyData => ({
  ...emptyFamily(),
  profile: { name: '家', nickname: '我', dueDate: '2026-01-05', quietMode: false },
});
const save = (data: FamilyData, value: PregnancyRecord, before: PregnancyRecord | null = null) =>
  applyPregnancyChange(data, { type: 'pregnancy', before, value });
describe('孕期全周期', () => {
  it('计划、分娩、交接完整备份往返，历史只读，交接可继续编辑', () => {
    const planned = save(base(), plan);
    const delivered = save(planned, birth);
    const after = save(delivered, handoff);
    expect(decodeFamily(JSON.stringify(after))).toEqual(after);
    expect(after.profile?.quietMode).toBe(false);
    expect(() => save(after, { ...plan, questions: '变化' }, plan)).toThrow('仅供查阅');
    expect(() =>
      applyPregnancyChange(after, { type: 'pregnancy', before: plan, value: null }),
    ).toThrow('仅供查阅');
    expect(
      save(after, { ...handoff, notes: '新的照护安排' }, handoff).pregnancyRecords,
    ).toContainEqual({ ...handoff, notes: '新的照护安排' });
    expect(() => save(after, handoff)).toThrow('已变化');
  });
  it('其他结束原子开启静默关怀，撤销保留关怀选择与既有账目任务', () => {
    const original = base();
    const after = save(original, ended);
    expect(after.profile?.quietMode).toBe(true);
    expect(original.profile?.quietMode).toBe(false);
    const reopened = applyPregnancyChange(after, { type: 'pregnancy', before: ended, value: null });
    expect(reopened.profile?.quietMode).toBe(true);
    expect(reopened.expenses).toEqual(original.expenses);
    expect(reopened.tasks).toEqual(original.tasks);
    expect(save(reopened, plan).pregnancyRecords).toContainEqual(plan);
  });
  it('活动计时阻止结束，停止后可保存；归档不允许活动计时的导入', () => {
    const timer: PregnancyRecord = {
      id: 'timer',
      type: 'contraction',
      startedAt: 100,
      endedAt: null,
    };
    const active = save(base(), timer);
    expect(() => save(active, birth)).toThrow('先结束');
    expect(active.pregnancyRecords).toEqual([timer]);
    const stopped = save(active, { ...timer, endedAt: 200 }, timer);
    expect(save(stopped, birth).pregnancyRecords).toContainEqual(birth);
    expect(() =>
      decodeFamily(JSON.stringify({ ...base(), pregnancyRecords: [timer, birth] })),
    ).toThrow();
  });
  it('结束需要档案，日期不能在未来；导入历史日期不依赖当前时钟', () => {
    expect(() => save(emptyFamily(), birth)).toThrow('先建立档案');
    expect(() => save(base(), { ...birth, date: addDays(localDate(), 1) })).toThrow('不晚于今天');
    expect(() =>
      decodeFamily(JSON.stringify({ ...emptyFamily(), pregnancyRecords: [birth] })),
    ).toThrow();
  });
  it('交接日期与结束方式一致，防止撤销分娩留下孤立交接', () => {
    expect(() => save(base(), handoff)).toThrow('先记录分娩');
    expect(() => save(save(base(), ended), handoff)).toThrow('先记录分娩');
    const delivered = save(base(), birth);
    expect(() => save(delivered, { ...handoff, date: '2025-12-31' })).toThrow('不能早于');
    const after = save(delivered, handoff);
    expect(() =>
      applyPregnancyChange(after, { type: 'pregnancy', before: birth, value: null }),
    ).toThrow('先在产后交接');
    expect(() => save(after, ended, birth)).toThrow('先在产后交接');
    expect(() => save(after, { ...birth, date: '2026-01-03' }, birth)).toThrow('不能晚于');
    const noHandoff = applyPregnancyChange(after, {
      type: 'pregnancy',
      before: handoff,
      value: null,
    });
    expect(
      applyPregnancyChange(noHandoff, { type: 'pregnancy', before: birth, value: null })
        .pregnancyRecords,
    ).toEqual([]);
    for (const records of [
      [handoff],
      [ended, handoff],
      [birth, { ...handoff, date: '2025-12-31' }],
    ]) {
      expect(() =>
        decodeFamily(JSON.stringify({ ...base(), pregnancyRecords: records })),
      ).toThrow();
    }
  });
  it('验证出生数据边界和固定单例标识，其他结束不混入出生字段', () => {
    expect(
      validPregnancyRecord({
        ...birth,
        birthGestationalWeeks: 34,
        birthWeightGrams: 3000,
        birthLengthCm: 50.5,
        headCircumferenceCm: 34,
        apgarOne: 0,
        apgarFive: 10,
      }),
    ).toBe(true);
    for (const invalid of [
      { birthGestationalWeeks: 19 },
      { birthGestationalWeeks: 46 },
      { birthGestationalWeeks: 34.5 },
      { birthWeightGrams: 0 },
      { birthWeightGrams: 3.5 },
      { birthLengthCm: Infinity },
      { headCircumferenceCm: -1 },
      { apgarOne: 11 },
      { apgarFive: 1.5 },
      { time: '24:00' },
      { id: 'other' },
    ]) {
      expect(validPregnancyRecord({ ...birth, ...invalid })).toBe(false);
    }
    expect(validPregnancyRecord({ ...ended, mode: 'unknown' })).toBe(false);
    expect(validPregnancyRecord({ ...ended, birthGestationalWeeks: 36 })).toBe(false);
    expect(validPregnancyRecord({ ...plan, discussPainRelief: 'yes' })).toBe(false);
    expect(validPregnancyRecord({ ...handoff, followupDate: '2026-01-01' })).toBe(false);
  });
});
