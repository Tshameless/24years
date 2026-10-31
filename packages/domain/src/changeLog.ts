import type { Child } from './child';
import type { FamilyChange } from './collaboration';
import type { FamilyData } from './family';
import type { Expense } from './ledger';
import type { PregnancyRecord } from './pregnancy';
import type { FamilyProfile } from './profile';
import type { FamilyTask } from './tasks';

/** 结构化深比较，用于判断某条记录是否真的被改动过。 */
export function sameJsonValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffRecords<T extends { id: string }>(
  beforeList: readonly T[],
  afterList: readonly T[],
  toChange: (before: T | null, value: T | null) => FamilyChange,
): FamilyChange[] {
  const beforeMap = new Map(beforeList.map((item) => [item.id, item]));
  const afterMap = new Map(afterList.map((item) => [item.id, item]));
  const changes: FamilyChange[] = [];

  afterMap.forEach((item, id) => {
    const previous = beforeMap.get(id) ?? null;

    if (!sameJsonValue(previous, item)) {
      changes.push(toChange(previous, item));
    }
  });

  beforeMap.forEach((item, id) => {
    if (!afterMap.has(id)) {
      changes.push(toChange(item, null));
    }
  });

  return changes;
}

/**
 * 把「改前 / 改后」两份家庭数据快照换算成一组细粒度变更。
 *
 * 存在的意义：同步层拿到按记录的变更明细后，可以逐条应用到云端最新数据上实现合并，
 * 而不是拿整份快照去覆盖——后者会让双端同时编辑时先写入的一方改动被静默吞掉。
 *
 * 涉及产检完成连带记账、分娩结局连带建档等**原子联动**时不要用它，
 * 原始 PregnancyChange 携带 expense / child 字段，必须整条上传。
 */
export function diffFamilyChanges(before: FamilyData, after: FamilyData): FamilyChange[] {
  const changes: FamilyChange[] = [];

  if (!sameJsonValue(before.profile, after.profile)) {
    changes.push({
      type: 'profile',
      before: before.profile,
      // 清空档案时 value 为 null。领域层将其标为非空类型，运行时允许，
      // applyPendingFamilyChange 会在比对 before 通过后写入 null。
      value: after.profile as FamilyProfile,
    });
  }

  changes.push(
    ...diffRecords<FamilyTask>(before.tasks, after.tasks, (prev, value) => ({
      type: 'task',
      before: prev,
      value,
    })),
  );
  changes.push(
    ...diffRecords<Expense>(before.expenses, after.expenses, (prev, value) => ({
      type: 'expense',
      before: prev,
      value,
    })),
  );
  changes.push(
    ...diffRecords<Child>(before.children, after.children, (prev, value) => ({
      type: 'child',
      before: prev,
      value,
    })),
  );
  changes.push(
    ...diffRecords<PregnancyRecord>(before.pregnancyRecords, after.pregnancyRecords, (prev, value) => ({
      type: 'pregnancy',
      before: prev,
      value,
    })),
  );

  return changes;
}
