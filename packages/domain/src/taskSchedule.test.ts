import { expect, it } from 'vitest';
import {
  decodeFamily,
  emptyFamily,
  taskIsDue,
  taskScheduleLabel,
  validTask,
  type FamilyTask,
} from './family';

const task: FamilyTask = {
  id: 'weekly',
  title: '整理资料',
  date: '2026-10-21',
  time: '09:00',
  repeat: 'weekly',
  weekdays: [1, 3, 5],
  completedDates: [],
};

it('每周计划遵守开始日及指定星期，跨周跨年按日历判断', () => {
  expect(taskIsDue(task, '2026-10-19')).toBe(false);
  expect(taskIsDue(task, '2026-10-21')).toBe(true);
  expect(taskIsDue(task, '2026-10-22')).toBe(false);
  expect(taskIsDue(task, '2026-10-23')).toBe(true);
  expect(taskIsDue(task, '2026-10-26')).toBe(true);
  expect(taskIsDue(task, '2027-01-01')).toBe(true);
  expect(taskIsDue({ ...task, weekdays: [7] }, '2026-10-25')).toBe(true);
  expect(taskIsDue(task, 'invalid')).toBe(false);
});

it('周规则不会覆盖旧一次性、每日规则或历史打卡', () => {
  expect(taskIsDue({ repeat: 'once', date: '2026-10-21' }, '2026-10-21')).toBe(true);
  expect(taskIsDue({ repeat: 'daily', date: '2026-10-21' }, '2026-10-22')).toBe(true);
  const old = {
    id: 'old',
    title: '旧计划',
    date: '2026-10-21',
    time: '09:00',
    repeat: 'daily',
    completedDates: ['2026-10-20'],
  };
  const data = { ...emptyFamily(), tasks: [old, { ...task, completedDates: ['2026-10-21'] }] };
  expect(decodeFamily(JSON.stringify(data))).toEqual(data);
  expect(taskScheduleLabel(task)).toBe('每周 周一、周三、周五 · 始于 2026-10-21');
});

it.each([undefined, [], [0], [8], [1.5], ['1'], [1, 1], [null], '1,3'])(
  '拒绝无效星期 %j',
  (weekdays) => {
    expect(validTask({ ...task, weekdays })).toBe(false);
    expect(() =>
      decodeFamily(JSON.stringify({ ...emptyFamily(), tasks: [{ ...task, weekdays }] })),
    ).toThrow();
  },
);

it('拒绝非每周规则附带星期并接受完整一周', () => {
  expect(validTask({ ...task, repeat: 'daily' })).toBe(false);
  expect(validTask({ ...task, weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe(true);
});
