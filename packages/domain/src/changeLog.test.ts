import { describe, expect, it } from 'vitest';

import { diffFamilyChanges } from './changeLog';
import { applyPendingFamilyChange, type FamilyChange } from './collaboration';
import { emptyFamily, type FamilyData } from './family';
import type { PregnancyRecord } from './pregnancy';
import type { FamilyTask } from './tasks';

const task: FamilyTask = {
  id: 'task-a',
  title: '量血压',
  date: '2026-10-31',
  time: '08:00',
  repeat: 'daily',
  completedDates: [],
};

const movement: Extract<PregnancyRecord, { type: 'movement' }> = {
  id: 'movement-a',
  type: 'movement',
  date: '2026-10-31',
  time: '09:30',
  minutes: 30,
  count: 3,
  notes: '早餐后',
};

function applyAll(base: FamilyData, changes: readonly FamilyChange[]): FamilyData {
  let result = base;

  for (const change of changes) {
    const next = applyPendingFamilyChange(result, change);

    if (!next) {
      throw new Error(`unexpectedly rejected: ${change.type}`);
    }

    result = next;
  }

  return result;
}

describe('diffFamilyChanges', () => {
  it('recognises create, update and delete', () => {
    const before = { ...emptyFamily(), tasks: [task] };
    const after = {
      ...emptyFamily(),
      tasks: [
        { ...task, title: '量血压并记账' },
        { ...task, id: 'task-b', title: '记得喝水' },
      ],
      pregnancyRecords: [movement],
    };

    const changes = diffFamilyChanges(before, after);
    const taskChanges = changes.filter((change) => change.type === 'task');

    expect(taskChanges).toHaveLength(2);
    expect(taskChanges.some((change) => change.before?.id === 'task-a')).toBe(true);
    expect(changes.some((change) => change.type === 'pregnancy')).toBe(true);
  });

  it('emits nothing when nothing actually changed', () => {
    const data = { ...emptyFamily(), tasks: [task] };

    expect(diffFamilyChanges(data, data)).toEqual([]);
  });

  it('reports removal as a null value', () => {
    const before = { ...emptyFamily(), tasks: [task] };
    const after = { ...emptyFamily(), tasks: [] };
    const change = diffFamilyChanges(before, after).find((item) => item.type === 'task');

    expect(change).toMatchObject({ type: 'task', value: null });
  });
});

describe('concurrent family edits', () => {
  it('keeps both sides when different records were edited', () => {
    const base = emptyFamily();
    const mine = diffFamilyChanges(base, { ...base, tasks: [task] });
    const theirs = diffFamilyChanges(base, { ...base, pregnancyRecords: [movement] });

    // 我这边先落到云端。
    const cloud = applyAll(base, mine);

    expect(cloud.tasks).toHaveLength(1);

    // 对方基于同一份旧数据做的改动，追加到云端最新快照上依然成立。
    const merged = applyAll(cloud, theirs);

    expect(merged.tasks).toHaveLength(1);
    expect(merged.pregnancyRecords).toHaveLength(1);
  });

  it('flags a genuine conflict instead of silently overwriting', () => {
    const base = emptyFamily();
    const saved = applyPendingFamilyChange(base, { type: 'task', before: null, value: task })!;
    const myEdit: FamilyChange = {
      type: 'task',
      before: task,
      value: { ...task, title: '我改的标题' },
    };
    const theirEdit: FamilyChange = {
      type: 'task',
      before: task,
      value: { ...task, title: '对方改的标题' },
    };

    const applied = applyPendingFamilyChange(saved, myEdit)!;

    expect(applied.tasks[0]?.title).toBe('我改的标题');

    // 对方基于同一个旧值改同一条：before 已经对不上，必须判冲突交由用户裁决，
    // 而不是让后到的一方把先到那版悄悄盖掉。
    expect(applyPendingFamilyChange(applied, theirEdit)).toBeNull();
  });
});
