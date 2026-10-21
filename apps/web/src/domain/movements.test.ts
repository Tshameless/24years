import { expect, it } from 'vitest';
import {
  applyPregnancyChange,
  decodeFamily,
  emptyFamily,
  validPregnancyRecord,
  type PregnancyRecord,
} from './family';

const record: Extract<PregnancyRecord, { type: 'movement' }> = {
  id: 'observation',
  type: 'movement',
  date: '2026-10-21',
  time: '09:30',
  minutes: 30,
  count: 0,
  notes: '按实际观察填写',
};

it('preserves zero observations, duration and notes through save and backup', () => {
  const saved = applyPregnancyChange(emptyFamily(), {
    type: 'pregnancy',
    before: null,
    value: record,
  });
  expect(decodeFamily(JSON.stringify(saved))).toEqual(saved);
  expect(saved.pregnancyRecords).toEqual([record]);
  expect(validPregnancyRecord({ ...record, count: 9999, minutes: 1440, time: '23:59' })).toBe(true);
  expect(validPregnancyRecord({ ...record, time: '00:00' })).toBe(true);
});

it('rejects invalid counts, observation times and durations', () => {
  for (const patch of [
    { count: -1 },
    { count: 0.5 },
    { count: 10000 },
    { count: '1' },
    { count: NaN },
    { count: null },
    { minutes: 0 },
    { minutes: 1.5 },
    { minutes: 1441 },
    { minutes: Infinity },
    { time: '' },
    { time: '9:30' },
    { time: '24:00' },
    { time: '23:60' },
    { date: '2026-02-30' },
    { notes: 'a'.repeat(2001) },
  ]) {
    expect(validPregnancyRecord({ ...record, ...patch })).toBe(false);
  }
});

it('edits and deletes observations with conflict protection and without creating expenses', () => {
  const saved = applyPregnancyChange(emptyFamily(), {
    type: 'pregnancy',
    before: null,
    value: record,
  });
  const updated = { ...record, count: 3 };
  const edited = applyPregnancyChange(saved, { type: 'pregnancy', before: record, value: updated });
  expect(edited.pregnancyRecords).toEqual([updated]);
  expect(edited.expenses).toEqual([]);
  expect(() =>
    applyPregnancyChange(edited, { type: 'pregnancy', before: record, value: null }),
  ).toThrow(/已变化/);
  expect(
    applyPregnancyChange(edited, { type: 'pregnancy', before: updated, value: null })
      .pregnancyRecords,
  ).toEqual([]);
});
