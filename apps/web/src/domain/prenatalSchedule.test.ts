import { describe, expect, it } from 'vitest';
import {
  prenatalScheduleState,
  scheduleDate,
  scheduledCheckup,
  type PrenatalScheduleItem,
} from './prenatalSchedule';

const item: PrenatalScheduleItem = {
  week: '20–24 周',
  title: '系统超声排畸',
  guidance: '确认检查安排。',
  offsetWeeks: 22,
};

const checkup = {
  id: 'checkup-1',
  type: 'checkup' as const,
  title: item.title,
  date: '2026-10-22',
  notes: '',
  completed: false,
};

describe('prenatal schedule progress', () => {
  it('calculates a reference date from the due date', () => {
    expect(scheduleDate('2027-01-01', 22)).toBe('2026-08-28');
  });

  it('prefers the newest matching appointment', () => {
    expect(
      scheduledCheckup(
        [checkup, { ...checkup, id: 'checkup-2', date: '2026-10-28', completed: true }],
        item,
      ),
    ).toMatchObject({ id: 'checkup-2', completed: true });
  });

  it.each([
    ['completed', '2026-10-30', '2026-10-30', { ...checkup, completed: true }],
    ['scheduled', '2026-10-30', '2026-10-30', checkup],
    ['past', '2026-10-29', '2026-10-30', null],
    ['due', '2026-10-30', '2026-10-30', null],
    ['upcoming', '2026-10-31', '2026-10-30', null],
  ] as const)('returns %s for the current record state', (state, date, today, record) => {
    expect(prenatalScheduleState(date, today, record)).toBe(state);
  });
});
