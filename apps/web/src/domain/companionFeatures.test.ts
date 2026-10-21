import { expect, it } from 'vitest';
import {
  applyPregnancyChange,
  decodeFamily,
  emptyFamily,
  taskIsDue,
  validTask,
  type FamilyTask,
  type PregnancyChange,
  type PregnancyRecord,
} from './family';
import { dueReminders } from './taskReminders';
import { selectVitals, vitalPlot, type Vital } from './vitalTrends';

const task: FamilyTask = {
  id: 'task',
  title: '资料',
  date: '2026-10-21',
  time: '09:00',
  repeat: 'daily',
  endDate: '2026-10-23',
  assignee: 'father',
  completedDates: [],
};

it('结束日期包含当天、阻止后续计划，旧计划不受影响', () => {
  expect(taskIsDue(task, '2026-10-23')).toBe(true);
  expect(taskIsDue(task, '2026-10-24')).toBe(false);
  expect(taskIsDue({ ...task, endDate: undefined }, '2027-10-24')).toBe(true);
  expect(validTask(task)).toBe(true);
  expect(validTask({ ...task, endDate: '2026-10-20' })).toBe(false);
  expect(validTask({ ...task, assignee: 'admin' })).toBe(false);
  expect(validTask({ ...task, endDate: '2026-02-30' })).toBe(false);
  expect(decodeFamily(JSON.stringify({ ...emptyFamily(), tasks: [task] })).tasks[0]).toEqual(task);
});

it('提醒只取到时、当日未完成、匹配责任人的计划，关怀模式全部隐藏', () => {
  expect(dueReminders([task], '2026-10-21', '08:59', false, 'father')).toEqual([]);
  expect(dueReminders([task], '2026-10-21', '09:00', false, 'father')).toEqual([task]);
  expect(dueReminders([task], '2026-10-21', '10:00', false, 'mother')).toEqual([]);
  expect(dueReminders([task], '2026-10-21', '10:00', true, 'father')).toEqual([]);
  expect(dueReminders([task], '2026-10-24', '10:00', false, 'father')).toEqual([]);
  expect(
    dueReminders(
      [{ ...task, completedDates: ['2026-10-21'] }],
      '2026-10-21',
      '10:00',
      false,
      'father',
    ),
  ).toEqual([]);
  expect(
    dueReminders([{ ...task, assignee: undefined }], '2026-10-21', '10:00', false),
  ).toHaveLength(1);
  expect(dueReminders([task], '2026-10-21', '25:00', false, 'father')).toEqual([]);
});

const packing: PregnancyRecord = {
  id: 'bag',
  type: 'packing',
  title: '资料袋',
  date: '2026-10-21',
  notes: '',
  completed: false,
};
const change: PregnancyChange = {
  type: 'pregnancy',
  before: packing,
  value: { ...packing, completed: true },
  expense: {
    id: 'packing-bag',
    title: '资料袋',
    date: packing.date,
    kind: 'expense',
    category: '待产准备',
    amountCents: 1234,
    reimbursedCents: 0,
  },
};
it('待产物品备齐与采购支出原子保存，不允许重复或篡改关联费用', () => {
  const original = { ...emptyFamily(), pregnancyRecords: [packing] };
  const saved = applyPregnancyChange(original, change);
  expect(saved.expenses).toEqual([change.expense]);
  expect(saved.pregnancyRecords).toEqual([change.value]);
  expect(original.expenses).toEqual([]);
  expect(() => applyPregnancyChange(saved, change)).toThrow();
  for (const expense of [
    { ...change.expense!, category: '产检医疗' as const },
    { ...change.expense!, id: 'unrelated' },
    { ...change.expense!, reimbursedCents: 1 },
    { ...change.expense!, date: '2026-10-22' },
  ]) {
    expect(() => applyPregnancyChange(original, { ...change, expense })).toThrow();
  }
  expect(() => applyPregnancyChange(emptyFamily(), { ...change, before: null })).toThrow();
  const deleted = applyPregnancyChange(saved, {
    type: 'pregnancy',
    before: change.value,
    value: null,
  });
  expect(deleted.expenses).toEqual(saved.expenses);
  expect(decodeFamily(JSON.stringify(saved))).toEqual(saved);
});

it('趋势按指标和日期筛选，不混合单位；同日同横坐标，空数据安全', () => {
  const vital: Vital = {
    id: 'v1',
    type: 'vital',
    date: '2026-10-21',
    metric: 'bloodPressure',
    value: 120,
    secondary: 80,
    notes: '',
  };
  const records: PregnancyRecord[] = [
    packing,
    { ...vital, id: 'v3', date: '2026-10-23' },
    vital,
    { ...vital, id: 'v2' },
    { ...vital, id: 'weight', metric: 'weight', value: 65, secondary: null },
  ];
  const selected = selectVitals(records, 'bloodPressure', '2026-10-21', '2026-10-22');
  expect(selected.map((item) => item.id)).toEqual(['v1', 'v2']);
  const plot = vitalPlot(selected)!;
  expect(plot.points[0]!.x).toBe(plot.points[1]!.x);
  expect(plot.points[0]!.y).toBeLessThan(plot.points[0]!.y2!);
  expect(vitalPlot([])).toBeNull();
  const all = vitalPlot(selectVitals(records, 'bloodPressure', '', ''))!;
  expect(all.points[0]!.x).toBe(55);
  expect(all.points[2]!.x).toBe(545);
});
